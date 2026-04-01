import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const postsRouter = new Hono<{ Variables: Variables }>();

// GET / - Get feed posts
postsRouter.get("/", async (c) => {
  const user = c.get("user");
  const tag = c.req.query("tag");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const cursor = c.req.query("cursor");

  let whereClause: Record<string, unknown> = {};

  // If user is logged in, try to get feed from followed users + own posts
  if (user) {
    const follows = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = follows.map((f) => f.followingId);

    if (followingIds.length > 0) {
      whereClause.userId = { in: [...followingIds, user.id] };
    }
  }

  // Get user preferences for explicit content
  let showExplicit = true; // Default: show all for unauthenticated users
  if (user) {
    const userPrefs = await prisma.user.findUnique({ where: { id: user.id }, select: { showExplicit: true, categories: true } });
    showExplicit = userPrefs?.showExplicit ?? false;
    if (!showExplicit) {
      whereClause.isExplicit = false;
    }
  }

  if (tag) {
    whereClause.tags = { contains: tag };
  }

  if (cursor) {
    whereClause.id = { lt: cursor };
  }

  const posts = await prisma.post.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
      ...(user
        ? { likes: { where: { userId: user.id }, select: { id: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
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
    user: post.user,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    reblogCount: post._count.reblogs,
    isLiked: user ? (post as Record<string, unknown>).likes !== undefined && Array.isArray((post as Record<string, unknown>).likes) && ((post as Record<string, unknown>).likes as unknown[]).length > 0 : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return c.json({ data });
});

// GET /:id - Get single post
postsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
      ...(user
        ? { likes: { where: { userId: user.id }, select: { id: true } } }
        : {}),
    },
  });

  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const data = {
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
    user: post.user,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    reblogCount: post._count.reblogs,
    isLiked: user ? (post as Record<string, unknown>).likes !== undefined && Array.isArray((post as Record<string, unknown>).likes) && ((post as Record<string, unknown>).likes as unknown[]).length > 0 : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };

  return c.json({ data });
});

// POST / - Create post
const createPostSchema = z.object({
  type: z.enum(["text", "photo", "quote", "link", "video"]).default("text"),
  title: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isExplicit: z.boolean().default(false),
  category: z.string().optional(),
});

postsRouter.post("/", zValidator("json", createPostSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = c.req.valid("json");

  const post = await prisma.post.create({
    data: {
      type: body.type,
      title: body.title,
      content: body.content,
      imageUrl: body.imageUrl,
      videoUrl: body.videoUrl,
      linkUrl: body.linkUrl,
      tags: body.tags?.join(", "),
      isExplicit: body.isExplicit ?? false,
      category: body.category,
      userId: user.id,
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return c.json({
    data: {
      ...post,
      tags: post.tags ? post.tags.split(",").map((t) => t.trim()) : [],
      likeCount: 0,
      commentCount: 0,
      reblogCount: 0,
      isLiked: false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    },
  });
});

// DELETE /:id - Delete own post
postsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const id = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }
  if (post.userId !== user.id) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  await prisma.post.delete({ where: { id } });
  return c.json({ data: { success: true } });
});

// POST /:id/like - Toggle like
postsRouter.post("/:id/like", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return c.json({ data: { liked: false } });
  }

  await prisma.like.create({ data: { userId: user.id, postId } });
  return c.json({ data: { liked: true } });
});

// POST /:id/reblog - Reblog a post
const reblogSchema = z.object({
  comment: z.string().optional(),
});

postsRouter.post("/:id/reblog", zValidator("json", reblogSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const body = c.req.valid("json");
  const reblog = await prisma.reblog.create({
    data: { userId: user.id, postId, comment: body.comment },
  });

  return c.json({ data: reblog });
});

// GET /:id/comments - Get comments for a post
postsRouter.get("/:id/comments", async (c) => {
  const postId = c.req.param("id");

  const comments = await prisma.comment.findMany({
    where: { postId },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: comments });
});

// POST /:id/comments - Add comment
const commentSchema = z.object({
  content: z.string().min(1),
});

postsRouter.post("/:id/comments", zValidator("json", commentSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const body = c.req.valid("json");
  const comment = await prisma.comment.create({
    data: { content: body.content, userId: user.id, postId },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return c.json({ data: comment });
});

export { postsRouter };
