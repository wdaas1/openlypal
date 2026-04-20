import { Hono } from "hono";
import { AccessToken } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { env } from "../env";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const streamingRouter = new Hono<{ Variables: Variables }>();

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isLiveKitConfigured(): boolean {
  return Boolean(env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL);
}

async function generateToken(
  roomName: string,
  userId: string,
  userName: string,
  canPublish: boolean
): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
    identity: userId,
    name: userName,
    ttl: 7200, // 2 hours in seconds
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    ...(canPublish && { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] }),
  });
  return await at.toJwt();
}

// ─── POST /api/livekit/token ────────────────────────────────────────────────
// Unified token endpoint for publishers and viewers
streamingRouter.post("/api/livekit/token", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  if (!isLiveKitConfigured()) {
    return c.json(
      { error: { message: "Streaming not configured. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL env vars.", code: "NOT_CONFIGURED" } },
      503
    );
  }

  const body = await c.req.json<{ momentId?: string; role?: string }>();
  const { momentId, role } = body;

  if (!momentId || (role !== "publisher" && role !== "viewer")) {
    return c.json(
      { error: { message: "momentId and role ('publisher' | 'viewer') are required", code: "BAD_REQUEST" } },
      400
    );
  }

  const moment = await prisma.liveMoment.findUnique({
    where: { id: momentId },
    select: { creatorId: true, invitedUserIds: true, status: true, isLive: true },
  });

  if (!moment) {
    return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  }

  if (moment.status === "ended") {
    return c.json({ error: { message: "Moment has ended", code: "MOMENT_ENDED" } }, 400);
  }

  const isCreator = moment.creatorId === user.id;
  const invitedIds = parseJsonArray(moment.invitedUserIds);
  const isInvited = invitedIds.includes(user.id);

  if (role === "publisher") {
    if (!isCreator) {
      return c.json({ error: { message: "Forbidden: only the creator can publish", code: "FORBIDDEN" } }, 403);
    }
    // Mark moment as live when publisher joins
    await prisma.liveMoment.update({
      where: { id: momentId },
      data: { isLive: true },
    });
  } else {
    // viewer
    if (!isCreator && !isInvited) {
      return c.json({ error: { message: "Forbidden: you are not invited to this moment", code: "FORBIDDEN" } }, 403);
    }
    if (!moment.isLive) {
      return c.json({ error: { message: "Stream has not started yet", code: "NOT_LIVE" } }, 400);
    }
  }

  const roomName = `moment-${momentId}`;
  const canPublish = role === "publisher";
  const token = await generateToken(roomName, user.id, user.name, canPublish);

  return c.json({
    data: {
      token,
      wsUrl: env.LIVEKIT_URL!,
      roomName,
    },
  });
});

// ─── POST /api/stream/live-moments/:id/start ───────────────────────────────
// Creator starts a stream for their moment
streamingRouter.post("/api/stream/live-moments/:id/start", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  if (!isLiveKitConfigured()) {
    return c.json({ error: { message: "Streaming not configured. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL env vars.", code: "NOT_CONFIGURED" } }, 503);
  }

  const { id } = c.req.param();
  const moment = await prisma.liveMoment.findUnique({
    where: { id },
    select: { creatorId: true, invitedUserIds: true, status: true },
  });

  if (!moment) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  if (moment.creatorId !== user.id) return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  if (moment.status === "ended") return c.json({ error: { message: "Moment has ended", code: "MOMENT_ENDED" } }, 400);

  // Use moment ID as room name (stable, unique)
  const roomName = `moment-${id}`;

  // Mark moment as live
  await prisma.liveMoment.update({
    where: { id },
    data: { isLive: true },
  });

  const token = await generateToken(roomName, user.id, user.name, true);

  return c.json({
    data: {
      token,
      wsUrl: env.LIVEKIT_URL!,
      roomName,
    },
  });
});

// ─── GET /api/stream/live-moments/:id/viewer-token ─────────────────────────
// Member gets a viewer token for an ongoing stream
streamingRouter.get("/api/stream/live-moments/:id/viewer-token", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  if (!isLiveKitConfigured()) {
    return c.json({ error: { message: "Streaming not configured", code: "NOT_CONFIGURED" } }, 503);
  }

  const { id } = c.req.param();
  const moment = await prisma.liveMoment.findUnique({
    where: { id },
    select: { creatorId: true, invitedUserIds: true, status: true, isLive: true },
  });

  if (!moment) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);

  const invitedIds = parseJsonArray(moment.invitedUserIds);
  const isCreator = moment.creatorId === user.id;
  const isInvited = invitedIds.includes(user.id);
  if (!isCreator && !isInvited) return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  if (!moment.isLive) return c.json({ error: { message: "Stream not started", code: "NOT_LIVE" } }, 400);

  const roomName = `moment-${id}`;
  const token = await generateToken(roomName, user.id, user.name, false);

  return c.json({
    data: {
      token,
      wsUrl: env.LIVEKIT_URL!,
      roomName,
    },
  });
});

