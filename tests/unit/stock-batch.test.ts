import { describe, expect, it, vi } from "vitest";
import { TransactionType, WasteReason } from "@prisma/client";
import { executeStockMutation } from "@/backend/inventory/stock-service";
import { expiryAlertEnd, isBatchExpired, jakartaDateKey, parseReceiptDates } from "@/shared/inventory/stock-dates";

const now = new Date("2026-11-16T12:00:00+07:00");
const futureBatch = { id: "b1", quantityRemaining: 700, expiresAt: new Date("2099-01-01T00:00:00+07:00") };
const expiredBatch = { id: "b2", quantityRemaining: 200, expiresAt: new Date("2000-01-01T00:00:00+07:00") };
function fixture() {
  const tx = {
    ingredient: { findUnique: vi.fn().mockResolvedValue({ id: "i1", currentStock: 1000, isActive: true, unit: "ml" }), update: vi.fn() },
    ingredientBatch: { findMany: vi.fn().mockResolvedValue([futureBatch, expiredBatch]), create: vi.fn().mockResolvedValue({ id: "new-batch" }), update: vi.fn() },
    stockTransaction: { create: vi.fn().mockResolvedValue({ id: "t1" }) },
  };
  const prisma = { $transaction: vi.fn().mockImplementation(async callback => callback(tx)) } as any;
  return { prisma, tx };
}
const base = { ingredientId: "i1", userId: "u1" };
describe("Batch expiry and inventory integrity", () => {
  it("validates calendar dates and treats expiry date as inclusive WIB", () => {
    expect(jakartaDateKey(now)).toBe("2026-11-16");
    const dates = parseReceiptDates("2026-11-15", "2026-11-16", now);
    expect(dates.expiresAt?.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(isBatchExpired(dates.expiresAt, now)).toBe(false);
    expect(isBatchExpired(dates.expiresAt, new Date("2026-11-17T00:00:00+07:00"))).toBe(true);
    expect(expiryAlertEnd(now, 3).toISOString()).toBe("2026-11-19T16:59:59.999Z");
    expect(() => parseReceiptDates("2026-11-15", "2026-11-14", now)).toThrow();
    expect(() => parseReceiptDates("2026-02-30", undefined, now)).toThrow();
  });
  it("creates a separate receipt batch with expiry and increases total", async () => {
    const { prisma, tx } = fixture();
    const r = await executeStockMutation(prisma, { ...base, type: TransactionType.IN, quantity: 300, lotCode: "LOT-NEW", receivedDate: "2000-01-01", expiryDate: "2099-01-02" });
    expect(r.afterQty).toBe(1300);
    expect(tx.ingredientBatch.create).toHaveBeenCalledWith({ data: expect.objectContaining({ lotCode: "LOT-NEW", quantityRemaining: 300, expiresAt: new Date("2099-01-01T17:00:00Z") }) });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ batchId: "new-batch" }) });
  });
  it("deducts a selected batch and total, leaving other batches untouched", async () => {
    const { prisma, tx } = fixture();
    const r = await executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 300, batchId: "b1" });
    expect(r.afterQty).toBe(700);
    expect(tx.ingredientBatch.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { quantityRemaining: 400 } });
  });
  it("rejects expired OUT and allows WASTE", async () => {
    const { prisma, tx } = fixture();
    await expect(executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 100, batchId: "b2" })).rejects.toThrow(/kedaluwarsa/);
    const r = await executeStockMutation(prisma, { ...base, type: TransactionType.WASTE, quantity: 200, batchId: "b2", wasteReason: WasteReason.EXPIRED });
    expect(r.afterQty).toBe(800);
    expect(tx.ingredientBatch.update).toHaveBeenCalledWith({ where: { id: "b2" }, data: { quantityRemaining: 0 } });
  });
  it("limits untracked stock to existing legacy balance", async () => {
    const { prisma, tx } = fixture();
    await expect(executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 101 })).rejects.toThrow(/Saldo tidak mencukupi/);
    expect((await executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 100 })).afterQty).toBe(900);
    expect(tx.ingredientBatch.update).not.toHaveBeenCalled();
  });
  it("supports zero batch count in opname", async () => {
    const { prisma, tx } = fixture();
    expect((await executeStockMutation(prisma, { ...base, type: TransactionType.ADJUSTMENT, quantity: 0, batchId: "b1" })).afterQty).toBe(300);
    expect(tx.ingredientBatch.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { quantityRemaining: 0 } });
  });
});
