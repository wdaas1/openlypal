import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const exploreRouter = new Hono<{ Variables: Variables }>();

// GET /trending - Most liked posts in last 7 days
exploreRouter.get("/trending", async (c) => {
  const user = c.get("user");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const whereClause: Record<string, unknown> = {
    createdAt: { gte: sevenDaysAgo },
  };

  // Respect explicit content preference
  if (user) {
    const userPrefs = await prisma.user.findUnique({ where: { id: user.id }, select: { showExplicit: true } });
    const showExplicit = userPrefs?.showExplicit ?? false;
    if (!showExplicit) {
      whereClause.isExplicit = false;
    }
  } else {
    // Unauthenticated users: hide explicit by default
    whereClause.isExplicit = false;
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
    orderBy: { likes: { _count: "desc" } },
    take: 20,
  });

  const data = posts.map((post) => ({
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
    isLiked: user
      ? (post as Record<string, unknown>).likes !== undefined &&
        Array.isArray((post as Record<string, unknown>).likes) &&
        ((post as Record<string, unknown>).likes as unknown[]).length > 0
      : false,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return c.json({ data });
});

// GET /tags - Get popular tags
exploreRouter.get("/tags", async (c) => {
  const posts = await prisma.post.findMany({
    where: { tags: { not: null } },
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
