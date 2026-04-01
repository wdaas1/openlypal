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

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
  session: { id: string } | null;
};

const app = new Hono<{ Variables: Variables }>();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
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

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
