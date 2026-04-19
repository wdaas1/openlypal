import { Hono } from "hono";
import { prisma } from "../prisma";

const adsRouter = new Hono<{ Variables: { user: { id: string } | null; session: any | null } }>();

// Seed default ads if table is empty
async function seedAdsIfEmpty() {
  const count = await prisma.ad.count();
  if (count > 0) return;
  await prisma.ad.createMany({
    data: [
      { headline: "Grow Your Audience", subtext: "Reach thousands of engaged readers on Openly", cta: "Get Started", theme: "green", clickUrl: null },
      { headline: "Discover Amazing Content", subtext: "Advertise your brand to our creative community", cta: "Learn More", theme: "purple", clickUrl: null },
      { headline: "Your Ad Could Be Here", subtext: "Connect with passionate creators and their fans", cta: "Advertise", theme: "orange", clickUrl: null },
      { headline: "Premium Placement", subtext: "Sponsor posts and reach your ideal audience", cta: "Contact Us", theme: "blue", clickUrl: null },
    ],
  });
}

seedAdsIfEmpty().catch(console.error);

// 1. GET /api/ads — returns active ads, filtering out dismissed ones for logged-in users
adsRouter.get("/", async (c) => {
  const user = c.get("user");
  const ads = await prisma.ad.findMany({
    where: {
      active: true,
      ...(user ? {
        dismissals: { none: { userId: user.id } },
      } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, headline: true, subtext: true, cta: true, theme: true, clickUrl: true },
  });
  return c.json({ data: ads });
});

// 2. GET /api/ads/admin — list all ads with full stats (auth required)
adsRouter.get("/admin", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const ads = await prisma.ad.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      headline: true,
      subtext: true,
      cta: true,
      theme: true,
      clickUrl: true,
      active: true,
      impressions: true,
      clicks: true,
      createdAt: true,
      _count: { select: { dismissals: true } },
    },
  });
  return c.json({ data: ads });
});

// 3. POST /api/ads/admin — create a new ad (auth required)
adsRouter.post("/admin", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const body = await c.req.json<{
    headline: string;
    subtext: string;
    cta: string;
    theme: string;
    clickUrl?: string | null;
    active?: boolean;
  }>();

  const ad = await prisma.ad.create({
    data: {
      headline: body.headline,
      subtext: body.subtext,
      cta: body.cta,
      theme: body.theme ?? "green",
      clickUrl: body.clickUrl ?? null,
      active: body.active ?? true,
    },
  });
  return c.json({ data: ad });
});

// 4. PATCH /api/ads/admin/:id — update an ad (auth required)
adsRouter.patch("/admin/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const adId = c.req.param("id");
  const body = await c.req.json<Partial<{
    headline: string;
    subtext: string;
    cta: string;
    theme: string;
    clickUrl: string | null;
    active: boolean;
  }>>();

  const ad = await prisma.ad.update({
    where: { id: adId },
    data: body,
  });
  return c.json({ data: ad });
});

// 5. DELETE /api/ads/admin/:id — delete an ad (auth required)
adsRouter.delete("/admin/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const adId = c.req.param("id");
  await prisma.ad.delete({ where: { id: adId } });
  return c.json({ data: { success: true } });
});

// 6. POST /api/ads/:id/dismiss — record a dismissal (auth required)
adsRouter.post("/:id/dismiss", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  const adId = c.req.param("id");
  await prisma.adDismissal.upsert({
    where: { userId_adId: { userId: user.id, adId } },
    create: { userId: user.id, adId },
    update: {},
  });
  return c.json({ data: { success: true } });
});

// 7. POST /api/ads/:id/impression — fire-and-forget impression count
adsRouter.post("/:id/impression", async (c) => {
  const adId = c.req.param("id");
  await prisma.ad.update({
    where: { id: adId },
    data: { impressions: { increment: 1 } },
  }).catch(() => null); // ignore if ad doesn't exist
  return c.json({ data: { success: true } });
});

// 8. POST /api/ads/:id/click — record a CTA click
adsRouter.post("/:id/click", async (c) => {
  const adId = c.req.param("id");
  await prisma.ad.update({
    where: { id: adId },
    data: { clicks: { increment: 1 } },
  }).catch(() => null);
  return c.json({ data: { success: true } });
});

export { adsRouter };
