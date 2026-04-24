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

// GET /api/calls/webview/:callId — serves the WebRTC call HTML page (loaded in mobile WebView)
callsRouter.get("/webview/:callId", async (c) => {
  const callId = c.req.param("callId");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Call</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000d1a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
    video { background: #111; display: block; }
    #remote-video { width: 100vw; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; }
    #local-video { position: fixed; top: env(safe-area-inset-top, 20px); right: 16px; margin-top: 16px; width: 90px; height: 130px; object-fit: cover; border-radius: 14px; border: 2px solid rgba(255,255,255,0.25); z-index: 10; }
    #other-name { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 56px); left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 700; z-index: 5; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }
    #status { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; font-size: 15px; color: rgba(255,255,255,0.6); z-index: 5; padding: 0 32px; }
    #controls { position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 44px); left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 24px; z-index: 10; }
    .btn { width: 64px; height: 64px; border-radius: 50%; border: none; outline: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 26px; -webkit-tap-highlight-color: transparent; }
    #hangup-btn { background: #FF3B30; }
    #mute-btn, #cam-btn { background: rgba(255,255,255,0.18); }
    .btn:active { opacity: 0.6; transform: scale(0.96); }
    #audio-avatar { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -70%); width: 100px; height: 100px; border-radius: 50%; background: rgba(0,207,53,0.2); border: 2px solid rgba(0,207,53,0.4); display: none; align-items: center; justify-content: center; font-size: 44px; }
  </style>
</head>
<body>
  <video id="remote-video" autoplay playsinline></video>
  <video id="local-video" autoplay playsinline muted></video>
  <div id="audio-avatar">🎙</div>
  <div id="other-name"></div>
  <div id="status">Connecting…</div>
  <div id="controls">
    <button class="btn" id="mute-btn" onclick="toggleMute()">🎤</button>
    <button class="btn" id="hangup-btn" onclick="hangup()">📵</button>
    <button class="btn" id="cam-btn" onclick="toggleCamera()">📷</button>
  </div>
  <script type="module">
    const p = new URLSearchParams(location.search);
    const callId = p.get('callId') || '${callId}';
    const token = p.get('token') || '';
    const apiKey = p.get('apiKey') || '';
    const userId = p.get('userId') || '';
    const userName = p.get('userName') || 'User';
    const otherUserName = p.get('otherUserName') || '';
    const role = p.get('role') || 'callee';
    const callType = p.get('type') || 'video';
    const isAudio = callType === 'audio';

    if (otherUserName) document.getElementById('other-name').textContent = otherUserName;
    if (isAudio) {
      document.getElementById('local-video').style.display = 'none';
      document.getElementById('remote-video').style.display = 'none';
      document.getElementById('audio-avatar').style.display = 'flex';
      document.getElementById('cam-btn').style.display = 'none';
    }

    let call = null;
    let client = null;
    let muted = false;
    let cameraOff = false;
    let pollInterval = null;

    async function init() {
      try {
        const { StreamVideoClient } = await import('https://esm.sh/@stream-io/video-client@1');
        client = new StreamVideoClient({ apiKey, user: { id: userId, name: userName }, token });
        call = client.call('default', callId);

        await call.join({ create: role === 'caller' });

        // Explicitly publish media — SDK does NOT auto-start without these calls
        if (!isAudio) {
          try { await call.camera.enable(); } catch {}
        }
        try { await call.microphone.enable(); } catch {}

        document.getElementById('status').style.display = 'none';

        function applyStreams(participants) {
          for (const participant of participants) {
            try {
              if (participant.isLocalParticipant) {
                if (!isAudio && participant.videoStream) {
                  const el = document.getElementById('local-video');
                  if (el.srcObject !== participant.videoStream) el.srcObject = participant.videoStream;
                }
              } else {
                if (participant.videoStream) {
                  const el = document.getElementById('remote-video');
                  if (el.srcObject !== participant.videoStream) el.srcObject = participant.videoStream;
                }
                if (participant.audioStream) {
                  const audioId = 'audio-' + participant.userId;
                  let el = document.getElementById(audioId);
                  if (!el) {
                    el = document.createElement('audio');
                    el.id = audioId;
                    el.autoplay = true;
                    document.body.appendChild(el);
                  }
                  if (el.srcObject !== participant.audioStream) el.srcObject = participant.audioStream;
                }
              }
            } catch {}
          }
        }

        call.state.participants$.subscribe(applyStreams);

        // Polling fallback: catches streams that arrive between observable emissions
        pollInterval = setInterval(() => {
          try { applyStreams(call.state.participants); } catch {}
        }, 1500);
      } catch (e) {
        document.getElementById('status').textContent = 'Failed to connect: ' + (e.message || String(e));
      }
    }

    window.hangup = async function() {
      try { clearInterval(pollInterval); } catch {}
      try { if (call) await call.leave(); } catch {}
      try { if (client) await client.disconnectUser(); } catch {}
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hangup' }));
      }
    };

    window.toggleMute = function() {
      if (!call) return;
      muted = !muted;
      muted ? call.microphone.disable() : call.microphone.enable();
      document.getElementById('mute-btn').textContent = muted ? '🔇' : '🎤';
    };

    window.toggleCamera = function() {
      if (!call || isAudio) return;
      cameraOff = !cameraOff;
      cameraOff ? call.camera.disable() : call.camera.enable();
      document.getElementById('cam-btn').textContent = cameraOff ? '📵' : '📷';
    };

    init();
  </script>
</body>
</html>`;

  return c.html(html);
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

// GET /api/calls/stream-token — returns a Stream Video user token for the authenticated user
callsRouter.get("/stream-token", requireAuth, async (c) => {
  const user = c.get("user")!;
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return c.json({ error: { message: "Stream Video not configured" } }, 503);
  }

  try {
    const { StreamClient } = await import("@stream-io/node-sdk");
    const client = new StreamClient(apiKey, apiSecret);
    const token = client.generateUserToken({ user_id: user.id });
    return c.json({ data: { token, apiKey } });
  } catch (e: any) {
    return c.json({ error: { message: "Failed to generate Stream token" } }, 500);
  }
});

export { callsRouter };
