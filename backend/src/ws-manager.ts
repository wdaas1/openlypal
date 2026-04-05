import type { WSContext } from "hono/ws";

type WsClient = {
  ws: WSContext;
  userId: string;
  userName: string;
};

// momentId -> Map<userId, WsClient>
const rooms = new Map<string, Map<string, WsClient>>();

export const wsManager = {
  join(momentId: string, userId: string, userName: string, ws: WSContext) {
    if (!rooms.has(momentId)) rooms.set(momentId, new Map());
    rooms.get(momentId)!.set(userId, { ws, userId, userName });
  },

  leave(momentId: string, userId: string) {
    const room = rooms.get(momentId);
    if (!room) return;
    room.delete(userId);
    if (room.size === 0) rooms.delete(momentId);
  },

  // Broadcast to all clients in a moment, optionally excluding one userId
  broadcast(momentId: string, excludeUserId: string | null, data: object) {
    const room = rooms.get(momentId);
    if (!room) return;
    const msg = JSON.stringify(data);
    for (const [uid, client] of room) {
      if (uid === excludeUserId) continue;
      try {
        client.ws.send(msg);
      } catch {
        // Client disconnected - clean up
        room.delete(uid);
      }
    }
  },
};
