import { Hono } from "hono";
import { AccessToken } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { env } from "../env";
import { prisma } from "../prisma";
import { readFileSync } from "fs";
import { join } from "path";

// Read livekit-client UMD bundle once at startup and cache it
let livekitBundle: string | null = null;
function getLiveKitBundle(): string {
  if (!livekitBundle) {
    const bundlePath = join(
      import.meta.dir,
      "../../node_modules/livekit-client/dist/livekit-client.umd.js"
    );
    livekitBundle = readFileSync(bundlePath, "utf-8");
  }
  return livekitBundle;
}

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

// ─── GET /livekit-client.js ────────────────────────────────────────────────
// Serves the bundled LiveKit browser client with long-lived cache
streamingRouter.get("/livekit-client.js", (c) => {
  const bundle = getLiveKitBundle();
  c.header("Content-Type", "application/javascript");
  c.header("Cache-Control", "public, max-age=86400, immutable");
  return c.body(bundle);
});

// ─── GET /stream/:momentId ─────────────────────────────────────────────────
// Serves the LiveKit streaming HTML page (embedded in WebView)
streamingRouter.get("/stream/:momentId", async (c) => {
  // Derive base URL so the self-hosted livekit-client.js can be referenced
  const reqUrl = new URL(c.req.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Live Stream</title>
  <!-- Self-hosted LiveKit client — loaded before body, cached for 24h -->
  <script src="${baseUrl}/livekit-client.js"></script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    #root {
      width: 100%; height: 100%;
      position: relative;
      display: flex; align-items: center; justify-content: center;
      background: #000;
    }
    video {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      background: #000;
    }
    #placeholder {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px;
      color: rgba(255,255,255,0.35);
      font-size: 13px;
      letter-spacing: 0.3px;
      text-align: center;
      padding: 20px;
      pointer-events: none;
    }
    #placeholder .icon { font-size: 36px; margin-bottom: 4px; }
    #status-bar {
      position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #fff;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      z-index: 20;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.12);
      transition: opacity 0.3s;
    }
    #controls {
      position: fixed; bottom: 20px; right: 16px;
      display: none;
      flex-direction: column;
      gap: 10px;
      z-index: 20;
    }
    .ctrl-btn {
      width: 42px; height: 42px;
      border-radius: 21px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #fff;
      font-size: 17px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s, transform 0.1s;
      -webkit-appearance: none;
      appearance: none;
    }
    .ctrl-btn:active { transform: scale(0.92); }
    .ctrl-btn.off {
      background: rgba(255,59,48,0.55);
      border-color: rgba(255,59,48,0.4);
    }
    /* Tap-to-unmute overlay for viewer */
    #tap-overlay {
      display: none;
      position: fixed; inset: 0;
      align-items: center; justify-content: center;
      z-index: 30;
      background: rgba(0,0,0,0.4);
    }
    #tap-overlay.visible { display: flex; }
    #tap-overlay button {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 30px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div id="root">
    <div id="placeholder">
      <div class="icon">&#128225;</div>
      <span id="placeholder-text">Connecting...</span>
    </div>
  </div>
  <div id="status-bar">Connecting...</div>
  <div id="controls">
    <button class="ctrl-btn" id="btn-mic" title="Toggle mic">&#127908;</button>
    <button class="ctrl-btn" id="btn-cam" title="Toggle camera">&#128249;</button>
  </div>
  <!-- Viewer tap-to-unmute overlay -->
  <div id="tap-overlay">
    <button id="tap-btn">Tap to hear audio &#128266;</button>
  </div>

  <script>
    var params = new URLSearchParams(location.search);
    var TOKEN  = params.get('token');
    var WS_URL = params.get('url');
    var IS_PUB = params.get('role') === 'publisher';

    var remoteVideoEl = null;   // viewer's remote video element
    var remoteAudioMuted = true;

    function log(msg) { console.log('[LiveKit] ' + msg); }

    function setStatus(msg) {
      log('Status: ' + msg);
      var el = document.getElementById('status-bar');
      if (el) el.textContent = msg;
    }

    function hidePlaceholder() {
      var ph = document.getElementById('placeholder');
      if (ph) ph.style.display = 'none';
    }

    // Attach a LiveKit video track to the DOM, replacing any previous video
    function attachVideo(track, isLocal) {
      log('Attaching video track, isLocal=' + isLocal);

      // Remove previous video element if any
      var existing = document.getElementById('lk-video');
      if (existing) existing.remove();

      var el = track.attach();
      el.id = 'lk-video';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.muted = true;          // always mute — unmute handled separately for remote
      el.autoplay = true;
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;';

      document.getElementById('root').appendChild(el);
      hidePlaceholder();
      log('Video element attached, attempting play...');

      var playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.then(function() {
          log('Video playing');
          if (!isLocal) {
            remoteVideoEl = el;
            // Try to unmute immediately; fall back to tap overlay
            el.muted = false;
            var unmuteTest = el.play();
            if (unmuteTest !== undefined) {
              unmuteTest.then(function() {
                remoteAudioMuted = false;
                log('Remote audio unmuted automatically');
              }).catch(function() {
                // Autoplay with audio blocked — show tap overlay
                el.muted = true;
                log('Remote audio blocked by autoplay policy — showing tap overlay');
                document.getElementById('tap-overlay').classList.add('visible');
              });
            }
          }
        }).catch(function(e) {
          log('play() failed: ' + e.message + ' — showing tap overlay');
          document.getElementById('tap-overlay').classList.add('visible');
        });
      }
    }

    // Tap overlay: user taps to unmute + force play
    document.getElementById('tap-btn').onclick = function() {
      document.getElementById('tap-overlay').classList.remove('visible');
      if (remoteVideoEl) {
        remoteVideoEl.muted = false;
        remoteVideoEl.play().catch(function(e) { log('play() after tap failed: ' + e.message); });
        remoteAudioMuted = false;
        log('Remote audio unmuted via tap');
      }
    };

    async function startPublisher(room) {
      var Track = LivekitClient.Track;
      var RoomEvent = LivekitClient.RoomEvent;

      setStatus('&#128308; LIVE');
      document.getElementById('controls').style.display = 'flex';

      room.on(RoomEvent.LocalTrackPublished, function(pub) {
        log('Local track published: ' + pub.kind);
        if (pub.kind === Track.Kind.Video && pub.videoTrack) {
          attachVideo(pub.videoTrack, true);
        }
      });

      try {
        log('Requesting getUserMedia to trigger permission dialog...');
        var rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        log('getUserMedia OK — video:' + rawStream.getVideoTracks().length + ' audio:' + rawStream.getAudioTracks().length);
        rawStream.getTracks().forEach(function(t) { t.stop(); });

        log('Publishing camera...');
        var camPub = await room.localParticipant.setCameraEnabled(true);
        log('Camera published: ' + (camPub ? (camPub.videoTrack ? 'track present' : 'no track') : 'null'));
        if (camPub && camPub.videoTrack) attachVideo(camPub.videoTrack, true);

        log('Publishing microphone...');
        await room.localParticipant.setMicrophoneEnabled(true);
        log('Microphone published');
      } catch (e) {
        var msg = e instanceof Error ? e.message : String(e);
        log('Camera/mic error: ' + msg);
        setStatus('&#128308; LIVE (cam error: ' + msg + ')');
      }

      // Toggle buttons
      var Track2 = LivekitClient.Track;
      document.getElementById('btn-mic').onclick = async function() {
        var on = room.localParticipant.isMicrophoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(!on);
        document.getElementById('btn-mic').classList.toggle('off', on);
        log('Mic ' + (on ? 'off' : 'on'));
      };
      document.getElementById('btn-cam').onclick = async function() {
        var on = room.localParticipant.isCameraEnabled;
        await room.localParticipant.setCameraEnabled(!on);
        document.getElementById('btn-cam').classList.toggle('off', on);
        log('Cam ' + (on ? 'off' : 'on'));
      };
    }

    async function startViewer(room) {
      var Track = LivekitClient.Track;
      var RoomEvent = LivekitClient.RoomEvent;

      setStatus('Waiting for host...');
      document.getElementById('placeholder-text').textContent = 'Waiting for host to start...';

      room.on(RoomEvent.TrackSubscribed, function(track, pub, participant) {
        log('Track subscribed: kind=' + track.kind + ' from ' + participant.identity);
        if (track.kind === Track.Kind.Video) {
          attachVideo(track, false);
          setStatus('&#128308; LIVE');
        }
        if (track.kind === Track.Kind.Audio) {
          log('Audio track subscribed from ' + participant.identity);
          // Audio attach is handled by LiveKit internally; video mute workaround covers playback
        }
      });

      // Check if publisher is already in the room
      room.remoteParticipants.forEach(function(participant) {
        participant.trackPublications.forEach(function(pub) {
          if (pub.isSubscribed && pub.track && pub.kind === Track.Kind.Video) {
            log('Found existing video track from ' + participant.identity);
            attachVideo(pub.track, false);
            setStatus('&#128308; LIVE');
          }
        });
      });
    }

    async function main() {
      if (!TOKEN || !WS_URL) {
        setStatus('Error: missing credentials');
        log('ERROR: token or wsUrl missing from URL params');
        return;
      }

      if (typeof LivekitClient === 'undefined') {
        setStatus('Error: streaming library failed to load');
        log('ERROR: LivekitClient not defined — script load failed');
        return;
      }

      log('Starting session — publisher=' + IS_PUB + ' wsUrl=' + WS_URL);

      var Room = LivekitClient.Room;
      var RoomEvent = LivekitClient.RoomEvent;

      var room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { facingMode: 'user' },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
      });

      room.on(RoomEvent.Disconnected, function(reason) {
        log('Room disconnected: ' + reason);
        setStatus('Disconnected');
      });

      room.on(RoomEvent.MediaDevicesError, function(e) {
        var msg = e && e.message ? e.message : String(e);
        log('MediaDevicesError: ' + msg);
        if (IS_PUB) setStatus('&#128308; LIVE (device error)');
      });

      room.on(RoomEvent.ParticipantDisconnected, function(p) {
        log('Participant left: ' + p.identity);
        if (!IS_PUB) setStatus('Host disconnected');
      });

      try {
        setStatus('Connecting...');
        var timeout = setTimeout(function() {
          log('ERROR: connect timed out after 20s');
          setStatus('Connection timed out');
          document.getElementById('placeholder-text').textContent = 'Could not reach the stream server';
        }, 20000);

        await room.connect(WS_URL, TOKEN);
        clearTimeout(timeout);
        log('Connected to room: ' + room.name);

        if (IS_PUB) {
          await startPublisher(room);
        } else {
          await startViewer(room);
        }
      } catch (e) {
        var errMsg = e instanceof Error ? e.message : String(e);
        log('Connect error: ' + errMsg);
        setStatus('Error: ' + errMsg);
        document.getElementById('placeholder-text').textContent = errMsg;
      }
    }

    // Run after DOM is ready (script in head so need DOMContentLoaded)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
    } else {
      main();
    }
  </script>
