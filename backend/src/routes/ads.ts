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

// GET /api/ads — returns active ads, filtering out dismissed ones for logged-in users
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

// POST /api/ads/:id/dismiss — record a dismissal (auth required)
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

export { adsRouter };
