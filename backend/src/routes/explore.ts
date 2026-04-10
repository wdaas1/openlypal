import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const exploreRouter = new Hono<{ Variables: Variables }>();

// GET /trending - Trending/rising/controversial posts
// ?type=trending (default) | rising | controversial
exploreRouter.get("/trending", async (c) => {
  const user = c.get("user");
  const typeParam = c.req.query("type") ?? "trending";

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // Time window depends on type
  const since = typeParam === "rising" ? oneDayAgo : sevenDaysAgo;

  const whereClause: Record<string, unknown> = {
    createdAt: { gte: since },
    hidden: false,
    roomId: null,
    contentScore: { lt: 1.0 },
  };

  // Respect explicit content preference
  if (user) {
    const userPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: { showExplicit: true, contentSensitivity: true },
    });
    const sensitivity = userPrefs?.contentSensitivity ?? "safe";
    if (sensitivity === "safe") {
      whereClause.isExplicit = false;
      whereClause.contentScore = { lte: 0.3 };
    } else if (sensitivity === "mature") {
      whereClause.contentScore = { lte: 0.8 };
    }
    // "unfiltered": already filtered contentScore < 1.0 above
  } else {
    whereClause.isExplicit = false;
  }

  // Order: for controversial, we fetch all and sort in JS
  type PostOrderBy =
    | { likes: { _count: "desc" } }
    | { createdAt: "desc" };

  const orderBy: PostOrderBy =
    typeParam === "rising" ? { createdAt: "desc" } : { likes: { _count: "desc" } };

  const posts = await prisma.post.findMany({
    where: whereClause,
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
    orderBy,
    take: typeParam === "controversial" ? 100 : 20,
  });

  type MappedPost = {
    id: string;
    type: string;
    title: string | null;
    content: string | null;
    imageUrl: string | null;
    linkUrl: string | null;
    tags: string[];
    isExplicit: boolean;
    category: string | null;
    user: { id: string; name: string; username: string | null; image: string | null };
    likeCount: number;
    commentCount: number;
    reblogCount: number;
    isLiked: boolean;
    createdAt: string;
    updatedAt: string;
  };

  let data: MappedPost[] = posts.map((post) => {
    const likesArr = user
      ? ((post as Record<string, unknown>).likes as { id: string }[] | undefined) ?? []
      : [];
    const bookmarksArr = user
      ? ((post as Record<string, unknown>).bookmarks as { id: string }[] | undefined) ?? []
      : [];
    return {
      id: post.id,
      type: post.type,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      linkUrl: post.linkUrl,
      tags: post.tags ? post.tags.split(",").map((t) => t.trim()) : [],
      isExplicit: post.isExplicit,
      category: post.category,
      user: post.user,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      reblogCount: post._count.reblogs,
      bookmarkCount: (post._count as Record<string, number>).bookmarks ?? 0,
      isLiked: likesArr.length > 0,
      isBookmarked: bookmarksArr.length > 0,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  });

  // Controversial: high engagement but mixed reactions (comments vs likes ratio)
  if (typeParam === "controversial") {
    data = data
      .filter((p) => p.likeCount + p.commentCount + p.reblogCount > 0)
      .sort((a, b) => {
        const totalA = a.likeCount + a.commentCount + a.reblogCount;
        const totalB = b.likeCount + b.commentCount + b.reblogCount;
        // Posts with high comments relative to likes are more controversial
        const ratioA = totalA > 0 ? a.commentCount / (a.likeCount + 1) : 0;
        const ratioB = totalB > 0 ? b.commentCount / (b.likeCount + 1) : 0;
        const scoreA = totalA * ratioA;
        const scoreB = totalB * ratioB;
        return scoreB - scoreA;
      })
      .slice(0, 20);
  }

  return c.json({ data });
});

// GET /tags - Get popular tags
exploreRouter.get("/tags", async (c) => {
  const posts = await prisma.post.findMany({
    where: { tags: { not: null }, roomId: null },
    select: { tags: true },
  });

  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.tags) {
      const tags = post.tags.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, count]) => ({ tag, count }));

  return c.json({ data: sortedTags });
});

// GET /recommended - Recommended users to follow
exploreRouter.get("/recommended", async (c) => {
  const user = c.get("user");

  let excludeIds: string[] = [];
  if (user) {
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    excludeIds = [user.id, ...following.map((f) => f.followingId)];
  }

  const users = await prisma.user.findMany({
    where: {
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: { followers: { _count: "desc" } },
    take: 10,
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

// GET /categories - Get list of available categories
exploreRouter.get("/categories", (c) => {
  const categories = [
    "Art & Design", "Photography", "Music", "Writing & Poetry",
    "Gaming", "Fashion & Style", "Food & Cooking", "Travel",
    "Nature & Animals", "Sports", "Technology", "Humor & Memes",
    "Film & TV", "Comics & Animation", "Science", "LGBTQ+",
  ];
  return c.json({ data: categories });
});

export { exploreRouter };
