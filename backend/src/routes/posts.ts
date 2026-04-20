import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { moderatePostContent } from "../lib/contentModeration";
import { sendPushNotification } from "../lib/push-notifications";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const postsRouter = new Hono<{ Variables: Variables }>();

// Helper: map a raw post record to API shape
function mapPost(
  post: {
    id: string;
    type: string;
    title: string | null;
    content: string | null;
    imageUrl: string | null;
    imageUrls?: string | null;
    videoUrl: string | null;
    linkUrl: string | null;
    tags: string | null;
    isExplicit: boolean;
    contentScore: number;
    category: string | null;
    hidden: boolean;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; name: string; username: string | null; image: string | null };
    _count: { likes: number; comments: number; reblogs: number };
  } & Record<string, unknown>,
  currentUserId?: string | null
) {
  const likesArr = currentUserId
    ? (post.likes as { id: string }[] | undefined) ?? []
    : [];
  const bookmarksArr = currentUserId
    ? (post.bookmarks as { id: string }[] | undefined) ?? []
    : [];
  const reblogsArr = currentUserId
    ? (post.reblogs as { id: string }[] | undefined) ?? []
    : [];
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    imageUrls: post.imageUrls ? JSON.parse(post.imageUrls as string) as string[] : [],
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
    isLiked: currentUserId ? likesArr.length > 0 : false,
    isBookmarked: currentUserId ? bookmarksArr.length > 0 : false,
    isReposted: currentUserId ? reblogsArr.length > 0 : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

// Shared Prisma include builder
function postInclude(userId?: string | null) {
  return {
    user: { select: { id: true, name: true, username: true, image: true } },
    _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
    ...(userId
      ? {
          likes: { where: { userId }, select: { id: true } },
          bookmarks: { where: { userId }, select: { id: true } },
          reblogs: { where: { userId }, select: { id: true } },
        }
      : {}),
  };
}

// Include builder for reblog feed items
function reblogFeedInclude(userId?: string | null) {
  return {
    user: { select: { id: true, name: true, username: true, image: true } }, // the reblogger
    post: {
      include: postInclude(userId), // original post with full data
    },
  };
}

// Shape of a mapped reblog feed item
type ReblogFeedItem = {
  _type: "reblog";
  id: string;
  createdAt: string;
  comment: string | null;
  rebloggedBy: { id: string; name: string; username: string | null; image: string | null };
  post: ReturnType<typeof mapPost>;
};

type PostFeedItem = ReturnType<typeof mapPost> & { _type: "post" };

// Map a raw reblog (with user + post includes) to a ReblogFeedItem
function mapReblogFeedItem(
  reblog: {
    id: string;
    createdAt: Date;
    comment: string | null;
    user: { id: string; name: string; username: string | null; image: string | null };
    post: Parameters<typeof mapPost>[0];
  },
  currentUserId?: string | null
): ReblogFeedItem {
  return {
    _type: "reblog",
    id: reblog.id,
    createdAt: reblog.createdAt.toISOString(),
    comment: reblog.comment,
    rebloggedBy: reblog.user,
    post: mapPost(reblog.post, currentUserId),
  };
}

// Build content sensitivity filter for a user's contentSensitivity preference
function buildSensitivityFilter(contentSensitivity: string | null | undefined): Record<string, unknown> {
  const sensitivity = contentSensitivity ?? "safe";
  if (sensitivity === "safe") {
    return { isExplicit: false, contentScore: { lte: 0.3 } };
  }
  if (sensitivity === "mature") {
    return { contentScore: { lte: 0.8 } };
  }
  return { contentScore: { lt: 1.0 } };
}

// GET / - Fetch posts from Prisma, with optional filters
postsRouter.get("/", async (c) => {
  const user = c.get("user");
  const filterUserId = c.req.query("userId");
  const liked = c.req.query("liked") === "true";
  const tag = c.req.query("tag");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);

  // Liked posts tab
  if (liked) {
    if (!user) return c.json({ data: [] });
    const likes = await prisma.like.findMany({
      where: { userId: user.id },
      include: {
        post: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
            _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
            likes: { where: { userId: user.id }, select: { id: true } },
            bookmarks: { where: { userId: user.id }, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return c.json({ data: likes.map((l) => mapPost(l.post as Parameters<typeof mapPost>[0], user.id)) });
  }

  const posts = await prisma.post.findMany({
    where: {
      hidden: false,
      roomId: null,
      type: { not: "live_recap" },
      ...(filterUserId ? { userId: filterUserId } : {}),
      ...(tag ? { tags: { contains: tag } } : {}),
    },
    include: postInclude(user?.id),
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // For the general feed (no userId filter and no tag filter), also include recent reblogs
  if (!filterUserId && !tag) {
    const reblogs = await prisma.reblog.findMany({
      include: reblogFeedInclude(user?.id),
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Exclude reblogs where the original post has a roomId or is hidden
    const filteredReblogs = reblogs.filter(
      (r) => r.post && r.post.roomId === null && !r.post.hidden && r.post.type !== "live_recap"
    );

    const postItems: PostFeedItem[] = posts.map((p) => ({
      ...mapPost(p as Parameters<typeof mapPost>[0], user?.id),
      _type: "post" as const,
    }));

    const reblogItems: ReblogFeedItem[] = filteredReblogs.map((r) =>
      mapReblogFeedItem(
        r as {
          id: string;
          createdAt: Date;
          comment: string | null;
          user: { id: string; name: string; username: string | null; image: string | null };
          post: Parameters<typeof mapPost>[0];
        },
        user?.id
      )
    );

    const merged = [...postItems, ...reblogItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, limit);

    return c.json({ data: merged });
  }

  return c.json({ data: posts.map((p) => mapPost(p as Parameters<typeof mapPost>[0], user?.id)) });
});

// GET /feed/unfiltered - All posts, chronological
postsRouter.get("/feed/unfiltered", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);

  const posts = await prisma.post.findMany({
    where: { hidden: false, roomId: null, type: { not: "live_recap" } },
    include: postInclude(user?.id),
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return c.json({ data: posts.map((p) => mapPost(p as Parameters<typeof mapPost>[0], user?.id)) });
});

// GET /feed/following - Posts and reblogs from followed users
postsRouter.get("/feed/following", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);

  if (!user) return c.json({ data: [] });

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);

  if (followingIds.length === 0) return c.json({ data: [] });

  // Fetch posts and reblogs in parallel
  const [posts, reblogs] = await Promise.all([
    prisma.post.findMany({
      where: { userId: { in: followingIds }, hidden: false, roomId: null, type: { not: "live_recap" } },
      include: postInclude(user.id),
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.reblog.findMany({
      where: { userId: { in: followingIds } },
      include: reblogFeedInclude(user.id),
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  // Exclude reblogs where the original post has a roomId or is hidden
  const filteredReblogs = reblogs.filter(
    (r) => r.post && r.post.roomId === null && !r.post.hidden && r.post.type !== "live_recap"
  );

  // Map to unified feed items
  const postItems: PostFeedItem[] = posts.map((p) => ({
    ...mapPost(p as Parameters<typeof mapPost>[0], user.id),
    _type: "post" as const,
  }));

  const reblogItems: ReblogFeedItem[] = filteredReblogs.map((r) =>
    mapReblogFeedItem(
      r as {
        id: string;
        createdAt: Date;
        comment: string | null;
        user: { id: string; name: string; username: string | null; image: string | null };
        post: Parameters<typeof mapPost>[0];
      },
      user.id
    )
  );

  // Merge and sort by createdAt descending, take limit
  const merged = [...postItems, ...reblogItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, limit);

  return c.json({ data: merged });
});

// GET /:id - Get single post
postsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
      ...(user
        ? {
            likes: { where: { userId: user.id }, select: { id: true } },
            bookmarks: { where: { userId: user.id }, select: { id: true } },
          }
        : {}),
    },
  });

  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  // If post belongs to a room, only members can view it
  if (post.roomId) {
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: post.roomId, userId: user?.id ?? "" } },
    });
    if (!member) return c.json({ error: { message: "Forbidden" } }, 403);
  }

  return c.json({ data: mapPost(post as Parameters<typeof mapPost>[0], user?.id) });
});

// POST / - Create post in Supabase
const createPostSchema = z.object({
  type: z.enum(["text", "photo", "quote", "link", "video"]).default("text"),
  title: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isExplicit: z.boolean().default(false),
  category: z.string().optional(),
  contentScore: z.number().min(0).max(1).optional(),
  roomId: z.string().optional(),
});

postsRouter.post("/", zValidator("json", createPostSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = c.req.valid("json");

  // Run AI content moderation for posts with media
  let detectedExplicit = body.isExplicit;
  let detectedContentScore = body.contentScore ?? 0;

  const imageUrlsToCheck = body.imageUrls ?? (body.imageUrl ? [body.imageUrl] : []);
  const hasMedia = imageUrlsToCheck.length > 0 || !!body.videoUrl;

  if (hasMedia && !body.isExplicit) {
    // Only auto-detect if poster didn't already flag it as explicit
    const modResult = await moderatePostContent(imageUrlsToCheck, body.videoUrl);
    detectedExplicit = modResult.isExplicit;
    detectedContentScore = modResult.contentScore;
  }

  const post = await prisma.post.create({
    data: {
      type: body.type,
      title: body.title ?? null,
      content: body.content ?? null,
      imageUrl: body.imageUrl ?? null,
      imageUrls: body.imageUrls ? JSON.stringify(body.imageUrls) : null,
      videoUrl: body.videoUrl ?? null,
      linkUrl: body.linkUrl ?? null,
      tags: body.tags && body.tags.length > 0 ? body.tags.join(",") : null,
      isExplicit: detectedExplicit,
      category: body.category ?? null,
      contentScore: detectedContentScore,
      userId: user.id,
      roomId: body.roomId ?? null,
    },
    include: postInclude(user.id),
  });

  // Notify followers about new post (fire-and-forget)
  (async () => {
    try {
      const followers = await prisma.follow.findMany({
        where: { followingId: user.id },
        include: { follower: { select: { pushToken: true, notifyNewPosts: true } } },
      });
      const posterName = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
      const name = posterName?.name ?? posterName?.username ?? "Someone you follow";
      await Promise.all(
        followers
          .filter((f) => f.follower.pushToken && f.follower.notifyNewPosts)
          .map((f) => sendPushNotification(f.follower.pushToken!, "New Post", `${name} just posted`, { type: "new_post", userId: user.id }))
      );
    } catch {}
  })();

  return c.json({ data: mapPost(post as Parameters<typeof mapPost>[0], user.id) });
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

// PUT /:id - Edit own post
const updatePostSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isExplicit: z.boolean().optional(),
  category: z.string().optional(),
});

postsRouter.put("/:id", zValidator("json", updatePostSchema), async (c) => {
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

  const body = c.req.valid("json");

  const updated = await prisma.post.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      ...(body.videoUrl !== undefined ? { videoUrl: body.videoUrl } : {}),
      ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl } : {}),
      ...(body.tags !== undefined ? { tags: body.tags.join(", ") } : {}),
      ...(body.isExplicit !== undefined ? { isExplicit: body.isExplicit } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true, bookmarks: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
      bookmarks: { where: { userId: user.id }, select: { id: true } },
    },
  });

  return c.json({ data: mapPost(updated as Parameters<typeof mapPost>[0], user.id) });
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

  // Notify post owner of new like (don't notify self-likes)
  if (post.userId !== user.id) {
    const owner = await prisma.user.findUnique({ where: { id: post.userId }, select: { pushToken: true, notifyLikes: true } });
    if (owner?.pushToken && owner.notifyLikes) {
      const liker = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
      const likerName = liker?.name ?? liker?.username ?? "Someone";
      await sendPushNotification(owner.pushToken, "New Like", `${likerName} liked your post`, { type: "like", postId });
    }
  }

  return c.json({ data: { liked: true } });
});

