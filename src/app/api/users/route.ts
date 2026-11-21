import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { AccountValidationError, createEmployeeAccount } from "@/backend/users/user-service";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  if (current.role !== Role.OWNER) return NextResponse.json({ error: "Hanya Owner yang dapat mengelola akun" }, { status: 403 });
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true, employeeId: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ users, currentUserId: current.userId }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("List users error:", err);
    return NextResponse.json({ error: "Gagal membaca daftar akun" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  if (current.role !== Role.OWNER) return NextResponse.json({ error: "Hanya Owner yang dapat mengelola akun" }, { status: 403 });
  try {
    const user = await createEmployeeAccount(await req.json());
    return NextResponse.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AccountValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Gagal membuat akun" }, { status: 500 });
  }
}
