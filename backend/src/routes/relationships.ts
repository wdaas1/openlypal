import { Hono } from "hono";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const relationshipsRouter = new Hono<{ Variables: Variables }>();

// Auth guard helper
function requireAuth(c: { get: (key: "user") => Variables["user"] }) {
  const user = c.get("user");
  if (!user) return null;
  return user;
}

// Composite strength score: messageCount*3 (cap 60) + likeCount*2 (cap 20) + commentCount*2 (cap 20)
function computeStrengthScore(messageCount: number, likeCount: number, commentCount: number): number {
  const msgPts = Math.min(messageCount * 3, 60);
  const likePts = Math.min(likeCount * 2, 20);
  const cmtPts = Math.min(commentCount * 2, 20);
  return Math.min(msgPts + likePts + cmtPts, 100);
}

// Return the most recent date from a list, or null if list is empty
function maxDate(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

// Compute days since a given date (floor)
function daysSince(date: Date | null): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

interface RelationshipStats {
  user: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  lastInteractionAt: string | null;
  daysSince: number;
  messageCount: number;
  likeCount: number;
  commentCount: number;
  strengthScore: number;
  isDrifting: boolean;
}

async function buildRelationshipStats(
  currentUserId: string,
  followedUserId: string,
  followedUser: { id: string; name: string; username: string | null; image: string | null }
): Promise<RelationshipStats> {
  // Messages between the pair (either direction)
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: followedUserId },
        { senderId: followedUserId, receiverId: currentUserId },
      ],
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000, // reasonable cap
  });

  const messageCount = messages.length;
  const latestMessage = messages[0]?.createdAt ?? null;

  // Likes the current user gave on the followed user's posts
  const likes = await prisma.like.findMany({
    where: {
      userId: currentUserId,
      post: { userId: followedUserId },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const likeCount = likes.length;
  const latestLike = likes[0]?.createdAt ?? null;

  // Comments the current user left on the followed user's posts
  const comments = await prisma.comment.findMany({
    where: {
      userId: currentUserId,
      post: { userId: followedUserId },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const commentCount = comments.length;
  const latestComment = comments[0]?.createdAt ?? null;

  const lastInteraction = maxDate([latestMessage, latestLike, latestComment]);
  const days = daysSince(lastInteraction);
  const strengthScore = computeStrengthScore(messageCount, likeCount, commentCount);

  return {
    user: followedUser,
    lastInteractionAt: lastInteraction ? lastInteraction.toISOString() : null,
    daysSince: days === 9999 ? 9999 : days,
    messageCount,
    likeCount,
    commentCount,
    strengthScore,
    isDrifting: days > 14,
  };
}

// ─── GET /api/relationships ────────────────────────────────────────────────
// Returns interaction stats for each user the current user follows
relationshipsRouter.get("/", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

  const stats = await Promise.all(
    follows.map((f) => buildRelationshipStats(user.id, f.followingId, f.following))
  );

  return c.json({ data: stats });
});

// ─── GET /api/relationships/nudges ────────────────────────────────────────
// Returns drifting relationships (daysSince > 14), sorted by daysSince desc, limit 5
relationshipsRouter.get("/nudges", async (c) => {
  const user = requireAuth(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

  const stats = await Promise.all(
    follows.map((f) => buildRelationshipStats(user.id, f.followingId, f.following))
  );

  const nudges = stats
    .filter((s) => s.isDrifting)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  return c.json({ data: nudges });
});

export { relationshipsRouter };
