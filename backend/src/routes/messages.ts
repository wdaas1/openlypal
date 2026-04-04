import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const messagesRouter = new Hono<{ Variables: Variables }>();

// GET /conversations - List all conversations for current user
messagesRouter.get("/conversations", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  // Get all messages involving the current user
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: user.id }, { receiverId: user.id }],
    },
    include: {
      sender: { select: { id: true, name: true, username: true, image: true } },
      receiver: { select: { id: true, name: true, username: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by conversation partner, picking the latest message per partner
  const conversationMap = new Map<
    string,
    {
      userId: string;
      user: { id: string; name: string; username: string | null; image: string | null };
      lastMessage: { content: string; createdAt: string };
      unreadCount: number;
    }
  >();

  for (const msg of messages) {
    const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
    const partner = msg.senderId === user.id ? msg.receiver : msg.sender;

    if (!conversationMap.has(partnerId)) {
      // This is the latest message for this partner (messages are desc ordered)
      conversationMap.set(partnerId, {
        userId: partnerId,
        user: partner,
        lastMessage: {
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        },
        unreadCount: 0,
      });
    }

    // Count unread messages sent TO current user FROM this partner
    if (msg.receiverId === user.id && !msg.read) {
      const conv = conversationMap.get(partnerId)!;
      conv.unreadCount += 1;
    }
  }

  const data = Array.from(conversationMap.values());
  return c.json({ data });
});

// GET /conversations/:userId - Get all messages between current user and userId
messagesRouter.get("/conversations/:userId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const partnerId = c.req.param("userId");

  const partner = await prisma.user.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true, username: true, image: true },
  });

  if (!partner) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: partnerId },
        { senderId: partnerId, receiverId: user.id },
      ],
    },
    include: {
      sender: { select: { id: true, name: true, username: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = messages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    read: msg.read,
    encrypted: msg.encrypted,
    createdAt: msg.createdAt.toISOString(),
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    sender: msg.sender,
  }));

  return c.json({ data });
});

// POST /conversations/:userId - Send a message to userId
const sendMessageSchema = z.object({
  content: z.string().min(1),
  encrypted: z.boolean().optional(),
});

messagesRouter.post(
  "/conversations/:userId",
  zValidator("json", sendMessageSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

    const senderProfile = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
    if (senderProfile?.status === "banned") {
      return c.json({ error: { message: "Your account has been suspended.", code: "BANNED" } }, 403);
    }

    const receiverId = c.req.param("userId");

    if (receiverId === user.id) {
      return c.json(
        { error: { message: "Cannot message yourself", code: "BAD_REQUEST" } },
        400
      );
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
    }

    const body = c.req.valid("json");

    const message = await prisma.message.create({
      data: {
        content: body.content,
        senderId: user.id,
        receiverId,
        encrypted: body.encrypted ?? false,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, image: true } },
      },
    });

    return c.json({
      data: {
        id: message.id,
        content: message.content,
        read: message.read,
        encrypted: message.encrypted,
        createdAt: message.createdAt.toISOString(),
        senderId: message.senderId,
        receiverId: message.receiverId,
        sender: message.sender,
      },
    });
  }
);

// PATCH /conversations/:userId/read - Mark all messages from userId as read
messagesRouter.patch("/conversations/:userId/read", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const senderId = c.req.param("userId");

  await prisma.message.updateMany({
    where: {
      senderId,
      receiverId: user.id,
      read: false,
    },
    data: { read: true },
  });

  return c.json({ data: { success: true } });
});

// DELETE /conversations/:userId - Delete all messages between current user and userId
messagesRouter.delete("/conversations/:userId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const partnerId = c.req.param("userId");

  await prisma.message.deleteMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: partnerId },
        { senderId: partnerId, receiverId: user.id },
      ],
    },
  });

  return c.json({ data: { success: true } });
});

export { messagesRouter };
