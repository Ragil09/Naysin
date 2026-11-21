import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { menuAccess, menuError } from "@/backend/menus/menu-access";
import { listTagNames, menuInclude, saveMenu } from "@/backend/menus/menu-service";

export async function GET() {
  try {
    const denied = await menuAccess(); if (denied) return denied;
    const [menus, tags] = await Promise.all([
      prisma.menu.findMany({ include: menuInclude, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      listTagNames(),
    ]);
    return NextResponse.json({ menus, tags }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return menuError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    return NextResponse.json({ menu: await saveMenu(await req.json()) }, { status: 201 });
  } catch (error) { return menuError(error); }
}
