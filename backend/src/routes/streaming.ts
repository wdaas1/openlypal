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

// ─── GET /call/:callId ─────────────────────────────────────────────────────
// Serves the WebRTC call page — uses native RTCPeerConnection + WebSocket signaling
streamingRouter.get("/call/:callId", async (c) => {
  const callId = c.req.param("callId");
  const { token = "", type = "video" } = c.req.query();
  const isVideo = type !== "audio";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Call</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; width: 100vw; height: 100vh; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  #remote-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #111; display: none; }
  #local-video { display: none; position: absolute; top: 16px; right: 16px; width: 100px; height: 140px; border-radius: 12px; object-fit: cover; background: #222; border: 2px solid rgba(255,255,255,0.3); z-index: 10; transform: scaleX(-1); }
  #placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: #fff; width: 100%; padding: 20px; }
  #placeholder .avatar { width: 100px; height: 100px; border-radius: 50%; background: #333; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 40px; }
  #placeholder .status { font-size: 15px; color: rgba(255,255,255,0.6); margin-top: 8px; }
  #controls { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px; z-index: 20; }
  .ctrl-btn { width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; -webkit-tap-highlight-color: transparent; background: rgba(255,255,255,0.18); }
  .ctrl-btn.muted, .ctrl-btn.off { background: rgba(255,59,48,0.6); }
</style>
</head>
<body>

<div id="placeholder">
  <div class="avatar">&#128100;</div>
  <div class="status" id="ph-status">Connecting...</div>
</div>

<video id="remote-video" autoplay playsinline></video>
<video id="local-video" autoplay playsinline muted></video>

<div id="controls">
  <button class="ctrl-btn" id="btn-mic" onclick="toggleMic()">&#127908;</button>
  ${isVideo ? '<button class="ctrl-btn" id="btn-cam" onclick="toggleCam()">&#128247;</button>' : ""}
</div>

<script>
var CALL_ID = '${callId}';
var TOKEN = '${token}';
var IS_VIDEO = ${isVideo};
var WS_BASE = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

var localStream = null;
var peerConnection = null;
var signalingWs = null;
var myRole = null;
var micEnabled = true;
var camEnabled = IS_VIDEO;
var iceCandidateQueue = [];

var ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

function log(msg) { console.log('[Call] ' + msg); }

function setStatus(msg) {
  var el = document.getElementById('ph-status');
  if (el) el.textContent = msg;
  log(msg);
}

// ── Local media ──────────────────────────────────────────────────────────────
async function startLocalMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: IS_VIDEO ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
    });
    log('Media acquired — audio:' + localStream.getAudioTracks().length + ' video:' + localStream.getVideoTracks().length);
    if (IS_VIDEO && localStream.getVideoTracks().length > 0) {
      var lv = document.getElementById('local-video');
      lv.srcObject = localStream;
      lv.style.display = 'block';
    }
  } catch (e) {
    log('Media error: ' + e.message);
    setStatus('Could not access camera/mic: ' + e.message);
  }
}

// ── Peer connection ──────────────────────────────────────────────────────────
function createPeerConnection() {
  if (peerConnection) return;
  peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  if (localStream) {
    localStream.getTracks().forEach(function(t) { peerConnection.addTrack(t, localStream); });
  }

  var remoteStream = new MediaStream();
  peerConnection.ontrack = function(evt) {
    log('Remote track: ' + evt.track.kind);
    remoteStream.addTrack(evt.track);
    if (evt.track.kind === 'video' && IS_VIDEO) {
      var rv = document.getElementById('remote-video');
      rv.srcObject = remoteStream;
      rv.style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
    }
    if (evt.track.kind === 'audio') {
      var audio = document.getElementById('remote-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'remote-audio';
        audio.autoplay = true;
        audio.setAttribute('playsinline', '');
        document.body.appendChild(audio);
      }
      if (!audio.srcObject) {
        audio.srcObject = remoteStream;
        audio.play().catch(function(err) { log('Audio play: ' + err.message); });
      }
    }
  };

  peerConnection.onicecandidate = function(evt) {
    if (evt.candidate) send({ type: 'ice-candidate', candidate: evt.candidate.toJSON() });
  };

  peerConnection.oniceconnectionstatechange = function() {
    var s = peerConnection.iceConnectionState;
    log('ICE: ' + s);
    if (s === 'connected' || s === 'completed') {
      setStatus(IS_VIDEO ? 'Connected' : 'Connected \u00b7 Audio only');
      if (!IS_VIDEO) document.getElementById('placeholder').style.display = 'block';
    } else if (s === 'disconnected') {
      setStatus('Reconnecting...');
    } else if (s === 'failed') {
      setStatus('Connection failed');
    }
  };
}

