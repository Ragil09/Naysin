import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { answerWebsiteMenuQuery } from "@/backend/assistant/gemini-menu-service";

export const runtime = "nodejs";

/** Website chatbot only. WhatsApp continues to use its separate existing webhook. */
export async function POST(req: NextRequest) {
  // Protect Gemini API quota: the website assistant is currently an authenticated dashboard feature.
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });

  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 }); }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }
  const { question, channel, previousMenuNames } = payload as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim() || question.length > 500 || (channel !== undefined && channel !== "WEB")) {
    return NextResponse.json({ error: "Pertanyaan wajib diisi (maksimal 500 karakter); saat ini hanya kanal WEB yang aktif" }, { status: 400 });
  }
  const safeContext = Array.isArray(previousMenuNames) && previousMenuNames.length === 1 &&
    typeof previousMenuNames[0] === "string" && previousMenuNames[0].length <= 300 ? previousMenuNames as string[] : [];

  try {
    const result = await answerWebsiteMenuQuery(prisma, question.trim(), safeContext);
    // Chat logging is best effort. A failed audit insert must not break a valid AI response.
    try {
      await prisma.chatLog.create({ data: {
        channel: "WEB",
        question: question.trim().slice(0, 500),
        answer: result.answer,
        status: result.status,
        modelVersion: result.modelVersion,
      } });
    } catch (error) {
      console.error("Assistant chat logging failed:", error instanceof Error ? error.name : "unknown");
    }
    return NextResponse.json({
      answer: result.answer,
      isGrounded: result.isGrounded,
      status: result.status,
      matchedMenuItems: result.matchedMenuItems,
      provider: result.provider,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assistant API error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({
      answer: "Maaf, asisten menu sedang mengalami gangguan. Silakan konfirmasi ke barista.",
      isGrounded: false, status: "ERROR", provider: "RULES", matchedMenuItems: [],
    }, { status: 500 });
  }
}
