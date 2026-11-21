import { prisma } from "@/backend/db";

import type { PublicMenuItem } from "@/shared/types/public-menu";

/** Hanya kolom yang boleh diketahui pelanggan. Tidak ada stok, resep, atau identitas staf. */
export async function getPublicMenuCatalog(): Promise<PublicMenuItem[]> {
  const menus = await prisma.menu.findMany({
    where: { isAvailable: true },
    select: {
      id: true, name: true, category: true, description: true,
      price: true, isAvailable: true,
      tags: { select: { name: true } },
      image: { select: { menuId: true, updatedAt: true } },
    },
    orderBy: { name: "asc" },
  });
  return menus.map(menu => ({
    id: menu.id,
    name: menu.name,
    category: menu.category,
    tags: [...new Set([menu.category, ...menu.tags.map(tag => tag.name)].filter(Boolean))],
    description: menu.description,
    price: menu.price,
    isAvailable: menu.isAvailable,
    imageUrl: menu.image ? `/api/public/menu-images/${encodeURIComponent(menu.id)}?v=${menu.image.updatedAt.getTime()}` : null,
  }));
}
