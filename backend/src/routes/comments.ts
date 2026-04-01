import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const commentsRouter = new Hono<{ Variables: Variables }>();

// POST /api/comments/:id/vote - Vote on a comment (1 = upvote, -1 = downvote)
const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

commentsRouter.post("/:id/vote", zValidator("json", voteSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const commentId = c.req.param("id");
  const body = c.req.valid("json");

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return c.json({ error: { message: "Comment not found", code: "NOT_FOUND" } }, 404);
  }

  const existing = await prisma.commentVote.findUnique({
    where: { userId_commentId: { userId: user.id, commentId } },
  });

  if (existing) {
    if (existing.value === body.value) {
      // Same vote again — remove it (toggle off)
      await prisma.commentVote.delete({ where: { id: existing.id } });

      // Adjust counts
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: {
          upvotes: body.value === 1 ? { decrement: 1 } : undefined,
          downvotes: body.value === -1 ? { decrement: 1 } : undefined,
        },
        select: { upvotes: true, downvotes: true },
      });

      return c.json({ data: { myVote: 0, upvotes: updated.upvotes, downvotes: updated.downvotes } });
    }

    // Changing vote direction
    await prisma.commentVote.update({
      where: { id: existing.id },
      data: { value: body.value },
    });

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        upvotes: body.value === 1 ? { increment: 1 } : { decrement: 1 },
        downvotes: body.value === -1 ? { increment: 1 } : { decrement: 1 },
      },
      select: { upvotes: true, downvotes: true },
    });

    return c.json({ data: { myVote: body.value, upvotes: updated.upvotes, downvotes: updated.downvotes } });
  }

  // New vote
  await prisma.commentVote.create({
    data: { userId: user.id, commentId, value: body.value },
  });

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: {
      upvotes: body.value === 1 ? { increment: 1 } : undefined,
      downvotes: body.value === -1 ? { increment: 1 } : undefined,
    },
    select: { upvotes: true, downvotes: true },
  });

  return c.json({ data: { myVote: body.value, upvotes: updated.upvotes, downvotes: updated.downvotes } });
});

// DELETE /api/comments/:id - Delete own comment
commentsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const commentId = c.req.param("id");
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!comment) {
    return c.json({ error: { message: "Comment not found", code: "NOT_FOUND" } }, 404);
  }
  if (comment.userId !== user.id) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return c.json({ data: { success: true } });
});

export { commentsRouter };
