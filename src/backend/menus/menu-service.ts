import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/db";
import { MenuValidationError, readMenuInput, tagKey } from "./menu-input";

export const menuInclude = {
  aliases: true, tags: true, image: { select: { menuId: true, updatedAt: true } },
  ingredients: { include: { ingredient: { select: { name: true, unit: true, isActive: true } } } },
} satisfies Prisma.MenuInclude;

export async function saveMenu(body: unknown, id?: string) {
  const input = readMenuInput(body);
  return prisma.$transaction(async tx => {
    const current = id ? await tx.menu.findUnique({ where: { id }, include: { ingredients: true } }) : null;
    if (id && !current) return null;
    const duplicate = await tx.menu.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (duplicate) throw new MenuValidationError("Nama menu sudah terdaftar.");
    const conflicts = await tx.menuAlias.findMany({ where: { alias: { in: input.aliases }, ...(id ? { menuId: { not: id } } : {}) }, select: { alias: true } });
    if (conflicts.length) throw new MenuValidationError(`Istilah sudah digunakan oleh menu lain: ${conflicts.map(a => a.alias).join(", ")}.`);
    if (input.ingredientIds !== undefined) {
      const rows = await tx.ingredient.findMany({ where: { id: { in: input.ingredientIds } }, select: { id: true, isActive: true } });
      const existingIds = new Set(current?.ingredients.map(i => i.ingredientId) ?? []);
      if (rows.length !== input.ingredientIds.length || rows.some(i => !i.isActive && !existingIds.has(i.id))) throw new MenuValidationError("Bahan baku tidak ditemukan atau tidak aktif.");
    }
    const tags = [];
    for (const tag of input.tags.sort((a,b) => a.key.localeCompare(b.key))) {
      tags.push(await tx.menuTag.upsert({ where: { key: tag.key }, update: {}, create: tag }));
    }
    const category = tags.find(t => t.key === input.category.key)!.name;
    const data = { name: input.name, category, description: input.description, price: input.price, notes: input.notes, isAvailable: input.isAvailable };
    const links = tags.map(t => ({ id: t.id }));
    if (id) {
      // Replace aliases atomically; do not delete/recreate ingredient links that are unchanged.
      await tx.menuAlias.deleteMany({ where: { menuId: id, ...(input.aliases.length ? { alias: { notIn: input.aliases } } : {}) } });
      const old = await tx.menuAlias.findMany({ where: { menuId: id }, select: { alias: true } });
      const missing = input.aliases.filter(a => !old.some(o => o.alias === a));
      if (missing.length) await tx.menuAlias.createMany({ data: missing.map(alias => ({ menuId: id, alias })) });
      if (input.ingredientIds !== undefined) {
        const ids = input.ingredientIds;
        await tx.menuIngredient.deleteMany({ where: { menuId: id, ...(ids.length ? { ingredientId: { notIn: ids } } : {}) } });
        const newIds = ids.filter(i => !current?.ingredients.some(o => o.ingredientId === i));
        if (newIds.length) await tx.menuIngredient.createMany({ data: newIds.map(ingredientId => ({ menuId: id, ingredientId })) });
      }
      return tx.menu.update({ where: { id }, data: { ...data, tags: { set: links } }, include: menuInclude });
    }
    return tx.menu.create({ data: { ...data, tags: { connect: links }, aliases: { create: input.aliases.map(alias => ({ alias })) }, ingredients: { create: (input.ingredientIds ?? []).map(ingredientId => ({ ingredient: { connect: { id: ingredientId } } })) } }, include: menuInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listTagNames() {
  const [tags, categories] = await Promise.all([
    prisma.menuTag.findMany({ orderBy: { name: "asc" } }),
    prisma.menu.findMany({ distinct: ["category"], select: { category: true } }),
  ]);
  // Legacy demo menus keep their category even before any owner edit.
  const map = new Map(categories.map(c => [tagKey(c.category), c.category]));
  for (const tag of tags) map.set(tag.key, tag.name);
  return [...map.values()].sort((a,b) => a.localeCompare(b, "id"));
}
