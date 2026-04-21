import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const ADMIN_EMAIL = "wdaas@me.com";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const adminRouter = new Hono<{ Variables: Variables }>();

// Middleware: admin-only guard
adminRouter.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  await next();
});

// ─── Post Moderation ─────────────────────────────────────────

// GET /api/admin/reports — posts with report_count >= 1, sorted by most reported
adminRouter.get("/reports", async (c) => {
  const posts = await prisma.post.findMany({
    where: { reportCount: { gte: 1 } },
    orderBy: { reportCount: "desc" },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      reportCount: true,
      hidden: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
      reports: {
        select: { category: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  return c.json({ data: posts });
});

// GET /api/admin/hidden — posts where hidden = true
adminRouter.get("/hidden", async (c) => {
  const posts = await prisma.post.findMany({
    where: { hidden: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      reportCount: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return c.json({ data: posts });
});

// PATCH /api/admin/posts/:id/hide — set hidden = true
adminRouter.patch("/posts/:id/hide", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { hidden: true },
    select: { id: true, hidden: true },
  });

  return c.json({ data: updated });
});

// PATCH /api/admin/posts/:id/unhide — set hidden = false
adminRouter.patch("/posts/:id/unhide", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { hidden: false },
    select: { id: true, hidden: true },
  });

  return c.json({ data: updated });
});

// DELETE /api/admin/posts/:id — delete post
adminRouter.delete("/posts/:id", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  await prisma.post.delete({ where: { id: postId } });

  return c.json({ data: { success: true } });
});

// ─── Users ───────────────────────────────────────────────────

// GET /api/admin/users — list all users
adminRouter.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { posts: true, reports: true } },
    },
  });

  return c.json({ data: users });
});

// PATCH /api/admin/users/:id/ban — toggle banned/active
adminRouter.patch("/users/:id/ban", async (c) => {
  const userId = c.req.param("id");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return c.json({ error: { message: "User not found" } }, 404);

  const newStatus = target.status === "banned" ? "active" : "banned";
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
    select: { id: true, status: true },
  });

  return c.json({ data: updated });
});

// PATCH /api/admin/users/:id/role — toggle role between "user" and "moderator"
adminRouter.patch(
  "/users/:id/role",
  zValidator("json", z.object({ role: z.enum(["user", "moderator"]) })),
  async (c) => {
    const userId = c.req.param("id");
    const { role } = c.req.valid("json");

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return c.json({ error: { message: "User not found" } }, 404);
    if (target.role === "admin") {
      return c.json({ error: { message: "Cannot change admin role" } }, 403);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });

    return c.json({ data: updated });
  }
);

// ─── Comment Moderation ───────────────────────────────────────

// GET /api/admin/comments — all comments with post/user info
adminRouter.get("/comments", async (c) => {
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      hidden: true,
      reportCount: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
      post: { select: { id: true, content: true } },
    },
  });

  return c.json({ data: comments });
});

// PATCH /api/admin/comments/:id/hide — set hidden = true
adminRouter.patch("/comments/:id/hide", async (c) => {
  const commentId = c.req.param("id");
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: { message: "Comment not found" } }, 404);

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { hidden: true },
    select: { id: true, hidden: true },
  });

  return c.json({ data: updated });
});

// PATCH /api/admin/comments/:id/unhide — set hidden = false
adminRouter.patch("/comments/:id/unhide", async (c) => {
  const commentId = c.req.param("id");
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: { message: "Comment not found" } }, 404);

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { hidden: false },
    select: { id: true, hidden: true },
  });

  return c.json({ data: updated });
});

// DELETE /api/admin/comments/:id — delete comment permanently
adminRouter.delete("/comments/:id", async (c) => {
  const commentId = c.req.param("id");
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: { message: "Comment not found" } }, 404);

  await prisma.comment.delete({ where: { id: commentId } });

  return c.json({ data: { success: true } });
});

// ─── Live Moments Moderation ──────────────────────────────────

// GET /api/admin/live-moments — list all active live moments
adminRouter.get("/live-moments", async (c) => {
  const moments = await prisma.liveMoment.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      isLive: true,
      createdAt: true,
      expiresAt: true,
      creator: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return c.json({ data: moments });
});

// PATCH /api/admin/live-moments/:id/end — end a live moment
adminRouter.patch("/live-moments/:id/end", async (c) => {
  const momentId = c.req.param("id");
  const moment = await prisma.liveMoment.findUnique({ where: { id: momentId } });
  if (!moment) return c.json({ error: { message: "Live moment not found" } }, 404);

  const updated = await prisma.liveMoment.update({
    where: { id: momentId },
    data: { status: "ended", isLive: false },
    select: { id: true, status: true, isLive: true },
  });

  return c.json({ data: updated });
});

// ─── Featured Posts ───────────────────────────────────────────

