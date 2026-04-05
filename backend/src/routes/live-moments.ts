import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { wsManager } from "../ws-manager";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const liveMomentsRouter = new Hono<{ Variables: Variables }>();

// Auth guard helper
function requireAuth(c: { get: (key: "user") => Variables["user"] }) {
  const user = c.get("user");
  if (!user) return null;
  return user;
}

// User select shape used across queries
const userSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
} as const;

// Parse a JSON array string safely, returning string[]
function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Fetch invited user details from DB given a list of IDs
async function fetchInvitedUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: userSelect,
  });
}

// Shape a LiveMoment DB record into the API response format
async function formatMoment(
  moment: {
    id: string;
    title: string;
    creatorId: string;
    creator: { id: string; name: string; username: string | null; image: string | null };
    roomId: string | null;
    status: string;
    isLive: boolean;
    expiresAt: Date;
    expiresAfter: number;
    invitedUserIds: string;
    viewerIds: string;
    createdAt: Date;
    _count: { messages: number };
  }
) {
  const invitedUserIds = parseJsonArray(moment.invitedUserIds);
  const viewerIds = parseJsonArray(moment.viewerIds);
  const invitedUsers = await fetchInvitedUsers(invitedUserIds);

  return {
    id: moment.id,
    title: moment.title,
    creatorId: moment.creatorId,
    creator: moment.creator,
    roomId: moment.roomId,
    status: moment.status,
    isLive: moment.isLive,
    expiresAt: moment.expiresAt,
    expiresAfter: moment.expiresAfter,
    invitedUserIds,
    viewerIds,
    invitedUsers,
    viewerCount: viewerIds.length,
    messageCount: moment._count.messages,
    createdAt: moment.createdAt,
  };
}

// Auto-expire a moment if past its expiresAt and still active
async function autoExpireIfNeeded(momentId: string, expiresAt: Date, status: string) {
  if (status === "active" && expiresAt < new Date()) {
    return prisma.liveMoment.update({
      where: { id: momentId },
      data: { status: "ended" },
      include: {
        creator: { select: userSelect },
        _count: { select: { messages: true } },
      },
    });
  }
  return null;
}

const momentInclude = {
  creator: { select: userSelect },
  _count: { select: { messages: true } },
} as const;

// ─── GET /api/live-moments ─────────────────────────────────────────────────
// Get active moments for current user (created or invited to)
liveMomentsRouter.get("/", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const now = new Date();

  // Auto-expire any moments that have passed their expiry time
  await prisma.liveMoment.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: now },
    },
    data: { status: "ended" },
  });

  // Fetch all active moments - we'll filter by creator/invited in-app
  // since invitedUserIds is stored as a JSON string
  const allActive = await prisma.liveMoment.findMany({
    where: { status: "active" },
    include: momentInclude,
    orderBy: { createdAt: "desc" },
  });

  // Filter to moments the user created or was invited to
  const userMoments = allActive.filter((m) => {
    if (m.creatorId === user.id) return true;
    const invited = parseJsonArray(m.invitedUserIds);
    return invited.includes(user.id);
  });

  const formatted = await Promise.all(userMoments.map(formatMoment));

  return c.json({ data: formatted });
});

// ─── POST /api/live-moments ────────────────────────────────────────────────
// Create a new live moment
liveMomentsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      expiresAfter: z.union([
        z.literal(30),
        z.literal(60),
        z.literal(360),
        z.literal(1440),
      ]),
      invitedUserIds: z.array(z.string()).default([]),
      roomId: z.string().optional(),
    })
  ),
  async (c) => {
    const user = requireAuth(c);
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { title, expiresAfter, invitedUserIds, roomId } = c.req.valid("json");

    // If roomId provided, verify user is a member or owner of that room
    if (roomId) {
      const membership = await prisma.roomMember.findFirst({
        where: { roomId, userId: user.id },
      });
      if (!membership) {
        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { ownerId: true } });
        if (!room || room.ownerId !== user.id) {
          return c.json({ error: { message: "Forbidden: not a member of this room", code: "FORBIDDEN" } }, 403);
        }
      }
    }

    const expiresAt = new Date(Date.now() + expiresAfter * 60 * 1000);

    const moment = await prisma.liveMoment.create({
      data: {
        title,
        creatorId: user.id,
        expiresAfter,
        expiresAt,
        invitedUserIds: JSON.stringify(invitedUserIds),
        viewerIds: JSON.stringify([]),
        roomId: roomId ?? null,
      },
      include: momentInclude,
    });

    const formatted = await formatMoment(moment);
    return c.json({ data: formatted }, 201);
  }
);

