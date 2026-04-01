import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const activityRouter = new Hono<{ Variables: Variables }>();

// GET / - Get activity (likes, reblogs, comments on the current user's posts)
activityRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  // Get IDs of posts owned by this user
  const userPosts = await prisma.post.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, content: true },
  });
  const postIds = userPosts.map((p) => p.id);
  const postMap = Object.fromEntries(userPosts.map((p) => [p.id, p]));

  if (postIds.length === 0) {
    return c.json({ data: [] });
  }

  const [likes, reblogs, comments] = await Promise.all([
    prisma.like.findMany({
      where: { postId: { in: postIds }, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.reblog.findMany({
      where: { postId: { in: postIds }, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.comment.findMany({
      where: { postId: { in: postIds }, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const activity = [
    ...likes.map((l) => ({
      id: `like-${l.id}`,
      type: "like",
      userId: l.userId,
      postId: l.postId,
      user: l.user,
      post: postMap[l.postId] ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    ...reblogs.map((r) => ({
      id: `reblog-${r.id}`,
      type: "reblog",
      userId: r.userId,
      postId: r.postId,
      user: r.user,
      post: postMap[r.postId] ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    ...comments.map((c) => ({
      id: `comment-${c.id}`,
      type: "comment",
      userId: c.userId,
      postId: c.postId,
      user: c.user,
      post: postMap[c.postId] ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return c.json({ data: activity });
});

export { activityRouter };
