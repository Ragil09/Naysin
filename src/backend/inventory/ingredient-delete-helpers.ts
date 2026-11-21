// Pure validation for safe removal of inventory master records.
export type IngredientDeleteState = {
  currentStock: number;
  menuItems: number;
  batches: number;
  transactions: number;
};

export function ingredientDeleteDecision(state: IngredientDeleteState):
  | { allowed: false; message: string }
  | { allowed: true; action: "deleted" | "archived" } {
  if (state.menuItems > 0) return {
    allowed: false,
    message: `Bahan masih digunakan oleh ${state.menuItems} menu. Hapus bahan dari komposisi menu tersebut terlebih dahulu.`,
  };
  if (state.currentStock !== 0) return {
    allowed: false,
    message: "Stok bahan baku harus 0 sebelum dihapus. Catat transaksi stok keluar/waste atau lakukan penyesuaian terlebih dahulu.",
  };
  if (state.transactions > 0 || state.batches > 0) return { allowed: true, action: "archived" };
  return { allowed: true, action: "deleted" };
}