// POST /:id/bookmark - Toggle bookmark
postsRouter.post("/:id/bookmark", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return c.json({ data: { bookmarked: false } });
  }

  await prisma.bookmark.create({ data: { userId: user.id, postId } });
  return c.json({ data: { bookmarked: true } });
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

  const existing = await prisma.reblog.findFirst({ where: { userId: user.id, postId } });
  if (existing) {
    return c.json({ error: { message: "Already reposted", code: "ALREADY_REPOSTED" } }, 409);
  }

  const body = c.req.valid("json");
  const reblog = await prisma.reblog.create({
    data: { userId: user.id, postId, comment: body.comment },
  });

  // Notify post owner of new reblog (don't notify self-reblogs)
  if (post.userId !== user.id) {
    const owner = await prisma.user.findUnique({ where: { id: post.userId }, select: { pushToken: true, notifyReblogs: true } });
    if (owner?.pushToken && owner.notifyReblogs) {
      const reblogger = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
      const rebloggerName = reblogger?.name ?? reblogger?.username ?? "Someone";
      await sendPushNotification(owner.pushToken, "New Reblog", `${rebloggerName} reblogged your post`, { type: "reblog", postId });
    }
  }

  return c.json({ data: reblog });
});

// GET /:id/comments - Get threaded comments for a post
postsRouter.get("/:id/comments", async (c) => {
  const user = c.get("user");
  const postId = c.req.param("id");
  const sortParam = c.req.query("sort") ?? "top";

  // Determine sort order for top-level comments
  type CommentOrderBy =
    | { createdAt: "desc" | "asc" }
    | { upvotes: "desc" | "asc" };

  let orderBy: CommentOrderBy;
  if (sortParam === "new") {
    orderBy = { createdAt: "desc" };
  } else {
    // "top" and "controversial" both fetch by upvotes desc initially;
    // controversial re-sorted in JS below
    orderBy = { upvotes: "desc" };
  }

  // Shared user shape
  type CommentUser = { id: string; name: string; username: string | null; image: string | null };

  // API shape for a mapped comment (replies are always flat at the leaf level)
  type MappedComment = {
    id: string;
    content: string;
    userId: string;
    postId: string;
    parentId: string | null;
    upvotes: number;
    downvotes: number;
    myVote: number;
    user: CommentUser;
    createdAt: string;
    replies: MappedComment[];
  };

  // Raw reply shape from Prisma (no nested replies)
  type RawReply = {
    id: string;
    content: string;
    userId: string;
    postId: string;
    parentId: string | null;
    upvotes: number;
    downvotes: number;
    createdAt: Date;
    user: CommentUser;
    votes?: { value: number }[];
  };

  // Raw top-level comment shape (has replies array)
  type RawTopComment = RawReply & { replies: RawReply[] };

  function mapReply(r: RawReply): MappedComment {
    const voteArr = r.votes ?? [];
    return {
      id: r.id,
      content: r.content,
      userId: r.userId,
      postId: r.postId,
      parentId: r.parentId ?? null,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      myVote: voteArr[0]?.value ?? 0,
      user: r.user,
      createdAt: r.createdAt.toISOString(),
      replies: [],
    };
  }

  function mapTopComment(comment: RawTopComment): MappedComment {
    const voteArr = comment.votes ?? [];
    return {
      id: comment.id,
      content: comment.content,
      userId: comment.userId,
      postId: comment.postId,
      parentId: comment.parentId ?? null,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      myVote: voteArr[0]?.value ?? 0,
      user: comment.user,
      createdAt: comment.createdAt.toISOString(),
      replies: comment.replies.map(mapReply),
    };
  }

  // Fetch top-level comments with nested replies (1 level deep)
  const topLevelComments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
          ...(user
            ? { votes: { where: { userId: user.id }, select: { value: true } } }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      },
      ...(user
        ? { votes: { where: { userId: user.id }, select: { value: true } } }
        : {}),
    },
    orderBy,
  });

  let result: MappedComment[] = (topLevelComments as unknown as RawTopComment[]).map(mapTopComment);

  // Controversial sort: high total votes but contentious (upvotes close to downvotes)
  if (sortParam === "controversial") {
    result = result.sort((a, b) => {
      const totalA = a.upvotes + a.downvotes;
      const totalB = b.upvotes + b.downvotes;
      // Higher controversy score = more total votes AND closer to 50/50
      const controversyA = totalA > 0 ? totalA * (1 - Math.abs(a.upvotes - a.downvotes) / totalA) : 0;
      const controversyB = totalB > 0 ? totalB * (1 - Math.abs(b.upvotes - b.downvotes) / totalB) : 0;
      return controversyB - controversyA;
    });
  }

  return c.json({ data: result });
});

