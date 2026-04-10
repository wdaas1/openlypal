import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

type ActivityUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

type ActivityPost = {
  id: string;
  title: string | null;
  content: string | null;
} | null;

type ActivityItem = {
  id: string;
  type: string;
  userId: string;
  postId: string | null;
  user: ActivityUser | null;
  post: ActivityPost;
  createdAt: string;
  direction?: "outgoing";
};

const activityRouter = new Hono<{ Variables: Variables }>();

// GET / - Get activity: notifications (others acting on user's content) and outgoing (user acting on others' content)
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

  // Fetch notifications (incoming) and outgoing actions in parallel
  const [
    incomingLikes,
    incomingReblogs,
    incomingComments,
    incomingFollows,
    outgoingLikes,
    outgoingReblogs,
    outgoingComments,
    outgoingFollows,
  ] = await Promise.all([
    // --- Incoming: others acting on current user's posts ---
    postIds.length > 0
      ? prisma.like.findMany({
          where: { postId: { in: postIds }, userId: { not: user.id } },
          include: { user: { select: { id: true, name: true, username: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
    postIds.length > 0
      ? prisma.reblog.findMany({
          where: { postId: { in: postIds }, userId: { not: user.id } },
          include: { user: { select: { id: true, name: true, username: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
    postIds.length > 0
      ? prisma.comment.findMany({
          where: { postId: { in: postIds }, userId: { not: user.id } },
          include: { user: { select: { id: true, name: true, username: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
    prisma.follow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),

    // --- Outgoing: current user acting on others' posts ---
    prisma.like.findMany({
      where: { userId: user.id, postId: { notIn: postIds } },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.reblog.findMany({
      where: { userId: user.id, postId: { notIn: postIds } },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.comment.findMany({
      where: { userId: user.id, postId: { notIn: postIds } },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { id: true, name: true, username: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Build notifications array (incoming)
  const notifications: ActivityItem[] = [
    ...incomingLikes.map((l) => ({
      id: `like-${l.id}`,
      type: "like",
      userId: l.userId,
      postId: l.postId,
      user: l.user,
      post: postMap[l.postId] ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    ...incomingReblogs.map((r) => ({
      id: `reblog-${r.id}`,
      type: "reblog",
      userId: r.userId,
      postId: r.postId,
      user: r.user,
      post: postMap[r.postId] ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    ...incomingComments.map((cm) => ({
      id: `comment-${cm.id}`,
      type: "comment",
      userId: cm.userId,
      postId: cm.postId,
      user: cm.user,
      post: postMap[cm.postId] ?? null,
      createdAt: cm.createdAt.toISOString(),
    })),
    ...incomingFollows.map((f) => ({
      id: `follow-${f.id}`,
      type: "follow",
      userId: f.followerId,
      postId: null,
      user: f.follower,
      post: null,
      createdAt: f.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Build outgoing array (current user's actions on others)
  const outgoing: ActivityItem[] = [
    ...outgoingLikes.map((l) => ({
      id: `like_given-${l.id}`,
      type: "like_given" as const,
      userId: user.id,
      postId: l.postId,
      user: l.post?.user ?? null,
      post: l.post ? { id: l.post.id, title: l.post.title, content: l.post.content } : null,
      createdAt: l.createdAt.toISOString(),
      direction: "outgoing" as const,
    })),
    ...outgoingReblogs.map((r) => ({
      id: `reblog_given-${r.id}`,
      type: "reblog_given" as const,
      userId: user.id,
      postId: r.postId,
      user: r.post?.user ?? null,
      post: r.post ? { id: r.post.id, title: r.post.title, content: r.post.content } : null,
      createdAt: r.createdAt.toISOString(),
      direction: "outgoing" as const,
    })),
    ...outgoingComments.map((cm) => ({
      id: `comment_given-${cm.id}`,
      type: "comment_given" as const,
      userId: user.id,
      postId: cm.postId,
      user: cm.post?.user ?? null,
      post: cm.post ? { id: cm.post.id, title: cm.post.title, content: cm.post.content } : null,
      createdAt: cm.createdAt.toISOString(),
      direction: "outgoing" as const,
    })),
    ...outgoingFollows.map((f) => ({
      id: `follow_given-${f.id}`,
      type: "follow_given" as const,
      userId: user.id,
      postId: null,
      user: f.following,
      post: null,
      createdAt: f.createdAt.toISOString(),
      direction: "outgoing" as const,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return c.json({ data: { notifications, outgoing } });
});

export { activityRouter };
