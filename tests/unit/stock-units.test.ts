import { describe, expect, it, vi } from "vitest";
import { TransactionType } from "@prisma/client";
import { convertStockQuantity, formatStock, readUnitConfig } from "@/shared/inventory/stock-units";
import { executeStockMutation } from "@/backend/inventory/stock-service";

const config = { unit: "kotak", alternateUnit: "dus", unitsPerAlternate: 12 };
function fixture() {
  const state = { stock: 32, batches: [{ id: "b1", quantityRemaining: 32, expiresAt: null as Date | null }], logs: [] as any[] };
  const tx = {
    ingredient: { findUnique: vi.fn(async () => ({ ...config, isActive: true, currentStock: state.stock })), update: vi.fn(async ({ data }: any) => { state.stock = data.currentStock; }) },
    ingredientBatch: { findMany: vi.fn(async () => state.batches), create: vi.fn(async ({ data }: any) => { const batch = { id: "b2", ...data }; state.batches.push(batch); return batch; }), update: vi.fn(async ({ where, data }: any) => Object.assign(state.batches.find(b => b.id === where.id)!, data)) },
    stockTransaction: { create: vi.fn(async ({ data }: any) => { state.logs.push(data); return { id: "t1" }; }) },
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as any;
  return { prisma, state };
}
const base = { ingredientId: "i1", userId: "u1" };
describe("Package units", () => {
  it("validates configurable units", () => {
    expect(readUnitConfig(" Kotak ", "DUS", 12)).toEqual(config);
    expect(readUnitConfig("botol", "", 12)).toEqual({ unit: "botol", alternateUnit: null, unitsPerAlternate: null });
    for (const f of [0, 1, -2, 1.5, 2147483648]) expect(() => readUnitConfig("kotak", "dus", f)).toThrow();
    expect(() => readUnitConfig("ml", "dus", 12)).toThrow();
    expect(() => readUnitConfig("kotak", "KOTAK", 12)).toThrow();
  });
  it("converts and formats stock in base units", () => {
    expect(convertStockQuantity(config, 2, "dus", 12).baseQuantity).toBe(24);
    expect(formatStock(32, "kotak", "dus", 12)).toBe("32 kotak (2 dus + 8 kotak)");
    expect(() => convertStockQuantity(config, 2, "botol")).toThrow();
    expect(() => convertStockQuantity(config, 2, "dus", 6)).toThrow();
    expect(() => convertStockQuantity(config, 1.5, "dus")).toThrow();
  });
  it("updates receipt batch and audit with original unit, then OUT and WASTE", async () => {
    const { prisma, state } = fixture();
    await executeStockMutation(prisma, { ...base, type: TransactionType.IN, quantity: 2, inputUnit: "dus", expectedFactor: 12 });
    expect(state.stock).toBe(56);
    expect(state.batches[1].quantityRemaining).toBe(24);
    expect(state.logs[0]).toMatchObject({ quantity: 24, enteredQuantity: 2, enteredUnit: "dus", enteredFactor: 12 });
    await executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 1, inputUnit: "dus", batchId: "b2" });
    expect(state.stock).toBe(44);
    expect(state.batches[1].quantityRemaining).toBe(12);
    await expect(executeStockMutation(prisma, { ...base, type: TransactionType.OUT, quantity: 2, inputUnit: "dus", batchId: "b2" })).rejects.toThrow(/Saldo tidak mencukupi/);
    await executeStockMutation(prisma, { ...base, type: TransactionType.WASTE, quantity: 2, inputUnit: "kotak", batchId: "b2" });
    expect(state.batches[1].quantityRemaining).toBe(10);
    await executeStockMutation(prisma, { ...base, type: TransactionType.ADJUSTMENT, quantity: 0, inputUnit: "kotak", batchId: "b2" });
    expect(state.stock).toBe(32);
    expect(state.batches[1].quantityRemaining).toBe(0);
  });
});
