import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/backend/db";

export class PublicAssistantQuotaError extends Error {
  constructor() { super("Batas penggunaan asisten publik tercapai. Silakan coba kembali nanti."); }
}

/** Limits are shared via PostgreSQL; no reliance on process memory in serverless. */
export async function consumePublicAssistantQuota(request: NextRequest): Promise<void> {
  const now = new Date();
  const timestamp = now.getTime();
  const day = now.toISOString().slice(0, 10);
  const minuteBucket = Math.floor(timestamp / 60_000);
  // Hosting reverse proxies should overwrite these headers; production should verify this.
  const ip = (request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "anonymous").trim().slice(0, 96);
  const salt = process.env.PUBLIC_ASSISTANT_HASH_SECRET || process.env.AUTH_SECRET || "local-development";
  const visitor = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
  const limits = [
    { key: `global-day:${day}`, max: 200, expiresAt: new Date(timestamp + 3 * 86400_000) },
    { key: `visitor-day:${day}:${visitor}`, max: 20, expiresAt: new Date(timestamp + 3 * 86400_000) },
    { key: `visitor-minute:${minuteBucket}:${visitor}`, max: 4, expiresAt: new Date(timestamp + 3600_000) },
  ];
  await prisma.$transaction(async tx => {
    for (const rule of limits) {
      await tx.publicAssistantQuota.upsert({
        where: { key: rule.key },
        create: { key: rule.key, count: 0, expiresAt: rule.expiresAt },
        update: {},
      });
      const updated = await tx.publicAssistantQuota.updateMany({
        where: { key: rule.key, count: { lt: rule.max } },
        data: { count: { increment: 1 } },
      });
      if (updated.count !== 1) throw new PublicAssistantQuotaError();
    }
  });
}
