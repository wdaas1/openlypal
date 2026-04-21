import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

type Variables = {
  user: { id: string; name: string; email: string; image?: string | null; username?: string | null } | null;
  session: { id: string } | null;
};

const advertiserRouter = new Hono<{ Variables: Variables }>();

// POST /api/advertiser/apply — authenticated, upsert AdvertiserApplication
advertiserRouter.post(
  "/apply",
  zValidator(
    "json",
    z.object({
      company: z.string().min(1),
      website: z.string().url().optional(),
      description: z.string().min(1),
    })
  ),
  async (c) => {
    const authUser = c.get("user");
    if (!authUser) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { company, website, description } = c.req.valid("json");

    // Check if already approved
    const existing = await prisma.advertiserApplication.findUnique({
      where: { userId: authUser.id },
      select: { status: true },
    });

    if (existing?.status === "approved") {
      return c.json({ error: { message: "Already approved", code: "ALREADY_APPROVED" } }, 400);
    }

    const application = await prisma.advertiserApplication.upsert({
      where: { userId: authUser.id },
      create: {
        userId: authUser.id,
        company,
        website: website ?? null,
        description,
        status: "pending",
      },
      update: {
        company,
        website: website ?? null,
        description,
        status: "pending",
        adminNote: null,
      },
    });

    return c.json({ data: application });
  }
);

// GET /api/advertiser/status — authenticated, return the user's application or null
advertiserRouter.get("/status", async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const application = await prisma.advertiserApplication.findUnique({
    where: { userId: authUser.id },
  });

  return c.json({ data: application });
});

// GET /api/advertiser/admin/applications — admin only, return all applications with user info
advertiserRouter.get("/admin/applications", async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (dbUser?.role !== "admin") {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
  }

  const applications = await prisma.advertiserApplication.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          image: true,
        },
      },
    },
  });

  return c.json({ data: applications });
});

// PATCH /api/advertiser/admin/applications/:id — admin only, update status and optional adminNote
advertiserRouter.patch(
  "/admin/applications/:id",
  zValidator(
    "json",
    z.object({
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    })
  ),
  async (c) => {
    const authUser = c.get("user");
    if (!authUser) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { role: true },
    });
    if (dbUser?.role !== "admin") {
      return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403);
    }

    const applicationId = c.req.param("id");
    const { status, adminNote } = c.req.valid("json");

    const application = await prisma.advertiserApplication.update({
      where: { id: applicationId },
      data: {
        status,
        adminNote: adminNote ?? null,
      },
    });

    // If approved, update the user's role to "advertiser"
    if (status === "approved") {
      await prisma.user.update({
        where: { id: application.userId },
        data: { role: "advertiser" },
      });
    }

    return c.json({ data: application });
  }
);

export { advertiserRouter };
