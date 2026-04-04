import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const profileModulesRouter = new Hono<{ Variables: Variables }>();

const MODULE_TYPES = ["project", "goal", "mood", "learning", "availability"] as const;

// GET / — get own modules, ordered by position
profileModulesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const modules = await prisma.profileModule.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
  });

  return c.json({ data: modules });
});

// GET /user/:userId — get any user's modules (public)
profileModulesRouter.get("/user/:userId", async (c) => {
  const userId = c.req.param("userId");

  const modules = await prisma.profileModule.findMany({
    where: { userId },
    orderBy: { position: "asc" },
  });

  return c.json({ data: modules });
});

// POST / — create a module
const createModuleSchema = z.object({
  type: z.enum(MODULE_TYPES),
  content: z.string(),
});

profileModulesRouter.post("/", zValidator("json", createModuleSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = c.req.valid("json");

  // Auto-set position = max existing + 1
  const aggregate = await prisma.profileModule.aggregate({
    where: { userId: user.id },
    _max: { position: true },
  });
  const nextPosition = (aggregate._max.position ?? -1) + 1;

  const module = await prisma.profileModule.create({
    data: {
      userId: user.id,
      type: body.type,
      content: body.content,
      position: nextPosition,
    },
  });

  return c.json({ data: module });
});

// PUT /:id — update module content/position (own only)
const updateModuleSchema = z.object({
  content: z.string().optional(),
  position: z.number().int().optional(),
});

profileModulesRouter.put("/:id", zValidator("json", updateModuleSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const id = c.req.param("id");
  const body = c.req.valid("json");

  const existing = await prisma.profileModule.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Module not found", code: "NOT_FOUND" } }, 404);
  }
  if (existing.userId !== user.id) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  const module = await prisma.profileModule.update({
    where: { id },
    data: {
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
    },
  });

  return c.json({ data: module });
});

// DELETE /:id — delete own module
profileModulesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const id = c.req.param("id");

  const existing = await prisma.profileModule.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Module not found", code: "NOT_FOUND" } }, 404);
  }
  if (existing.userId !== user.id) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  await prisma.profileModule.delete({ where: { id } });

  return c.json({ data: { deleted: true } });
});

export { profileModulesRouter };