// GET /api/admin/featured — all featured posts
adminRouter.get("/featured", async (c) => {
  const posts = await prisma.post.findMany({
    where: { featured: true },
    orderBy: { featuredAt: "desc" },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      featured: true,
      featuredAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
    },
  });

  return c.json({ data: posts });
});

// PATCH /api/admin/posts/:id/feature — mark post as featured
adminRouter.patch("/posts/:id/feature", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { featured: true, featuredAt: new Date() },
    select: { id: true, featured: true, featuredAt: true },
  });

  return c.json({ data: updated });
});

// PATCH /api/admin/posts/:id/unfeature — unmark post as featured
adminRouter.patch("/posts/:id/unfeature", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { featured: false, featuredAt: null },
    select: { id: true, featured: true, featuredAt: true },
  });

  return c.json({ data: updated });
});

// ─── Banned Keywords ──────────────────────────────────────────

// GET /api/admin/banned-words — list all banned words
adminRouter.get("/banned-words", async (c) => {
  const words = await prisma.bannedWord.findMany({
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: words });
});

// POST /api/admin/banned-words — add a banned word
adminRouter.post(
  "/banned-words",
  zValidator("json", z.object({ word: z.string().min(1) })),
  async (c) => {
    const { word } = c.req.valid("json");
    const normalized = word.trim().toLowerCase();

    if (!normalized) {
      return c.json({ error: { message: "Word cannot be empty" } }, 400);
    }

    const existing = await prisma.bannedWord.findUnique({ where: { word: normalized } });
    if (existing) {
      return c.json({ error: { message: "Word already banned" } }, 409);
    }

    const created = await prisma.bannedWord.create({
      data: { word: normalized },
    });

    return c.json({ data: created }, 201);
  }
);

// DELETE /api/admin/banned-words/:id — remove a banned word
adminRouter.delete("/banned-words/:id", async (c) => {
  const id = c.req.param("id");
  const word = await prisma.bannedWord.findUnique({ where: { id } });
  if (!word) return c.json({ error: { message: "Banned word not found" } }, 404);

  await prisma.bannedWord.delete({ where: { id } });

  return c.json({ data: { success: true } });
});

// ─── App Settings ─────────────────────────────────────────────

// GET /api/admin/settings — get or create singleton settings
adminRouter.get("/settings", async (c) => {
  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return c.json({ data: settings });
});

// PATCH /api/admin/settings — update settings
adminRouter.patch(
  "/settings",
  zValidator(
    "json",
    z.object({
      maintenanceMode: z.boolean().optional(),
      announcementText: z.string().nullable().optional(),
      announcementActive: z.boolean().optional(),
      featuresJson: z.string().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...body },
      update: body,
    });

    return c.json({ data: settings });
  }
);

// ─── App Stats ────────────────────────────────────────────────

// GET /api/admin/stats — aggregate stats
adminRouter.get("/stats", async (c) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    totalPosts,
    totalReports,
    newUsersToday,
    newPostsToday,
    bannedUsers,
    hiddenPosts,
    activeAds,
    adsForRevenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.report.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.post.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { status: "banned" } }),
    prisma.post.count({ where: { hidden: true } }),
    prisma.ad.count({ where: { active: true } }),
    prisma.ad.findMany({
      where: { ratePerImpression: { not: null } },
      select: { impressions: true, ratePerImpression: true },
    }),
  ]);

  const totalAdRevenue = adsForRevenue.reduce((sum, ad) => {
    return sum + ad.impressions * (ad.ratePerImpression ?? 0);
  }, 0);

  return c.json({
    data: {
      totalUsers,
      totalPosts,
      totalReports,
      newUsersToday,
      newPostsToday,
      bannedUsers,
      hiddenPosts,
      activeAds,
      totalAdRevenue,
    },
  });
});

// ─── Top Content ──────────────────────────────────────────────

// GET /api/admin/top-content — top 20 posts by like count
adminRouter.get("/top-content", async (c) => {
  const posts = await prisma.post.findMany({
    take: 20,
    orderBy: { likes: { _count: "desc" } },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
      _count: { select: { likes: true, comments: true, reblogs: true } },
    },
  });

  return c.json({ data: posts });
});

// ─── Revenue Summary ──────────────────────────────────────────

// GET /api/admin/revenue — ad revenue details
adminRouter.get("/revenue", async (c) => {
  const ads = await prisma.ad.findMany({
    select: {
      id: true,
      headline: true,
      impressions: true,
      clicks: true,
      budget: true,
      ratePerImpression: true,
      active: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
  const totalRevenue = ads.reduce((sum, ad) => sum + ad.impressions * (ad.ratePerImpression ?? 0), 0);
  const totalBudgetSpent = ads.reduce((sum, ad) => sum + Math.min(
    ad.impressions * (ad.ratePerImpression ?? 0),
    ad.budget ?? Infinity
  ), 0);

  return c.json({
    data: {
      ads,
      totals: {
        totalImpressions,
        totalClicks,
        totalRevenue,
        totalBudgetSpent,
      },
    },
  });
});

export { adminRouter };
