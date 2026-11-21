export interface IngredientCsvRow {
  name: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  alternateUnit: string | null;
  unitsPerAlternate: number | null;
  isActive: boolean;
  notes: string | null;
}

// Quote all text fields, escape embedded quotes and neutralize spreadsheet formulas.
function cell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildIngredientCsv(ingredients: IngredientCsvRow[]): string {
  const headers = ["Nama Bahan", "Saldo Saat Ini", "Satuan Dasar", "Satuan Tambahan", "Isi per Satuan Tambahan", "Ambang Minimum", "Status Stok", "Status Bahan", "Catatan"];
  const rows = ingredients.map((i) => [
    i.name, i.currentStock, i.unit, i.alternateUnit, i.unitsPerAlternate,
    i.minimumStock, i.currentStock <= i.minimumStock ? "Menipis" : "Aman",
    i.isActive ? "Aktif" : "Nonaktif", i.notes,
  ]);
  // UTF-8 BOM helps Microsoft Excel recognize Indonesian text and other Unicode.
  return "\uFEFF" + [headers, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
