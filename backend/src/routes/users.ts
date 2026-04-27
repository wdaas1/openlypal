import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { sendPushNotification } from "../lib/push-notifications";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null; username?: string | null } | null;
  session: { id: string } | null;
};

const usersRouter = new Hono<{ Variables: Variables }>();

/**
 * Ensure the authenticated Supabase user has a Prisma row with their exact ID.
 * Handles the case where the same email exists under a legacy Better Auth ID
 * by renaming the old row's email and creating a fresh row for the Supabase user.
 */
async function ensureUserRow(user: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  username?: string | null;
}) {
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        username: user.username ?? null,
      },
      update: {},
    });
  } catch (e: any) {
    // Email taken by a legacy row with a different ID — free it up then retry
    if (e?.code === "P2002") {
      const legacy = await prisma.user.findUnique({ where: { email: user.email } });
      if (legacy && legacy.id !== user.id) {
        await prisma.user.update({
          where: { id: legacy.id },
          data: { email: `migrated_${legacy.id}@legacy.internal` },
        });
      }
      // Now create (or find-if-already-exists) the Supabase user row
      await prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          username: user.username ?? null,
        },
        update: {},
      });
    }
  }
}

// GET /check-email?email=xxx — public, no auth required
usersRouter.get('/check-email', async (c) => {
  const email = c.req.query('email')?.toLowerCase().trim();
  if (!email) return c.json({ data: { exists: false } });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return c.json({ data: { exists: !!user } });
});

// GET /me - Get current user profile (auto-creates row on first login)
usersRouter.get("/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  await ensureUserRow(user);

  const profileSelect = {
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
    role: true,
    status: true,
    pronouns: true,
    website: true,
    location: true,
    dateOfBirth: true,
    gender: true,
    relationshipStatus: true,
    _count: { select: { followers: true, following: true, posts: true } },
  } as const;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: profileSelect,
  });

  if (!profile) {
    return c.json({ error: { message: "Failed to create user profile" } }, 500);
  }

  return c.json({
    data: {
      ...profile,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
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
  const currentUser = c.get("user");
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
      ...(currentUser ? {
        followers: {
          where: { followerId: currentUser.id },
          select: { id: true },
        },
      } : {}),
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
    isFollowing: currentUser
      ? Array.isArray((u as Record<string, unknown>).followers) && ((u as Record<string, unknown>).followers as unknown[]).length > 0
      : false,
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
  pronouns: z.string().max(50).optional(),
  website: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  gender: z.string().max(50).optional(),
  relationshipStatus: z.string().max(50).optional(),
});

usersRouter.patch("/me", zValidator("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = c.req.valid("json");

  // Username can only be set once (at sign-up); ignore any attempt to change it
  if (body.username) {
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true },
    });
    if (currentUser?.username) {
      // Already has a username — silently ignore the update
      delete (body as Record<string, unknown>).username;
    } else {
      // First time setting — check uniqueness
      const existing = await prisma.user.findUnique({
        where: { username: body.username },
        select: { id: true },
      });
      if (existing && existing.id !== user.id) {
        return c.json(
          { error: { message: "Username already taken", code: "CONFLICT" } },
          409
        );
      }
    }
  }

  const updateData = {
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
    ...(body.pronouns !== undefined ? { pronouns: body.pronouns } : {}),
    ...(body.website !== undefined ? { website: body.website } : {}),
    ...(body.location !== undefined ? { location: body.location } : {}),
    ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null } : {}),
    ...(body.gender !== undefined ? { gender: body.gender } : {}),
    ...(body.relationshipStatus !== undefined ? { relationshipStatus: body.relationshipStatus } : {}),
  };

  const profileSelect = {
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
    pronouns: true,
    website: true,
    location: true,
    dateOfBirth: true,
    gender: true,
    relationshipStatus: true,
  } as const;

  // Upsert: create user on first write if they haven't been created via GET /me yet
  const updated = await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      username: user.username ?? null,
      ...updateData,
    },
    update: updateData,
    select: profileSelect,
  }).catch(async (e: any) => {
    if (e?.code === "P2002") {
      // Email conflict — run migration then retry
      await ensureUserRow(user);
      return prisma.user.update({ where: { id: user.id }, data: updateData, select: profileSelect });
    }
    throw e;
  });

  return c.json({ data: updated });
});

// PATCH /me/push-token - Store device push token
usersRouter.patch(
  "/me/push-token",
  zValidator("json", z.object({ pushToken: z.string() })),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { pushToken } = c.req.valid("json");

    await ensureUserRow(user);
    await prisma.user.update({ where: { id: user.id }, data: { pushToken } });

    return c.json({ data: { pushToken } });
  }
);

// PATCH /me/public-key - Update public key for E2E encryption
usersRouter.patch(
  "/me/public-key",
  zValidator("json", z.object({ publicKey: z.string() })),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const { publicKey } = c.req.valid("json");

    await ensureUserRow(user);
    await prisma.user.update({ where: { id: user.id }, data: { publicKey } });

    return c.json({ data: { publicKey } });
  }
);

// GET /:id/public-key - Get user's public key
usersRouter.get("/:id/public-key", async (c) => {
  const id = c.req.param("id");

  const profile = await prisma.user.findUnique({
    where: { id },
    select: { publicKey: true },
  });

  if (!profile) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: { publicKey: profile.publicKey } });
});

