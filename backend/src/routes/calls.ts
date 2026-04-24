import { Hono, type Context, type Next } from "hono";
import { prisma } from "../prisma";
import { sendPushNotification } from "../lib/push-notifications";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null; username?: string | null } | null;
  session: { id: string } | null;
};

type Env = { Variables: Variables };

const callsRouter = new Hono<Env>();

async function requireAuth(c: Context<Env>, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }
  return next();
}

// GET /api/calls/incoming — Poll for incoming ringing call (callee polls)
callsRouter.get("/incoming", requireAuth, async (c) => {
  const user = c.get("user")!;

  const call = await prisma.call.findFirst({
    where: { calleeId: user.id, status: "ringing" },
    orderBy: { createdAt: "desc" },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  // Auto-expire calls older than 60 seconds
  if (call && new Date().getTime() - new Date(call.createdAt).getTime() > 60000) {
    await prisma.call.update({
      where: { id: call.id },
      data: { status: "missed", endedAt: new Date() },
    });
    return c.json({ data: { call: null } });
  }

  return c.json({ data: { call: call ?? null } });
});

// GET /api/calls — Call history for the current user
callsRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;

  const history = await prisma.call.findMany({
    where: {
      OR: [{ callerId: user.id }, { calleeId: user.id }],
      status: { not: "ringing" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      caller: { select: { id: true, name: true, username: true, image: true } },
      callee: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return c.json({ data: { calls: history } });
});

// POST /api/calls — Initiate a call
callsRouter.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { calleeId, type = "video" } = await c.req.json<{ calleeId?: string; type?: string }>();

  if (!calleeId) return c.json({ error: { message: "calleeId required" } }, 400);
  if (calleeId === user.id) return c.json({ error: { message: "Cannot call yourself" } }, 400);

  const callee = await prisma.user.findUnique({ where: { id: calleeId } });
  if (!callee) return c.json({ error: { message: "User not found" } }, 404);

  // End any existing active/ringing calls for this user
  await prisma.call.updateMany({
    where: {
      OR: [{ callerId: user.id }, { calleeId: user.id }],
      status: { in: ["ringing", "active"] },
    },
    data: { status: "ended", endedAt: new Date() },
  });

  const call = await prisma.call.create({
    data: { callerId: user.id, calleeId, type },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true } },
      callee: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  // Send push notification to callee (non-fatal)
  if (callee.pushToken) {
    try {
      await sendPushNotification(
        callee.pushToken,
        `${user.name} is calling`,
        type === "video" ? "Incoming video call" : "Incoming voice call",
        { type: "incoming_call", callId: call.id }
      );
    } catch {
      // Non-fatal
    }
  }

  return c.json({ data: { call } });
});

// POST /api/calls/:id/accept — Callee accepts the call
callsRouter.post("/:id/accept", requireAuth, async (c) => {
  const user = c.get("user")!;
  const callId = c.req.param("id");

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return c.json({ error: { message: "Call not found" } }, 404);
  if (call.calleeId !== user.id) return c.json({ error: { message: "Forbidden" } }, 403);
  if (call.status !== "ringing") return c.json({ error: { message: "Call is no longer ringing" } }, 400);

  await prisma.call.update({
    where: { id: callId },
    data: { status: "active", startedAt: new Date() },
  });

  return c.json({ data: {} });
});

// POST /api/calls/:id/decline — Callee or caller declines the call
callsRouter.post("/:id/decline", requireAuth, async (c) => {
  const user = c.get("user")!;
  const callId = c.req.param("id");

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return c.json({ error: { message: "Call not found" } }, 404);
  if (call.calleeId !== user.id && call.callerId !== user.id) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  await prisma.call.update({
    where: { id: callId },
    data: { status: "declined", endedAt: new Date() },
  });

  return c.json({ data: {} });
});

// POST /api/calls/:id/end — Either party ends the call
callsRouter.post("/:id/end", requireAuth, async (c) => {
  const user = c.get("user")!;
  const callId = c.req.param("id");

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return c.json({ error: { message: "Call not found" } }, 404);
  if (call.callerId !== user.id && call.calleeId !== user.id) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  await prisma.call.update({
    where: { id: callId },
    data: { status: "ended", endedAt: new Date() },
  });

  return c.json({ data: {} });
});

// GET /api/calls/:id — Get a specific call (caller polls to know if accepted)
callsRouter.get("/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const callId = c.req.param("id");

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true } },
      callee: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  if (!call) return c.json({ error: { message: "Call not found" } }, 404);
  if (call.callerId !== user.id && call.calleeId !== user.id) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  return c.json({ data: { call } });
});

export { callsRouter };
