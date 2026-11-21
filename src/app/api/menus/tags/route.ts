import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { menuAccess, menuError } from "@/backend/menus/menu-access";
import { listTagNames } from "@/backend/menus/menu-service";
import { readTag, tagKey } from "@/backend/menus/menu-input";
export async function GET() {
  try {
    const denied = await menuAccess(); if (denied) return denied;
    return NextResponse.json({ tags: await listTagNames() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return menuError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    const body = await req.json();
    const requested = readTag(body?.name);
    const existing = (await listTagNames()).find(t => tagKey(t) === requested.key);
    const tag = await prisma.menuTag.upsert({ where: { key: requested.key }, update: {}, create: { name: existing ?? requested.name, key: requested.key } });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) { return menuError(error); }
}