// GET /by-username/:username - Get user profile by username
usersRouter.get("/by-username/:username", async (c) => {
  const { username } = c.req.param();
  const user = await prisma.user.findFirst({
    where: { username: { equals: username } },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      _count: { select: { followers: true, posts: true } },
    },
  });
  if (!user) return c.json({ error: { message: "User not found" } }, 404);
  return c.json({ data: user });
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
    where: { userId: id, hidden: false, roomId: null },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
      ...(currentUser
        ? {
            likes: { where: { userId: currentUser.id }, select: { id: true } },
            bookmarks: { where: { userId: currentUser.id }, select: { id: true } },
          }
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
    bookmarkCount: (post._count as Record<string, number>).bookmarks ?? 0,
    isLiked: currentUser
      ? (post as Record<string, unknown>).likes !== undefined &&
        Array.isArray((post as Record<string, unknown>).likes) &&
        ((post as Record<string, unknown>).likes as unknown[]).length > 0
      : false,
    isBookmarked: currentUser
      ? (post as Record<string, unknown>).bookmarks !== undefined &&
        Array.isArray((post as Record<string, unknown>).bookmarks) &&
        ((post as Record<string, unknown>).bookmarks as unknown[]).length > 0
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
// GET /:id/followers - List users who follow this user
usersRouter.get("/:id/followers", async (c) => {
  const profileId = c.req.param("id");
  const followers = await prisma.follow.findMany({
    where: { followingId: profileId },
    include: {
      follower: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: followers.map((f) => f.follower) });
});

// GET /:id/following - List users this user follows
usersRouter.get("/:id/following", async (c) => {
  const profileId = c.req.param("id");
  const following = await prisma.follow.findMany({
    where: { followerId: profileId },
    include: {
      following: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: following.map((f) => f.following) });
});

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

  // Ensure follower has a Prisma row (handles legacy email conflicts)
  await ensureUserRow(user);

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return c.json({ data: { following: false } });
  }

  await prisma.follow.create({ data: { followerId: user.id, followingId } });

  // Notify the followed user
  const followed = await prisma.user.findUnique({ where: { id: followingId }, select: { pushToken: true, notifyFollows: true } });
  if (followed?.pushToken && followed.notifyFollows) {
    const followerUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
    const followerName = followerUser?.name ?? followerUser?.username ?? "Someone";
    await sendPushNotification(followed.pushToken, "New Follower", `${followerName} started following you`, { type: "follow", userId: user.id });
  }

  return c.json({ data: { following: true } });
});

// GET /:id/reblogs - Get reblogs made by this user (public posts only)
usersRouter.get("/:id/reblogs", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);

  const reblogs = await prisma.reblog.findMany({
    where: { userId: id },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      post: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
          _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
          ...(currentUser
            ? {
                likes: { where: { userId: currentUser.id }, select: { id: true } },
                bookmarks: { where: { userId: currentUser.id }, select: { id: true } },
              }
            : {}),
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Exclude reblogs where the original post has a roomId or is hidden
  const filtered = reblogs.filter(
    (r) => r.post && r.post.roomId === null && !r.post.hidden
  );

  const data = filtered.map((r) => {
    const post = r.post;
    const likesArr = currentUser
      ? ((post as Record<string, unknown>).likes as { id: string }[] | undefined) ?? []
      : [];
    const bookmarksArr = currentUser
      ? ((post as Record<string, unknown>).bookmarks as { id: string }[] | undefined) ?? []
      : [];

    return {
      _type: "reblog" as const,
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      comment: r.comment,
      rebloggedBy: r.user,
      post: {
        id: post.id,
        type: post.type,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls ? (JSON.parse(post.imageUrls as string) as string[]) : [],
        videoUrl: post.videoUrl ?? null,
        linkUrl: post.linkUrl,
        tags: post.tags ? post.tags.split(",").map((t: string) => t.trim()) : [],
        isExplicit: post.isExplicit,
        contentScore: post.contentScore,
        category: post.category,
        userId: post.userId,
        user: post.user,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        reblogCount: post._count.reblogs,
        bookmarkCount: (post._count as Record<string, number>).bookmarks ?? 0,
        isLiked: currentUser ? likesArr.length > 0 : false,
        isBookmarked: currentUser ? bookmarksArr.length > 0 : false,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
    };
  });

  return c.json({ data });
});

// GET /me/notification-preferences
usersRouter.get("/me/notification-preferences", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const prefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notifyNewPosts: true, notifyLikes: true, notifyComments: true, notifyFollows: true, notifyReblogs: true },
  });
  return c.json({ data: prefs });
});

// PATCH /me/notification-preferences
usersRouter.patch("/me/notification-preferences", zValidator("json", z.object({
  notifyNewPosts: z.boolean().optional(),
  notifyLikes: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
  notifyFollows: z.boolean().optional(),
  notifyReblogs: z.boolean().optional(),
})), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = c.req.valid("json");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: body,
    select: { notifyNewPosts: true, notifyLikes: true, notifyComments: true, notifyFollows: true, notifyReblogs: true },
  });
  return c.json({ data: updated });
});

// GET /blocked - List blocked users
usersRouter.get("/blocked", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: { select: { id: true, name: true, username: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: blocks.map((b) => b.blocked) });
});

// POST /:id/block - Toggle block/unblock
usersRouter.post("/:id/block", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const blockedId = c.req.param("id");
  if (blockedId === user.id) return c.json({ error: { message: "Cannot block yourself" } }, 400);

  await ensureUserRow(user);

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
    return c.json({ data: { blocked: false } });
  }

  // Also unfollow both directions when blocking
  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: user.id, followingId: blockedId },
        { followerId: blockedId, followingId: user.id },
      ],
    },
  });

  await prisma.block.create({ data: { blockerId: user.id, blockedId } });
  return c.json({ data: { blocked: true } });
});

export { usersRouter };