// ─── GET /api/live-moments/:id ─────────────────────────────────────────────
// Get a specific moment (creator or invited user)
liveMomentsRouter.get("/:id", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();

  let moment = await prisma.liveMoment.findUnique({
    where: { id },
    include: momentInclude,
  });

  if (!moment) {
    return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  }

  // Check access
  const invitedIds = parseJsonArray(moment.invitedUserIds);
  const isCreator = moment.creatorId === user.id;
  const isInvited = invitedIds.includes(user.id);

  if (!isCreator && !isInvited) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  // Auto-expire if needed
  const expired = await autoExpireIfNeeded(moment.id, moment.expiresAt, moment.status);
  if (expired) {
    moment = expired;
  }

  const formatted = await formatMoment(moment);
  return c.json({ data: formatted });
});

// ─── PATCH /api/live-moments/:id ──────────────────────────────────────────
// End a moment early (creator only)
liveMomentsRouter.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      status: z.literal("ended"),
    })
  ),
  async (c) => {
    const user = requireAuth(c);
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { id } = c.req.param();

    const moment = await prisma.liveMoment.findUnique({
      where: { id },
      select: { creatorId: true },
    });

    if (!moment) {
      return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
    }

    if (moment.creatorId !== user.id) {
      return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
    }

    const updated = await prisma.liveMoment.update({
      where: { id },
      data: { status: "ended" },
      include: momentInclude,
    });

    const formatted = await formatMoment(updated);
    return c.json({ data: formatted });
  }
);

// ─── PATCH /api/live-moments/:id/go-live ──────────────────────────────────
// Set isLive to true (creator only, only if still active)
liveMomentsRouter.patch("/:id/go-live", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const moment = await prisma.liveMoment.findUnique({ where: { id: c.req.param("id") } });
  if (!moment) return c.json({ error: { message: "Not found" } }, 404);
  if (moment.creatorId !== user.id) return c.json({ error: { message: "Forbidden" } }, 403);
  if (moment.status === "ended") return c.json({ error: { message: "Moment has ended" } }, 400);

  const updated = await prisma.liveMoment.update({
    where: { id: moment.id },
    data: { isLive: true },
    include: momentInclude,
  });

  const formatted = await formatMoment(updated);
  return c.json({ data: formatted });
});

// ─── GET /api/live-moments/:id/messages ───────────────────────────────────
// Get messages for a moment (paginated, newest-first then reversed for display)
liveMomentsRouter.get("/:id/messages", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();
  const limitParam = c.req.query("limit");
  const cursorParam = c.req.query("cursor");
  const limit = Math.min(Number(limitParam) || 50, 100);

  const moment = await prisma.liveMoment.findUnique({
    where: { id },
    select: { creatorId: true, invitedUserIds: true },
  });

  if (!moment) {
    return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  }

  const invitedIds = parseJsonArray(moment.invitedUserIds);
  const isCreator = moment.creatorId === user.id;
  const isInvited = invitedIds.includes(user.id);

  if (!isCreator && !isInvited) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  const messages = await prisma.liveMomentMessage.findMany({
    where: { momentId: id },
    include: {
      user: { select: userSelect },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursorParam ? { cursor: { id: cursorParam }, skip: 1 } : {}),
  });

  // Reverse for chronological display (oldest first)
  const ordered = [...messages].reverse();

  return c.json({ data: ordered.map((m) => ({
    id: m.id,
    momentId: m.momentId,
    userId: m.userId,
    user: m.user,
    content: m.content,
    contentUrl: m.contentUrl ?? null,
    type: m.type,
    createdAt: m.createdAt,
  })) });
});

