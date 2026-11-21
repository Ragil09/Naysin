import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { verifyPassword, createSession, setSessionCookie } from "@/backend/auth";

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const username = typeof input?.username === "string" ? input.username.trim().toLowerCase() : "";
    const password = input?.password;
    if (!username || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user?.isActive || !await verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Username atau password tidak sesuai" }, { status: 401 });
    }
    const token = await createSession({ userId: user.id, name: user.name, username, role: user.role });
    await setSessionCookie(token);
    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, username, role: user.role } });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan sistem saat memproses login" }, { status: 500 });
  }
}