// POST /:id/comments - Add comment (supports parentId for threading)
const commentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

postsRouter.post("/:id/comments", zValidator("json", commentSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const commentProfile = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
  if (commentProfile?.status === "banned") {
    return c.json({ error: { message: "Your account has been suspended.", code: "BANNED" } }, 403);
  }

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const body = c.req.valid("json");

  // If parentId is provided, verify the parent comment exists on this post
  if (body.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
    if (!parent || parent.postId !== postId) {
      return c.json({ error: { message: "Parent comment not found", code: "NOT_FOUND" } }, 404);
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content: body.content,
      userId: user.id,
      postId,
      ...(body.parentId ? { parentId: body.parentId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  // Notify post owner of new comment
  const commentPost = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
  if (commentPost && commentPost.userId !== user.id) {
    const owner = await prisma.user.findUnique({ where: { id: commentPost.userId }, select: { pushToken: true, notifyComments: true } });
    if (owner?.pushToken && owner.notifyComments) {
      const commenter = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
      const commenterName = commenter?.name ?? commenter?.username ?? "Someone";
      await sendPushNotification(owner.pushToken, "New Comment", `${commenterName} commented on your post`, { type: "comment", postId });
    }
  }

  return c.json({
    data: {
      id: comment.id,
      content: comment.content,
      userId: comment.userId,
      postId: comment.postId,
      parentId: comment.parentId ?? null,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      myVote: 0,
      user: comment.user,
      createdAt: comment.createdAt.toISOString(),
      replies: [],
    },
  });
});

// POST /:id/report - Report a post
const reportSchema = z.object({
  category: z.enum(["illegal", "abuse", "spam", "explicit"]),
  reason: z.string().optional(),
});

postsRouter.post("/:id/report", zValidator("json", reportSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  const body = c.req.valid("json");

  // Check if user already reported this post
  const existing = await prisma.report.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });
  if (existing) {
    return c.json({ error: { message: "Already reported", code: "CONFLICT" } }, 409);
  }

  await prisma.report.create({
    data: { userId: user.id, postId, category: body.category, reason: body.reason },
  });

  // Increment reportCount and auto-hide if >= 5
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      reportCount: { increment: 1 },
      hidden: post.reportCount + 1 >= 5 ? true : undefined,
    },
  });

  return c.json({ data: { success: true, hidden: updated.hidden } });
});

export { postsRouter };
