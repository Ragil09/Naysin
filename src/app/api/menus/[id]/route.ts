import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { menuAccess, menuError } from "@/backend/menus/menu-access";
import { saveMenu } from "@/backend/menus/menu-service";

// Full edit form: omitted optional fields are cleared, except omitted ingredientIds (preserved).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    const { id } = await params;
    const menu = await saveMenu(await req.json(), id);
    if (!menu) return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ menu });
  } catch (error) { return menuError(error); }
}


// Deleting a menu also removes aliases, ingredient links and tag relationships.
// The tag catalog itself and all inventory/stock history remain untouched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    const { id } = await params;
    const removed = await prisma.menu.deleteMany({ where: { id } });
    if (!removed.count) return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ message: "Menu berhasil dihapus." });
  } catch (error) { return menuError(error); }
}
