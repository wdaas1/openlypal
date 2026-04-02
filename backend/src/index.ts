import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "./env";
import { auth } from "./auth";
import { postsRouter } from "./routes/posts";
import { usersRouter } from "./routes/users";
import { exploreRouter } from "./routes/explore";
import { activityRouter } from "./routes/activity";
import { messagesRouter } from "./routes/messages";
import { tagFollowsRouter } from "./routes/tagFollows";
import { commentsRouter } from "./routes/comments";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const app = new Hono<{ Variables: Variables }>();

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

// Auth middleware - populate user/session for all routes
app.use("*", async (c, next) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", session?.user ?? null);
    c.set("session", session?.session ?? null);
  } catch {
    c.set("user", null);
    c.set("session", null);
  }
  await next();
});

// Rate limiting: auth routes — strict (sign-in brute-force protection)
app.use("/api/auth/*", rateLimit(60_000, 10));

// Rate limiting: write operations — moderate
app.use("/api/posts", rateLimit(60_000, 30));
app.use("/api/upload", rateLimit(60_000, 20));

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth routes - Better Auth handles these
app.all("/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// App routes
app.route("/api/posts", postsRouter);
app.route("/api/users", usersRouter);
app.route("/api/explore", exploreRouter);
app.route("/api/activity", activityRouter);
app.route("/api/comments", commentsRouter);
app.route("/api", messagesRouter);
app.route("/api", tagFollowsRouter);

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/mov",
]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

app.post("/api/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Validate file size
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "File too large. Maximum size is 50 MB." }, 413);
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

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