// ─── GET /stream/:momentId ─────────────────────────────────────────────────
// Serves the LiveKit streaming HTML page (embedded in WebView)
streamingRouter.get("/stream/:momentId", async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Live Stream</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
    #container video { width: 100%; height: 100%; object-fit: cover; }
    #status { position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
               background: rgba(0,0,0,0.6); color: #fff; padding: 5px 14px;
               border-radius: 20px; font-size: 12px; z-index: 10; white-space: nowrap; }
    #placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center;
                   gap: 12px; color: rgba(255,255,255,0.4); font-size: 14px; }
    #controls { position: fixed; bottom: 16px; right: 16px; display: flex; gap: 10px; z-index: 10; }
    .btn { width: 44px; height: 44px; border-radius: 22px; border: none;
           background: rgba(255,255,255,0.15); color: #fff; font-size: 18px;
           cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn.off { background: rgba(255,59,48,0.6); }
  </style>
</head>
<body>
  <div id="container">
    <div id="placeholder">
      <span style="font-size:40px">📡</span>
      <span id="placeholderText">Connecting...</span>
    </div>
  </div>
  <div id="status">Connecting...</div>
  <div id="controls" style="display:none">
    <button class="btn" id="muteBtn">🎤</button>
    <button class="btn" id="vidBtn">📹</button>
  </div>
  <script>
    const p = new URLSearchParams(location.search);
    const token = p.get('token');
    const wsUrl = p.get('url');
    const isPublisher = p.get('role') === 'publisher';

    function setStatus(msg) { document.getElementById('status').textContent = msg; }

    function showVideo(track, isLocal) {
      const el = track.attach();
      el.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      if (isLocal) el.muted = true;
      el.playsInline = true;
      const container = document.getElementById('container');
      const placeholder = document.getElementById('placeholder');
      if (placeholder) placeholder.remove();
      container.appendChild(el);
    }

    function loadLiveKit(callback) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
      script.onload = callback;
      script.onerror = function() {
        setStatus('Error: failed to load streaming library');
        document.getElementById('placeholderText').textContent = 'Check your connection and reload';
      };
      document.head.appendChild(script);
    }

    async function toggleAudio(room) {
      const enabled = room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(!enabled);
      document.getElementById('muteBtn').className = 'btn' + (enabled ? ' off' : '');
    }

    async function toggleVideo(room) {
      const enabled = room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(!enabled);
      document.getElementById('vidBtn').className = 'btn' + (enabled ? ' off' : '');
    }

    async function main() {
      if (!token || !wsUrl) { setStatus('Error: missing credentials'); return; }
      const { Room, RoomEvent, Track } = LivekitClient;
      const room = new Room({ adaptiveStream: true, dynacast: true });

      document.getElementById('muteBtn').onclick = function() { toggleAudio(room); };
      document.getElementById('vidBtn').onclick = function() { toggleVideo(room); };

      room.on(RoomEvent.TrackSubscribed, function(track) {
        if (track.kind === Track.Kind.Video) {
          showVideo(track, false);
          setStatus('🔴 LIVE');
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, function() {
        if (!isPublisher) setStatus('Host disconnected');
      });

      room.on(RoomEvent.Disconnected, function() { setStatus('Disconnected'); });

      room.on(RoomEvent.LocalTrackPublished, function(pub) {
        if (pub.kind === Track.Kind.Video && pub.videoTrack) {
          showVideo(pub.videoTrack, true);
        }
      });

      try {
        setStatus('Connecting...');
        const connectTimeout = setTimeout(function() {
          setStatus('Error: connection timed out');
          document.getElementById('placeholderText').textContent = 'Could not connect to the stream';
        }, 15000);

        await room.connect(wsUrl, token);
        clearTimeout(connectTimeout);

        if (isPublisher) {
          setStatus('🔴 LIVE');
          document.getElementById('controls').style.display = 'flex';
          try {
            const camPub = await room.localParticipant.setCameraEnabled(true);
            await room.localParticipant.setMicrophoneEnabled(true);
            if (camPub && camPub.videoTrack) showVideo(camPub.videoTrack, true);
          } catch(camErr) {
            setStatus('🔴 LIVE (camera unavailable)');
          }
        } else {
          setStatus('Waiting for host...');
          document.getElementById('placeholderText').textContent = 'Waiting for host to go live...';
          for (const participant of room.remoteParticipants.values()) {
            for (const pub of participant.trackPublications.values()) {
              if (pub.isSubscribed && pub.track && pub.kind === Track.Kind.Video) {
                showVideo(pub.track, false);
                setStatus('🔴 LIVE');
              }
            }
          }
        }
      } catch(e) {
        setStatus('Error: ' + (e.message || 'connection failed'));
        document.getElementById('placeholderText').textContent = e.message || 'Failed to connect';
      }
    }

    loadLiveKit(main);
  </script>
</body>
</html>`;

  return c.html(html);
});

export { streamingRouter };
