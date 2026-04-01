import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const tagFollowsRouter = new Hono<{ Variables: Variables }>();

// GET /tags/following - Get all tags the current user follows
tagFollowsRouter.get("/tags/following", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const tagFollows = await prisma.tagFollow.findMany({
    where: { userId: user.id },
    select: { tag: true },
    orderBy: { createdAt: "asc" },
  });

  const data = tagFollows.map((tf) => tf.tag);
  return c.json({ data });
});

// POST /tags/follow - Follow a tag
const followTagSchema = z.object({
  tag: z.string().min(1).max(100),
});

tagFollowsRouter.post(
  "/tags/follow",
  zValidator("json", followTagSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const body = c.req.valid("json");
    const tag = body.tag.toLowerCase().trim();

    await prisma.tagFollow.upsert({
      where: { userId_tag: { userId: user.id, tag } },
      create: { userId: user.id, tag },
      update: {},
    });

    return c.json({ data: { tag } });
  }
);

// DELETE /tags/follow/:tag - Unfollow a tag
tagFollowsRouter.delete("/tags/follow/:tag", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const tag = c.req.param("tag");

  await prisma.tagFollow.deleteMany({
    where: { userId: user.id, tag },
  });

  return c.json({ data: { success: true } });
});

// GET /feed/tags - Get posts that have tags the user follows
tagFollowsRouter.get("/feed/tags", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const page = Math.max(Number(c.req.query("page")) || 1, 1);
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const skip = (page - 1) * limit;

  // Get tags the user follows
  const tagFollows = await prisma.tagFollow.findMany({
    where: { userId: user.id },
    select: { tag: true },
  });

  if (tagFollows.length === 0) {
    return c.json({ data: [] });
  }

  const followedTags = tagFollows.map((tf) => tf.tag);

  // Get user explicit content preference
  const userPrefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: { showExplicit: true },
  });
  const showExplicit = userPrefs?.showExplicit ?? false;

  // Build tag filter: each followed tag must appear in the comma-separated tags field
  const tagConditions = followedTags.map((tag) => ({ tags: { contains: tag } }));

  const posts = await prisma.post.findMany({
    where: {
      OR: tagConditions,
      ...(showExplicit ? {} : { isExplicit: false }),
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const data = posts.map((post) => ({
    id: post.id,
    type: post.type,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    videoUrl: post.videoUrl ?? null,
    linkUrl: post.linkUrl,
    tags: post.tags ? post.tags.split(",").map((t) => t.trim()) : [],
    isExplicit: post.isExplicit,
    category: post.category,
    userId: post.userId,
    user: post.user,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    reblogCount: post._count.reblogs,
    isLiked: post.likes.length > 0,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return c.json({ data });
});

export { tagFollowsRouter };