// ── Offer / answer ───────────────────────────────────────────────────────────
async function createAndSendOffer() {
  createPeerConnection();
  try {
    var offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: IS_VIDEO });
    await peerConnection.setLocalDescription(offer);
    send({ type: 'offer', sdp: { type: offer.type, sdp: offer.sdp } });
    log('Offer sent');
  } catch (e) { log('Offer error: ' + e.message); }
}

async function handleOffer(sdp) {
  createPeerConnection();
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    for (var i = 0; i < iceCandidateQueue.length; i++) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidateQueue[i]));
    }
    iceCandidateQueue = [];
    var answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    send({ type: 'answer', sdp: { type: answer.type, sdp: answer.sdp } });
    log('Answer sent');
  } catch (e) { log('Offer handle error: ' + e.message); }
}

async function handleAnswer(sdp) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    for (var i = 0; i < iceCandidateQueue.length; i++) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidateQueue[i]));
    }
    iceCandidateQueue = [];
    log('Answer handled');
  } catch (e) { log('Answer handle error: ' + e.message); }
}

async function handleIceCandidate(candidate) {
  if (!peerConnection || !peerConnection.remoteDescription) {
    iceCandidateQueue.push(candidate);
    return;
  }
  try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
  catch (e) { log('ICE add error: ' + e.message); }
}

// ── Signaling ────────────────────────────────────────────────────────────────
function connectSignaling() {
  var wsUrl = WS_BASE + '/ws/call/' + CALL_ID + '?token=' + encodeURIComponent(TOKEN);
  log('Signaling to: ' + WS_BASE + ' callId=' + CALL_ID + ' tokenLen=' + TOKEN.length);
  signalingWs = new WebSocket(wsUrl);

  signalingWs.onopen = function() { log('Signaling open'); setStatus('Waiting for other person...'); };

  signalingWs.onmessage = async function(evt) {
    var msg; try { msg = JSON.parse(evt.data); } catch { return; }
    log('Signal: ' + msg.type);
    if (msg.type === 'role') {
      myRole = msg.role;
      setStatus('Waiting...');
    } else if (msg.type === 'peer-joined') {
      setStatus('Connecting...');
      if (myRole === 'caller') await createAndSendOffer();
    } else if (msg.type === 'offer') {
      await handleOffer(msg.sdp);
    } else if (msg.type === 'answer') {
      await handleAnswer(msg.sdp);
    } else if (msg.type === 'ice-candidate') {
      await handleIceCandidate(msg.candidate);
    } else if (msg.type === 'peer-left') {
      setStatus('Call ended');
      cleanup();
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'call_ended' }));
    }
  };

  signalingWs.onerror = function(e) {
    log('WS error: ' + (e.message || 'unknown'));
    setStatus('Cannot reach signaling server');
  };

  signalingWs.onclose = function(e) {
    log('WS closed: code=' + e.code + ' reason=' + (e.reason || ''));
    if (e.code === 1008) setStatus('Auth failed — please try again');
    else if (e.code === 1006) setStatus('Connection lost — check network');
    else if (e.code !== 1000) setStatus('Disconnected (code ' + e.code + ')');
  };
}

function send(msg) {
  if (signalingWs && signalingWs.readyState === WebSocket.OPEN) signalingWs.send(JSON.stringify(msg));
}

// ── Controls ─────────────────────────────────────────────────────────────────
function toggleMic() {
  micEnabled = !micEnabled;
  if (localStream) localStream.getAudioTracks().forEach(function(t) { t.enabled = micEnabled; });
  var btn = document.getElementById('btn-mic');
  btn.textContent = micEnabled ? '\\u{1F3A4}' : '\\u{1F507}';
  btn.className = 'ctrl-btn' + (micEnabled ? '' : ' muted');
}

function toggleCam() {
  camEnabled = !camEnabled;
  if (localStream) localStream.getVideoTracks().forEach(function(t) { t.enabled = camEnabled; });
  var lv = document.getElementById('local-video');
  if (lv) lv.style.display = camEnabled ? 'block' : 'none';
  var btn = document.getElementById('btn-cam');
  if (btn) { btn.textContent = camEnabled ? '\\u{1F4F7}' : '\\u{1F6AB}'; btn.className = 'ctrl-btn' + (camEnabled ? '' : ' off'); }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
function cleanup() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  if (localStream) { localStream.getTracks().forEach(function(t) { t.stop(); }); localStream = null; }
  if (signalingWs && signalingWs.readyState === WebSocket.OPEN) { signalingWs.close(); signalingWs = null; }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!CALL_ID || !TOKEN) { setStatus('Error: missing credentials'); return; }
  setStatus('Requesting media...');
  await startLocalMedia();
  connectSignaling();
}

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

export { streamingRouter };
