import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/backend/auth";
import { nextAvailableUsername } from "@/backend/users/user-service";

export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Silakan login dahulu" }, { status: 401 });
  if (current.role !== Role.OWNER) return NextResponse.json({ error: "Akses hanya untuk Owner" }, { status: 403 });
  const name = new URL(req.url).searchParams.get("name") ?? "";
  try {
    const username = await nextAvailableUsername(name);
    return NextResponse.json({ username }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Nama tidak valid" }, { status: 400 });
  }
}
