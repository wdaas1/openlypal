import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const roomsRouter = new Hono<{ Variables: Variables }>();

// Auth guard
roomsRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  await next();
});

// GET /api/rooms — list rooms the user is a member of (or owns)
roomsRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const memberships = await prisma.roomMember.findMany({
    where: { userId: user.id },
    include: {
      room: {
        include: {
          owner: { select: { id: true, name: true, username: true, image: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, username: true, image: true } },
            },
          },
          _count: { select: { posts: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  const rooms = memberships.map((m) => ({
    ...m.room,
    memberCount: m.room.members.length,
    postCount: m.room._count.posts,
  }));
  return c.json({ data: rooms });
});

// POST /api/rooms — create a room
roomsRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(50) })),
  async (c) => {
    const user = c.get("user")!;
    const { name } = c.req.valid("json");
    const room = await prisma.room.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id } }, // owner is auto-member
      },
      include: {
        owner: { select: { id: true, name: true, username: true, image: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
        _count: { select: { posts: true } },
      },
    });
    return c.json(
      { data: { ...room, memberCount: room.members.length, postCount: room._count.posts } },
      201
    );
  }
);

// GET /api/rooms/:id — get room details
roomsRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const { id } = c.req.param();
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: id, userId: user.id } },
  });
  if (!member) return c.json({ error: { message: "Not a member" } }, 403);

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, username: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      _count: { select: { posts: true } },
    },
  });
  if (!room) return c.json({ error: { message: "Room not found" } }, 404);
  return c.json({ data: { ...room, memberCount: room.members.length, postCount: room._count.posts } });
});

// PATCH /api/rooms/:id — rename room (owner only)
roomsRouter.patch(
  "/:id",
  zValidator("json", z.object({ name: z.string().min(1).max(50) })),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const { name } = c.req.valid("json");
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return c.json({ error: { message: "Not found" } }, 404);
    if (room.ownerId !== user.id)
      return c.json({ error: { message: "Only the owner can rename" } }, 403);
    const updated = await prisma.room.update({ where: { id }, data: { name } });
    return c.json({ data: updated });
  }
);

// DELETE /api/rooms/:id — delete room (owner only)
roomsRouter.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const { id } = c.req.param();
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return c.json({ error: { message: "Not found" } }, 404);
  if (room.ownerId !== user.id)
    return c.json({ error: { message: "Only the owner can delete" } }, 403);
  await prisma.room.delete({ where: { id } });
  return c.body(null, 204);
});

// POST /api/rooms/:id/members — add a member
roomsRouter.post(
  "/:id/members",
  zValidator("json", z.object({ userId: z.string() })),
  async (c) => {
    const requester = c.get("user")!;
    const { id } = c.req.param();
    const { userId: targetUserId } = c.req.valid("json");
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return c.json({ error: { message: "Not found" } }, 404);
    if (room.ownerId !== requester.id)
      return c.json({ error: { message: "Only owner can add members" } }, 403);
    const existing = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: targetUserId } },
    });
    if (existing) return c.json({ error: { message: "Already a member" } }, 409);
    const member = await prisma.roomMember.create({
      data: { roomId: id, userId: targetUserId },
      include: {
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
    return c.json({ data: member }, 201);
  }
);

// DELETE /api/rooms/:id/members/:memberId — remove a member (owner or self-leave)
roomsRouter.delete("/:id/members/:memberId", async (c) => {
  const requester = c.get("user")!;
  const { id, memberId } = c.req.param();
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return c.json({ error: { message: "Not found" } }, 404);
  if (requester.id !== memberId && room.ownerId !== requester.id)
    return c.json({ error: { message: "Forbidden" } }, 403);
  await prisma.roomMember.delete({
    where: { roomId_userId: { roomId: id, userId: memberId } },
  });
  return c.body(null, 204);
});

// GET /api/rooms/:id/posts — posts in a room
roomsRouter.get("/:id/posts", async (c) => {
  const user = c.get("user")!;
  const { id } = c.req.param();
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: id, userId: user.id } },
  });
  if (!member) return c.json({ error: { message: "Not a member" } }, 403);
  const posts = await prisma.post.findMany({
    where: { roomId: id, hidden: false },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true, reblogs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const mapped = posts.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    content: p.content,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl,
    linkUrl: p.linkUrl,
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    category: p.category,
    isExplicit: p.isExplicit,
    roomId: p.roomId,
    user: p.user,
    likeCount: p.likes.length,
    liked: p.likes.some((l) => l.userId === user.id),
    commentCount: p._count.comments,
    reblogCount: p._count.reblogs,
    createdAt: p.createdAt,
  }));
  return c.json({ data: mapped });
});

export { roomsRouter };