// ─── POST /api/live-moments/:id/messages ──────────────────────────────────
// Send a message to a moment
liveMomentsRouter.post(
  "/:id/messages",
  zValidator(
    "json",
    z.object({
      content: z.string().min(1),
      type: z.enum(["text", "image", "reaction", "video"]).default("text"),
      contentUrl: z.string().optional(),
    })
  ),
  async (c) => {
    const user = requireAuth(c);
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { id } = c.req.param();
    const { content, type, contentUrl } = c.req.valid("json");

    const moment = await prisma.liveMoment.findUnique({
      where: { id },
      select: { creatorId: true, invitedUserIds: true, status: true, expiresAt: true },
    });

    if (!moment) {
      return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
    }

    // Check if moment is still active
    if (moment.status === "ended" || moment.expiresAt < new Date()) {
      return c.json({ error: { message: "This moment has ended", code: "MOMENT_ENDED" } }, 400);
    }

    const invitedIds = parseJsonArray(moment.invitedUserIds);
    const isCreator = moment.creatorId === user.id;
    const isInvited = invitedIds.includes(user.id);

    if (!isCreator && !isInvited) {
      return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
    }

    const message = await prisma.liveMomentMessage.create({
      data: {
        momentId: id,
        userId: user.id,
        content,
        type,
        contentUrl: contentUrl ?? null,
      },
      include: {
        user: { select: userSelect },
      },
    });

    const formattedMsg = {
      id: message.id,
      momentId: message.momentId,
      userId: message.userId,
      user: message.user,
      content: message.content,
      contentUrl: message.contentUrl ?? null,
      type: message.type,
      createdAt: message.createdAt,
    };

    // Broadcast to all other WS clients in this moment (sender gets REST response)
    wsManager.broadcast(id, user.id, { type: "message", data: formattedMsg });

    return c.json({ data: formattedMsg }, 201);
  }
);

// ─── POST /api/live-moments/:id/join ──────────────────────────────────────
// Mark user as joined (add to viewerIds)
liveMomentsRouter.post("/:id/join", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();

  const moment = await prisma.liveMoment.findUnique({
    where: { id },
    select: { creatorId: true, invitedUserIds: true, viewerIds: true, status: true, expiresAt: true },
  });

  if (!moment) {
    return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  }

  if (moment.status === "ended" || moment.expiresAt < new Date()) {
    return c.json({ error: { message: "This moment has ended", code: "MOMENT_ENDED" } }, 400);
  }

  const invitedIds = parseJsonArray(moment.invitedUserIds);
  const isCreator = moment.creatorId === user.id;
  const isInvited = invitedIds.includes(user.id);

  if (!isCreator && !isInvited) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  const viewerIds = parseJsonArray(moment.viewerIds);

  if (!viewerIds.includes(user.id)) {
    viewerIds.push(user.id);
    await prisma.liveMoment.update({
      where: { id },
      data: { viewerIds: JSON.stringify(viewerIds) },
    });
  }

  return c.json({ data: { viewerCount: viewerIds.length } });
});

// ─── POST /api/live-moments/:id/leave ─────────────────────────────────────
// Remove user from viewerIds
liveMomentsRouter.post("/:id/leave", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();

  const moment = await prisma.liveMoment.findUnique({
    where: { id },
    select: { viewerIds: true },
  });

  if (!moment) {
    return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  }

  const viewerIds = parseJsonArray(moment.viewerIds).filter((uid) => uid !== user.id);

  await prisma.liveMoment.update({
    where: { id },
    data: { viewerIds: JSON.stringify(viewerIds) },
  });

  return c.json({ data: { viewerCount: viewerIds.length } });
});

// ─── POST /api/live-moments/:id/invite ────────────────────────────────────
// Invite more users to a moment (creator only)
liveMomentsRouter.post(
  "/:id/invite",
  zValidator(
    "json",
    z.object({
      userIds: z.array(z.string()).min(1),
    })
  ),
  async (c) => {
    const user = requireAuth(c);
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { id } = c.req.param();
    const { userIds } = c.req.valid("json");

    const moment = await prisma.liveMoment.findUnique({
      where: { id },
      select: { creatorId: true, invitedUserIds: true, status: true },
    });

    if (!moment) {
      return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
    }

    if (moment.creatorId !== user.id) {
      return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
    }

    if (moment.status === "ended") {
      return c.json({ error: { message: "This moment has ended", code: "MOMENT_ENDED" } }, 400);
    }

    const existing = parseJsonArray(moment.invitedUserIds);
    const merged = Array.from(new Set([...existing, ...userIds]));

    const updated = await prisma.liveMoment.update({
      where: { id },
      data: { invitedUserIds: JSON.stringify(merged) },
      include: momentInclude,
    });

    const formatted = await formatMoment(updated);
    return c.json({ data: formatted });
  }
);

export { liveMomentsRouter };
