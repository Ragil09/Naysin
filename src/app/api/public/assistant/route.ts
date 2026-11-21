import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { answerWebsiteMenuQuery } from "@/backend/assistant/gemini-menu-service";
import { answerMenuQuery } from "@/backend/assistant/menu-ai-service";
import { consumePublicAssistantQuota, PublicAssistantQuotaError } from "@/backend/public/assistant-quota";

export const runtime = "nodejs";

/** Guest-facing endpoint; separate from existing /api/assistant/chat for staff. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 2_000) return NextResponse.json({ error: "Permintaan terlalu panjang." }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  const data = input as Record<string, unknown>;
  const question = data.question;
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return NextResponse.json({ error: "Pertanyaan wajib diisi (maksimal 500 karakter)." }, { status: 400 });
  }
  const previousMenuNames = Array.isArray(data.previousMenuNames) && data.previousMenuNames.length === 1 &&
    typeof data.previousMenuNames[0] === "string" && data.previousMenuNames[0].length <= 160 ?
    [data.previousMenuNames[0]] : [];
  try {
    // Enforce quota BEFORE issuing a Gemini API request. Production needs anti-bot/WAF as well.
    await consumePublicAssistantQuota(req);
  } catch (error) {
    if (error instanceof PublicAssistantQuotaError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    console.error("Public assistant quota store unavailable");
    return NextResponse.json({ error: "Asisten belum tersedia. Silakan coba kembali nanti." }, { status: 503 });
  }
  try {
    const result = process.env.PUBLIC_GEMINI_ENABLED === "true" ?
      await answerWebsiteMenuQuery(prisma, question.trim(), previousMenuNames) :
      { ...await answerMenuQuery(prisma, question.trim()), provider: "RULES" as const };
    return NextResponse.json({
      answer: result.answer,
      status: result.status,
      isGrounded: result.isGrounded,
      matchedMenuItems: result.matchedMenuItems,
      provider: result.provider,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Public menu assistant failed");
    return NextResponse.json({ error: "Asisten sedang mengalami gangguan. Silakan hubungi pihak kedai." }, { status: 503 });
  }
}