</body>
</html>`;

  return c.html(html);
});

// ─── POST /api/stream/live-token ──────────────────────────────────────────
// Returns a Stream.io token for live-moment streaming (uses existing Stream creds)
streamingRouter.post("/api/stream/live-token", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  if (!apiKey || !apiSecret) {
    return c.json(
      { error: { message: "Streaming not configured. Add STREAM_API_KEY and STREAM_API_SECRET.", code: "NOT_CONFIGURED" } },
      503
    );
  }

  const body = await c.req.json<{ momentId?: string; role?: string }>();
  const { momentId, role } = body;

  if (!momentId || (role !== "publisher" && role !== "viewer")) {
    return c.json({ error: { message: "momentId and role ('publisher'|'viewer') required", code: "BAD_REQUEST" } }, 400);
  }

  const moment = await prisma.liveMoment.findUnique({
    where: { id: momentId },
    select: { creatorId: true, invitedUserIds: true, status: true, isLive: true },
  });

  if (!moment) return c.json({ error: { message: "Moment not found", code: "NOT_FOUND" } }, 404);
  if (moment.status === "ended") return c.json({ error: { message: "Moment has ended", code: "MOMENT_ENDED" } }, 400);

  const isCreator = moment.creatorId === user.id;
  const invitedIds = parseJsonArray(moment.invitedUserIds);

  if (role === "publisher") {
    if (!isCreator) return c.json({ error: { message: "Only creator can publish", code: "FORBIDDEN" } }, 403);
    await prisma.liveMoment.update({ where: { id: momentId }, data: { isLive: true } });
  } else {
    if (!isCreator && !invitedIds.includes(user.id)) {
      return c.json({ error: { message: "Not invited to this moment", code: "FORBIDDEN" } }, 403);
    }
    if (!moment.isLive) {
      return c.json({ error: { message: "Stream has not started yet", code: "NOT_LIVE" } }, 400);
    }
  }

  const { StreamClient } = await import("@stream-io/node-sdk");
  const client = new StreamClient(apiKey, apiSecret);
  const token = client.generateUserToken({ user_id: user.id });

  return c.json({
    data: {
      token,
      apiKey,
      callId: `moment-${momentId}`,
      userId: user.id,
      userName: user.name,
    },
  });
});

// ─── GET /stream-room/:callId ──────────────────────────────────────────────
// HTML page for live streaming via Stream.io (embedded in WebView)
streamingRouter.get("/stream-room/:callId", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Live</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
    video { background: #111; display: block; }
    #remote-video { width: 100vw; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; }
    #local-video { width: 100vw; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; display: none; }
    #status { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; font-size: 14px; color: rgba(255,255,255,0.6); z-index: 5; padding: 0 24px; pointer-events: none; }
    #controls { position: fixed; bottom: 16px; left: 0; right: 0; display: none; justify-content: center; gap: 20px; z-index: 10; }
    .btn { width: 52px; height: 52px; border-radius: 50%; border: none; outline: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(255,255,255,0.18); -webkit-tap-highlight-color: transparent; }
    .btn:active { opacity: 0.7; transform: scale(0.94); }
  </style>
</head>
<body>
  <video id="remote-video" autoplay playsinline></video>
  <video id="local-video" autoplay playsinline muted></video>
  <div id="status">Connecting…</div>
  <div id="controls">
    <button class="btn" id="mute-btn" onclick="toggleMute()">🎤</button>
    <button class="btn" id="cam-btn" onclick="toggleCamera()">📷</button>
  </div>
  <script type="module">
    const p = new URLSearchParams(location.search);
    const callId = p.get('callId') || '';
    const token = p.get('token') || '';
    const apiKey = p.get('apiKey') || '';
    const userId = p.get('userId') || '';
    const userName = p.get('userName') || 'User';
    const isPublisher = p.get('role') === 'publisher';

    let call = null;
    let client = null;
    let muted = false;
    let cameraOff = false;
    let pollInterval = null;

    function applyStreams(participants) {
      for (const participant of participants) {
        try {
          if (participant.isLocalParticipant) {
            if (isPublisher && participant.videoStream) {
              const el = document.getElementById('local-video');
              if (el.srcObject !== participant.videoStream) {
                el.srcObject = participant.videoStream;
                el.style.display = 'block';
              }
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

    async function init() {
      try {
        const { StreamVideoClient } = await import('https://esm.sh/@stream-io/video-client@1');
        client = new StreamVideoClient({ apiKey, user: { id: userId, name: userName }, token });
        call = client.call('default', callId);
        await call.join({ create: isPublisher });

        if (isPublisher) {
          try { await call.camera.enable(); } catch {}
          try { await call.microphone.enable(); } catch {}
          document.getElementById('controls').style.display = 'flex';
          document.getElementById('status').style.display = 'none';
        } else {
          document.getElementById('status').textContent = 'Waiting for host…';
        }

        function applyAndHideStatus(participants) {
          applyStreams(participants);
          const hasRemote = participants.some(p => !p.isLocalParticipant && p.videoStream);
          if (hasRemote) document.getElementById('status').style.display = 'none';
        }

        call.state.participants$.subscribe(applyAndHideStatus);
        pollInterval = setInterval(() => {
          try { applyAndHideStatus(call.state.participants); } catch {}
        }, 1500);
      } catch (e) {
        document.getElementById('status').textContent = 'Error: ' + (e.message || String(e));
      }
    }

    window.toggleMute = function() {
      if (!call) return;
      muted = !muted;
      muted ? call.microphone.disable() : call.microphone.enable();
      document.getElementById('mute-btn').textContent = muted ? '🔇' : '🎤';
    };

    window.toggleCamera = function() {
      if (!call) return;
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

export { streamingRouter };
