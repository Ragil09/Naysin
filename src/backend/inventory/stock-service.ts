import { Prisma, PrismaClient, TransactionType, WasteReason } from "@prisma/client";
import { isBatchExpired, parseReceiptDates } from "@/shared/inventory/stock-dates";
import { convertStockQuantity } from "@/shared/inventory/stock-units";

export interface StockMutationParams {
  ingredientId: string;
  type: TransactionType;
  quantity: number;
  inputUnit?: string;
  expectedFactor?: number;
  userId: string;
  batchId?: string;
  lotCode?: string;
  receivedDate?: string;
  expiryDate?: string;
  note?: string;
  wasteReason?: WasteReason;
  idempotencyKey?: string;
}

export interface StockMutationResult {
  transactionId: string;
  ingredientId: string;
  type: TransactionType;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  idempotentReplay?: boolean;
}

const EPSILON = 1e-8;
const clean = (qty: number) => Math.abs(qty) < EPSILON ? 0 : qty;

/** Keep the physical balance, batch balance and audit record in one transaction.
 * Historical stock without a batch remains usable as a separate legacy balance.
 * OUT/WASTE/ADJUSTMENT always affect one selected batch or the legacy balance.
 */
export async function executeStockMutation(
  prisma: PrismaClient,
  params: StockMutationParams
): Promise<StockMutationResult> {
  const { ingredientId, type, quantity: enteredQuantity, userId, batchId, note, wasteReason, idempotencyKey } = params;
  if (!Object.values(TransactionType).includes(type)) throw new Error("Tipe transaksi tidak valid");
  if (!Number.isSafeInteger(enteredQuantity) || enteredQuantity < 0 || (type !== TransactionType.ADJUSTMENT && enteredQuantity === 0)) {
    throw new Error("Kuantitas tidak valid (hanya opname yang boleh bernilai 0)");
  }
  if (wasteReason !== undefined && !Object.values(WasteReason).includes(wasteReason)) {
    throw new Error("Alasan waste tidak valid");
  }
  if (type === TransactionType.IN && batchId) throw new Error("Stok masuk harus membuat batch baru");
  if (type !== TransactionType.IN && (params.receivedDate !== undefined || params.expiryDate !== undefined || params.lotCode !== undefined)) {
    throw new Error("Tanggal dan kode batch baru hanya untuk stok masuk");
  }

  if (idempotencyKey) {
    const existing = await prisma.stockTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return {
        transactionId: existing.id, ingredientId: existing.ingredientId, type: existing.type,
        quantity: existing.quantity, beforeQty: existing.beforeQty, afterQty: existing.afterQty,
        idempotentReplay: true,
      };
    }
  }

  const dates = type === TransactionType.IN ? parseReceiptDates(params.receivedDate, params.expiryDate) : null;
  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findUnique({ where: { id: ingredientId } });
    if (!ingredient) throw new Error("Bahan baku tidak ditemukan");
    if (!ingredient.isActive) throw new Error("Bahan baku berstatus tidak aktif");

    const { baseQuantity: quantity, enteredUnit, factor } = convertStockQuantity(ingredient, enteredQuantity, params.inputUnit, params.expectedFactor);
    const beforeQty = ingredient.currentStock;
    if ((type === TransactionType.OUT || type === TransactionType.WASTE) && beforeQty + EPSILON < quantity) {
      throw new Error(`Saldo tidak mencukupi. Saldo saat ini: ${beforeQty} ${ingredient.unit}`);
    }
    const batches = await tx.ingredientBatch.findMany({ where: { ingredientId } });
    if (!Number.isFinite(beforeQty) || beforeQty < 0 || batches.some(b => !Number.isFinite(b.quantityRemaining) || b.quantityRemaining < 0)) {
      throw new Error("Saldo stok tidak valid. Periksa data sebelum melanjutkan.");
    }
    const tracked = batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
    // Do not silently rewrite existing inventory when old data is inconsistent.
    if (tracked > beforeQty + EPSILON) {
      throw new Error("Saldo batch melebihi saldo bahan baku. Perlu rekonsiliasi data lama.");
    }
    const legacyQty = Math.max(0, clean(beforeQty - tracked));
    let afterQty = beforeQty;
    let linkedBatchId: string | null = null;

    if (type === TransactionType.IN) {
      const batch = await tx.ingredientBatch.create({
        data: {
          ingredientId,
          lotCode: params.lotCode?.trim() || null,
          quantityRemaining: quantity,
          receivedAt: dates!.receivedAt,
          expiresAt: dates!.expiresAt,
        },
      });
      linkedBatchId = batch.id;
      afterQty = beforeQty + quantity;
    } else {
      const batch = batchId ? batches.find(b => b.id === batchId) : undefined;
      if (batchId && !batch) throw new Error("Batch tidak valid untuk bahan baku ini");
      if (type === TransactionType.OUT && batch && isBatchExpired(batch.expiresAt)) {
        throw new Error("Batch kedaluwarsa tidak boleh dipakai. Catat sebagai waste.");
      }
      const available = batch ? batch.quantityRemaining : legacyQty;
      if (type !== TransactionType.ADJUSTMENT && quantity > available + EPSILON) {
        throw new Error("Saldo tidak mencukupi pada batch atau stok lama yang dipilih. Pilih batch lain.");
      }
      if (type === TransactionType.ADJUSTMENT && !batch && legacyQty === 0 && quantity > 0) {
        throw new Error("Tidak ada stok lama tanpa batch. Gunakan transaksi Masuk untuk menambah stok baru.");
      }
      const remaining = type === TransactionType.ADJUSTMENT ? quantity : Math.max(0, clean(available - quantity));
      afterQty = clean(beforeQty + (remaining - available));
      if (batch) {
        linkedBatchId = batch.id;
        await tx.ingredientBatch.update({ where: { id: batch.id }, data: { quantityRemaining: remaining } });
      }
    }
    if (!Number.isSafeInteger(afterQty) || afterQty < 0) throw new Error("Mutasi ditolak: stok tidak boleh negatif atau tidak valid");

    await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: afterQty } });
    const transaction = await tx.stockTransaction.create({
      data: {
        ingredientId, userId, batchId: linkedBatchId, type, quantity, beforeQty, afterQty,
        enteredQuantity, enteredUnit, enteredFactor: factor,
        note: note || null, wasteReason: type === TransactionType.WASTE ? wasteReason || null : null,
        idempotencyKey: idempotencyKey || null,
      },
    });
    return { transactionId: transaction.id, ingredientId, type, quantity, beforeQty, afterQty, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
