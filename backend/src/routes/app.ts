import { Hono } from "hono";
import { prisma } from "../prisma";

const appRouter = new Hono();

// GET /api/app/settings — public endpoint to read current app settings
appRouter.get("/settings", async (c) => {
  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
    select: {
      maintenanceMode: true,
      announcementText: true,
      announcementActive: true,
      featuresJson: true,
    },
  });

  return c.json({ data: settings });
});

export { appRouter };
