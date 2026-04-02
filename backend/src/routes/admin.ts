import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const adminRouter = new Hono<{ Variables: Variables }>();

// Middleware: admin-only guard
adminRouter.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (profile?.role !== "admin") {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  await next();
});

// GET /api/admin/reports — posts with report_count > 3
adminRouter.get("/reports", async (c) => {
  const posts = await prisma.post.findMany({
    where: { reportCount: { gt: 3 } },
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

// DELETE /api/admin/posts/:id — delete post
adminRouter.delete("/posts/:id", async (c) => {
  const postId = c.req.param("id");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ error: { message: "Post not found" } }, 404);

  await prisma.post.delete({ where: { id: postId } });

  return c.json({ data: { success: true } });
});

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

// PATCH /api/admin/users/:id/ban — set status = "banned"
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

export { adminRouter };
