import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "./env";
import { supabase } from "./supabase";
import { postsRouter } from "./routes/posts";
import { usersRouter } from "./routes/users";
import { exploreRouter } from "./routes/explore";
import { activityRouter } from "./routes/activity";
import { messagesRouter } from "./routes/messages";
import { tagFollowsRouter } from "./routes/tagFollows";
import { commentsRouter } from "./routes/comments";
import { reportsRouter } from "./routes/reports";
import { adminRouter } from "./routes/admin";
import { liveMomentsRouter } from "./routes/live-moments";
import { relationshipsRouter } from "./routes/relationships";
import { profileModulesRouter } from "./routes/profile-modules";
import { roomsRouter } from "./routes/rooms";
import { streamingRouter } from "./routes/streaming";
import { createBunWebSocket } from "hono/bun";
import { wsManager } from "./ws-manager";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null; username?: string | null } | null;
  session: { id: string } | null;
};

const app = new Hono<{ Variables: Variables }>();

const { upgradeWebSocket, websocket } = createBunWebSocket();

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs: number, maxRequests: number) {
  return async (c: Parameters<typeof app.use>[1] extends (...args: infer A) => unknown ? A[0] : never, next: () => Promise<void>) => {
    // Key on IP + path prefix so different endpoint groups have separate limits
    const ip =
      (c.req.header("x-forwarded-for")?.split(",")[0] ?? c.req.header("x-real-ip") ?? "unknown").trim();
    const group = c.req.path.split("/").slice(0, 3).join("/");
    const key = `${ip}:${group}`;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: { message: "Too many requests", code: "RATE_LIMITED" } }, 429);
    }

    await next();
  };
}

// Prune stale entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// CORS middleware - validates origin against allowlist
// ---------------------------------------------------------------------------
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*dev\.vibecode\.run$/,
  /^https:\/\/([a-z0-9-]+\.)*vibecode\.run$/,
  /^https:\/\/([a-z0-9-]+\.)*vibecodeapp\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Auth middleware - validate Supabase JWT and populate user context
app.use("*", async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        c.set("user", {
          id: user.id,
          name: (user.user_metadata?.name as string | undefined) ?? user.email ?? "User",
          email: user.email ?? "",
          image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          username: (user.user_metadata?.username as string | undefined) ?? null,
        });
      } else {
        c.set("user", null);
      }
    } else {
      c.set("user", null);
    }
    c.set("session", null);
  } catch {
    c.set("user", null);
    c.set("session", null);
  }
  await next();
});

// Rate limiting: write operations — moderate
app.use("/api/posts", rateLimit(60_000, 30));
app.use("/api/upload", rateLimit(60_000, 20));

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// App routes
app.route("/api/posts", postsRouter);
app.route("/api/users", usersRouter);
app.route("/api/explore", exploreRouter);
app.route("/api/activity", activityRouter);
app.route("/api/comments", commentsRouter);
app.route("/api", messagesRouter);
app.route("/api", tagFollowsRouter);
app.route("/api", reportsRouter);
app.route("/api/admin", adminRouter);
// WebSocket endpoint for live moment real-time updates
app.get(
  "/ws/live-moments/:id",
  upgradeWebSocket(async (c) => {
    const momentId = c.req.param("id");
    const token = c.req.query("token") ?? "";

    // Authenticate via bearer token using Supabase
    let userId = "";
    let userName = "";
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? "";
      userName = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? "";
    } catch {
      // unauthenticated — we still allow connection but won't broadcast typing
    }

    return {
      onOpen(_evt, ws) {
        if (userId) {
          wsManager.join(momentId, userId, userName, ws);
        }
      },
      onMessage(evt, _ws) {
        if (!userId) return;
        try {
          const data = JSON.parse(evt.data.toString()) as { type?: string };
          if (data.type === "typing") {
            // Broadcast typing indicator to everyone else in the room
            wsManager.broadcast(momentId, userId, {
              type: "typing",
              userId,
              userName,
            });
          }
        } catch {
          // ignore malformed messages
        }
      },
      onClose(_evt, _ws) {
        if (userId) {
          wsManager.leave(momentId, userId);
        }
      },
    };
  })
);

app.route("/api/live-moments", liveMomentsRouter);
app.route("/api/relationships", relationshipsRouter);
app.route("/api/profile-modules", profileModulesRouter);
app.route("/api/rooms", roomsRouter);

// Auth redirect page — handles Supabase email verification redirects to openly:// deep link
app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Openly — Opening app…</title>
  <style>
    body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #001935; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #fff; }
    p { color: #4a6fa5; font-size: 15px; margin-top: 12px; }
    a { color: #00CF35; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <script>
    (function() {
      var hash = window.location.hash;
      var search = window.location.search;
      if (
        hash.includes('access_token') ||
        hash.includes('refresh_token') ||
        hash.includes('code')
      ) {
        var params = hash || search;
        window.location.replace('openly://' + params);
      }
    })();
  </script>
  <p id="msg">Redirecting to Openly…</p>
  <script>
    (function () {
      var hash = window.location.hash;
      var search = window.location.search;
      var hasTokens = hash.includes('access_token') || hash.includes('refresh_token');
      var hasCode = search.includes('code=');
      if (hasTokens || hasCode) {
        var deepLink = 'openly://' + (hasTokens ? hash : search);
        setTimeout(function () {
          document.getElementById('msg').innerHTML =
            'Tap <a href="' + deepLink + '">here</a> if the app didn\u2019t open automatically.';
        }, 2000);
      } else {
        document.getElementById('msg').textContent = 'Welcome to Openly.';
      }
    })();
  </script>
</body>
</html>`;
  return c.html(html);
});

app.route("/", streamingRouter);

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/mov",
]);
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

app.post("/api/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Validate file size
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "File too large. Maximum size is 500 MB." }, 413);
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json({ error: `File type '${file.type}' is not allowed. Upload images or videos only.` }, 415);
  }

  const storageForm = new FormData();
  storageForm.append("file", file);

  const response = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
    method: "POST",
    body: storageForm,
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    return c.json({ error: error.error || "Upload failed" }, 500);
  }

  const result = await response.json() as { file: { id: string; url: string; originalFilename: string; contentType: string; sizeBytes: number } };
  return c.json({ data: result.file });
});

// Link preview - fetch OG metadata from a URL
app.get('/api/link-preview', async (c) => {
  const url = c.req.query('url');
  if (!url) return c.json({ error: { message: 'url is required' } }, 400);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const getMeta = (prop: string, attr = 'property') => {
      const match = html.match(new RegExp(`<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${prop}["']`, 'i'));
      return match?.[1] ?? null;
    };
    const getTitle = () => {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return m?.[1]?.trim() ?? null;
    };

    const title = getMeta('og:title') ?? getMeta('twitter:title') ?? getTitle();
    const description = getMeta('og:description') ?? getMeta('twitter:description') ?? getMeta('description', 'name');
    const image = getMeta('og:image') ?? getMeta('twitter:image');
    const siteName = getMeta('og:site_name');

    return c.json({ data: { url, title, description, image, siteName } });
  } catch {
    return c.json({ data: { url, title: null, description: null, image: null, siteName: null } });
  }
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
  websocket,
};
