import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const usersRouter = new Hono<{ Variables: Variables }>();

// GET /me - Get current user profile
usersRouter.get("/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
      image: true,
      headerImage: true,
      createdAt: true,
      categories: true,
      showExplicit: true,
      links: true,
      contentSensitivity: true,
      pinnedPostIds: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });

  if (!profile) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({
    data: {
      ...profile,
      followerCount: profile._count.followers,
      followingCount: profile._count.following,
      postCount: profile._count.posts,
      _count: undefined,
    },
  });
});

// GET /me/likes - Get posts liked by current user
usersRouter.get("/me/likes", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const likes = await prisma.like.findMany({
    where: { userId: user.id },
    include: {
      post: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
          _count: { select: { likes: true, comments: true, reblogs: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = likes.map((like) => ({
    id: like.post.id,
    type: like.post.type,
    title: like.post.title,
    content: like.post.content,
    imageUrl: like.post.imageUrl,
    linkUrl: like.post.linkUrl,
    tags: like.post.tags ? like.post.tags.split(",").map((t) => t.trim()) : [],
    user: like.post.user,
    likeCount: like.post._count.likes,
    commentCount: like.post._count.comments,
    reblogCount: like.post._count.reblogs,
    isLiked: true,
    createdAt: like.post.createdAt.toISOString(),
    updatedAt: like.post.updatedAt.toISOString(),
  }));

  return c.json({ data });
});

// GET /search - Search users
usersRouter.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ data: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q } },
        { name: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      _count: { select: { followers: true, posts: true } },
    },
    take: 20,
  });

  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    followerCount: u._count.followers,
    postCount: u._count.posts,
  }));

  return c.json({ data });
});

// PATCH /me - Update current user profile
const updateProfileSchema = z.object({
  username: z.string().min(1).max(30).optional(),
  bio: z.string().max(500).optional(),
  name: z.string().min(1).max(100).optional(),
  image: z.string().optional(),
  headerImage: z.string().optional(),
  categories: z.string().optional(),
  showExplicit: z.boolean().optional(),
  links: z.string().optional(),
  contentSensitivity: z.enum(["safe", "mature", "unfiltered"]).optional(),
  pinnedPostIds: z.string().optional(),
});

usersRouter.patch("/me", zValidator("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = c.req.valid("json");

  // Check username uniqueness if being updated
  if (body.username) {
    const existing = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (existing && existing.id !== user.id) {
      return c.json(
        { error: { message: "Username already taken", code: "CONFLICT" } },
        409
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.username !== undefined ? { username: body.username } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.image !== undefined ? { image: body.image } : {}),
      ...(body.headerImage !== undefined ? { headerImage: body.headerImage } : {}),
      ...(body.categories !== undefined ? { categories: body.categories } : {}),
      ...(body.showExplicit !== undefined ? { showExplicit: body.showExplicit } : {}),
      ...(body.links !== undefined ? { links: body.links } : {}),
      ...(body.contentSensitivity !== undefined ? { contentSensitivity: body.contentSensitivity } : {}),
      ...(body.pinnedPostIds !== undefined ? { pinnedPostIds: body.pinnedPostIds } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
      image: true,
      headerImage: true,
      createdAt: true,
      categories: true,
      showExplicit: true,
      links: true,
      contentSensitivity: true,
      pinnedPostIds: true,
    },
  });

  return c.json({ data: updated });
});

// GET /:id - Get user profile by ID
usersRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const profile = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      image: true,
      headerImage: true,
      categories: true,
      links: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
      ...(user
        ? {
            followers: {
              where: { followerId: user.id },
              select: { id: true },
            },
          }
        : {}),
    },
  });

  if (!profile) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  const followersArr = (profile as Record<string, unknown>).followers;
  const isFollowing = user
    ? Array.isArray(followersArr) && followersArr.length > 0
    : false;

  return c.json({
    data: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      image: profile.image,
      headerImage: profile.headerImage,
      categories: profile.categories,
      links: profile.links,
      createdAt: profile.createdAt,
      followerCount: profile._count.followers,
      followingCount: profile._count.following,
      postCount: profile._count.posts,
      isFollowing,
    },
  });
});

// GET /:id/posts - Get user's posts
usersRouter.get("/:id/posts", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");

  const posts = await prisma.post.findMany({
    where: { userId: id },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
      ...(currentUser
        ? { likes: { where: { userId: currentUser.id }, select: { id: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const data = posts.map((post) => ({
    id: post.id,
    type: post.type,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    tags: post.tags ? post.tags.split(",").map((t) => t.trim()) : [],
    user: post.user,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    reblogCount: post._count.reblogs,
    isLiked: currentUser
      ? (post as Record<string, unknown>).likes !== undefined &&
        Array.isArray((post as Record<string, unknown>).likes) &&
        ((post as Record<string, unknown>).likes as unknown[]).length > 0
      : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return c.json({ data });
});

// DELETE /me - Delete current user account (GDPR compliance)
usersRouter.delete("/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  // Delete all user data (cascades via Prisma relations)
  await prisma.user.delete({ where: { id: user.id } });

  return c.json({ data: { deleted: true } });
});

// POST /:id/follow - Toggle follow/unfollow
usersRouter.post("/:id/follow", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const followingId = c.req.param("id");

  if (followingId === user.id) {
    return c.json(
      { error: { message: "Cannot follow yourself", code: "BAD_REQUEST" } },
      400
    );
  }

  const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
  if (!targetUser) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: user.id, followingId },
    },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return c.json({ data: { following: false } });
  }

  await prisma.follow.create({
    data: { followerId: user.id, followingId },
  });
  return c.json({ data: { following: true } });
});

export { usersRouter };
