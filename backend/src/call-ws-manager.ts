// Signaling room manager for 1:1 WebRTC calls.
// Each room has exactly 2 participants: caller and callee.
import type { WSContext } from "hono/ws";

interface Participant {
  ws: WSContext;
  userId: string;
  role: "caller" | "callee";
}

// callId → userId → Participant
const rooms = new Map<string, Map<string, Participant>>();

export const callWsManager = {
  join(
    callId: string,
    userId: string,
    role: "caller" | "callee",
    ws: Participant["ws"]
  ): void {
    if (!rooms.has(callId)) rooms.set(callId, new Map());
    const room = rooms.get(callId)!;
    room.set(userId, { ws, userId, role });

    // Send role to new participant
    ws.send(JSON.stringify({ type: "role", role }));

    // If both participants are now present, notify everyone
    if (room.size === 2) {
      for (const [, p] of room) {
        p.ws.send(JSON.stringify({ type: "peer-joined" }));
      }
    }
  },

  relay(callId: string, fromUserId: string, data: object): void {
    const room = rooms.get(callId);
    if (!room) return;
    // Relay message to the other participant
    for (const [uid, p] of room) {
      if (uid !== fromUserId) p.ws.send(JSON.stringify(data));
    }
  },

  leave(callId: string, userId: string): void {
    const room = rooms.get(callId);
    if (!room) return;
    room.delete(userId);
    // Notify remaining participant
    for (const [, p] of room) {
      p.ws.send(JSON.stringify({ type: "peer-left" }));
    }
    if (room.size === 0) rooms.delete(callId);
  },
};
