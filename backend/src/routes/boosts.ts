import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null; username?: string | null } | null;
  session: { id: string } | null;
};

const boostsRouter = new Hono<{ Variables: Variables }>();

// POST /api/boosts/live/:momentId — authenticated, record a LiveBoost and mark moment as boosted
boostsRouter.post(
  "/live/:momentId",
  zValidator(
    "json",
    z.object({
      transactionId: z.string().optional(),
      productId: z.string().optional(),
    })
  ),
  async (c) => {
    const authUser = c.get("user");
    if (!authUser) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const momentId = c.req.param("momentId");
    const { transactionId, productId } = c.req.valid("json");

    // Verify the moment exists
    const moment = await prisma.liveMoment.findUnique({
      where: { id: momentId },
      select: { id: true },
    });

    if (!moment) {
      return c.json({ error: { message: "Live moment not found", code: "NOT_FOUND" } }, 404);
    }

    // Record the boost
    await prisma.liveBoost.create({
      data: {
        momentId,
        userId: authUser.id,
        transactionId: transactionId ?? null,
        productId: productId ?? "boost_live_999",
      },
    });

    // Mark the moment as boosted
    await prisma.liveMoment.update({
      where: { id: momentId },
      data: { boosted: true },
    });

    return c.json({ data: { success: true } });
  }
);

export { boostsRouter };
