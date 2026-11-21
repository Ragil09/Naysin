export class MenuValidationError extends Error {}
export function tagKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
function text(value: unknown, label: string, limit: number, required = true): string {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new MenuValidationError(`${label} tidak valid.`);
  const result = value.trim();
  if ((required && !result) || result.length > limit) throw new MenuValidationError(`${label} ${required && !result ? "wajib diisi" : `maksimal ${limit} karakter`}.`);
  return result;
}
export function readTag(value: unknown) {
  const name = text(value, "Tag", 60).replace(/\s+/g, " ");
  return { name, key: tagKey(name) };
}
function list(value: unknown, label: string, max: number, limit: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new MenuValidationError(`${label} maksimal ${max} item.`);
  return value.map(v => text(v, label, limit));
}
export function readMenuInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MenuValidationError("Data menu tidak valid.");
  const body = value as Record<string, unknown>;
  const name = text(body.name, "Nama menu", 150);
  const category = readTag(body.category);
  const description = text(body.description, "Deskripsi", 2000);
  let price: number | null = null;
  if (body.price !== undefined && body.price !== null && body.price !== "") {
    const raw = body.price;
    if ((typeof raw !== "number" && !(typeof raw === "string" && /^\d+$/.test(raw.trim()))) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 2147483647) throw new MenuValidationError("Harga harus berupa bilangan bulat rupiah yang valid (minimal 0).");
    price = Number(raw);
  }
  if (body.isAvailable !== undefined && typeof body.isAvailable !== "boolean") throw new MenuValidationError("Status ketersediaan tidak valid.");
  const aliases = [...new Set(list(body.aliases, "Istilah/alias", 30, 120).map(tagKey))];
  const tags = [...new Map([category, ...list(body.tags, "Tag", 20, 60).map(readTag)].map(t => [t.key, t])).values()];
  // Keep the category's display spelling for the primary tag.
  tags[tags.findIndex(t => t.key === category.key)] = category;
  const ingredientIds = body.ingredientIds === undefined ? undefined : [...new Set(list(body.ingredientIds, "Bahan baku", 100, 100))];
  return { name, category, description, price, notes: text(body.notes, "Catatan", 1000, false) || null, isAvailable: body.isAvailable !== false, aliases, tags, ingredientIds };
}
