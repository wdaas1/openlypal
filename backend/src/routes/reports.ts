import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const reportsRouter = new Hono<{ Variables: Variables }>();

const reportSchema = z.object({
  postId: z.string(),
  category: z.enum(["illegal", "abuse", "spam", "explicit", "nudity", "violence", "other"]),
  reason: z.string().optional(),
});

// POST /api/reports
reportsRouter.post("/reports", zValidator("json", reportSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const { postId, category, reason } = c.req.valid("json");

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return c.json({ error: { message: "Post not found", code: "NOT_FOUND" } }, 404);
  }

  // Check duplicate
  const existing = await prisma.report.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });
  if (existing) {
    return c.json({ error: { message: "Already reported", code: "CONFLICT" } }, 409);
  }

  await prisma.report.create({
    data: { userId: user.id, postId, category, reason },
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

export { reportsRouter };
