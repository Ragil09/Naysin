export const PACKAGE_UNITS = ["kotak", "dus", "botol", "pouch", "bungkus", "sachet", "kaleng", "pak", "pcs", "buah", "bal", "krat", "karung", "jeriken", "cup", "gelas", "tray", "rol", "pack"];

export class UnitValidationError extends Error {}
const fail = (message: string): never => { throw new UnitValidationError(message); };

export function normalizeUnit(value: unknown): string {
  if (typeof value !== "string") return fail("Satuan wajib diisi");
  const unit = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!/^[a-z][a-z0-9 -]{0,29}$/.test(unit)) return fail("Nama satuan tidak valid");
  if (["g", "gr", "gram", "kg", "kilogram", "mg", "ml", "mililiter", "l", "liter", "lt"].includes(unit)) return fail("Gunakan satuan kemasan, misalnya kotak, botol atau pouch");
  return unit;
}

export function readWhole(value: unknown, min: number, label: string): number {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return fail(`${label} wajib diisi`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) return fail(`${label} harus bilangan bulat minimal ${min}`);
  return number;
}

export function readUnitConfig(unitInput: unknown, alternateInput: unknown, factorInput: unknown) {
  const unit = normalizeUnit(unitInput);
  if (alternateInput === null || alternateInput === undefined || (typeof alternateInput === "string" && !alternateInput.trim())) {
    return { unit, alternateUnit: null, unitsPerAlternate: null };
  }
  const alternateUnit = normalizeUnit(alternateInput);
  if (unit === alternateUnit) return fail("Satuan tambahan harus berbeda dengan satuan dasar");
  const unitsPerAlternate = readWhole(factorInput, 2, "Isi satuan tambahan");
  if (unitsPerAlternate > 2147483647) return fail("Isi satuan tambahan terlalu besar");
  return { unit, alternateUnit, unitsPerAlternate };
}

export function convertStockQuantity(ingredient: { unit: string; alternateUnit?: string | null; unitsPerAlternate?: number | null }, quantity: number, requestedUnit?: string, expectedFactor?: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return fail("Kuantitas kemasan harus berupa bilangan bulat non-negatif");
  const enteredUnit = requestedUnit ?? ingredient.unit;
  const factor = enteredUnit === ingredient.unit ? 1 : enteredUnit === ingredient.alternateUnit ? ingredient.unitsPerAlternate : null;
  if (typeof factor !== "number" || !Number.isSafeInteger(factor) || factor < 1) return fail("Satuan transaksi tidak tersedia untuk bahan ini");
  if (expectedFactor !== undefined && expectedFactor !== factor) return fail("Konversi satuan telah berubah. Muat ulang halaman sebelum menyimpan.");
  const baseQuantity = quantity * factor;
  if (!Number.isSafeInteger(baseQuantity)) return fail("Kuantitas hasil konversi terlalu besar");
  return { baseQuantity, enteredUnit, factor };
}

export function formatStock(quantity: number, unit: string, alternateUnit?: string | null, factor?: number | null): string {
  const base = `${quantity.toLocaleString("id-ID")} ${unit}`;
  if (!alternateUnit || !factor || !Number.isSafeInteger(quantity) || quantity < factor) return base;
  const whole = Math.floor(quantity / factor), remainder = quantity % factor;
  return `${base} (${whole.toLocaleString("id-ID")} ${alternateUnit}${remainder ? ` + ${remainder.toLocaleString("id-ID")} ${unit}` : ""})`;
}
