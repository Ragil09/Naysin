import { PrismaClient, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { jakartaDateKey, parseReceiptDates } from "../src/shared/inventory/stock-dates";

const prisma = new PrismaClient();
const resetDemo = process.argv.includes("--reset-demo");
const DAY = 86_400_000;

async function main() {
  const now = new Date();
  const day = (offset: number) => jakartaDateKey(new Date(now.getTime() + offset * DAY));
  const passwordHash = await bcrypt.hash("naysin2026", 10);

  await prisma.$transaction(async tx => {
    const [db] = await tx.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (resetDemo) {
      // Never reset the original naysin database or a remote deployment.
      const url = new URL(process.env.DATABASE_URL || "");
      if (db?.name !== "naysin2" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        throw new Error("Reset demo hanya diizinkan pada database lokal naysin2.");
      }
      const [nonDemoIngredients, nonDemoMenus] = await Promise.all([
        tx.ingredient.count({ where: { NOT: { name: { endsWith: "[DEMO]" } } } }),
        tx.menu.count({ where: { NOT: { name: { endsWith: "[DEMO]" } } } }),
      ]);
      if (nonDemoIngredients || nonDemoMenus) throw new Error("Ditemukan bahan/menu non-demo. Reset dibatalkan agar data asli tidak terhapus.");
      // Explicit reset: clears all demo inventory/menu, batches and stock history. Users and settings remain.
      await tx.stockTransaction.deleteMany();
      await tx.menuIngredient.deleteMany();
      await tx.ingredientBatch.deleteMany();
      await tx.menuAlias.deleteMany();
      await tx.menu.deleteMany();
      await tx.ingredient.deleteMany();
    } else if (await tx.ingredient.count() || await tx.menu.count()) {
      throw new Error("Database sudah berisi bahan/menu. Seed dibatalkan untuk mencegah campuran satuan atau batch ganda. Pada database demo naysin2, gunakan --reset-demo jika ingin mengganti data.");
    }

    const owner = await tx.user.upsert({ where: { email: "owner@nayskopi.demo" }, update: { username: "owner" }, create: { username: "owner", name: "Tegar Owner [DEMO]", email: "owner@nayskopi.demo", passwordHash, role: Role.OWNER, isActive: true } });
    await tx.user.upsert({ where: { email: "staff@nayskopi.demo" }, update: { username: "staff" }, create: { username: "staff", name: "Barista Staf [DEMO]", email: "staff@nayskopi.demo", passwordHash, role: Role.STAFF, isActive: true } });

    const ingredients = [
      { name: "Biji Kopi House Blend [DEMO]", unit: "pouch", alternateUnit: "dus", unitsPerAlternate: 6, minimumStock: 4, notes: "Racikan robusta-arabika. Isi dus merupakan contoh, bukan data mitra.", batches: [{ lotCode: "LOT-COFFEE-001", qty: 12, received: -3, expiry: 60 }] },
      { name: "Susu Segar Pasteurisasi [DEMO]", unit: "kotak", alternateUnit: "dus", unitsPerAlternate: 12, minimumStock: 12, notes: "Penyimpanan chiller 4C. Satu dus berisi 12 kotak (contoh).", batches: [{ lotCode: "LOT-MILK-001", qty: 12, received: -4, expiry: 2 }, { lotCode: "LOT-MILK-002", qty: 18, received: -1, expiry: 7 }, { lotCode: "LOT-MILK-003", qty: 2, received: -7, expiry: -1 }] },
      { name: "Sirup Gula Aren Asli [DEMO]", unit: "botol", alternateUnit: "dus", unitsPerAlternate: 6, minimumStock: 4, notes: "Bahan pemanis utama Kopi Nays.", batches: [{ lotCode: "LOT-SUGAR-001", qty: 3, received: -5, expiry: 45 }] },
      { name: "Bubuk Matcha [DEMO]", unit: "pouch", alternateUnit: "dus", unitsPerAlternate: 10, minimumStock: 3, notes: "Simpan di tempat kering dan tertutup.", batches: [{ lotCode: "LOT-MATCHA-001", qty: 8, received: -2, expiry: 90 }] },
      { name: "Gelas Kopi Takeaway [DEMO]", unit: "pcs", alternateUnit: "pak", unitsPerAlternate: 50, minimumStock: 50, notes: "Kemasan non-pangan; tidak memiliki tanggal kedaluwarsa.", batches: [{ lotCode: "LOT-CUP-001", qty: 150, received: -2, expiry: null }] },
    ];
    for (const { batches, ...data } of ingredients) {
      const ingredient = await tx.ingredient.create({ data: { ...data, currentStock: batches.reduce((total, b) => total + b.qty, 0) } });
      let balance = 0;
      for (const b of [...batches].sort((a, b) => a.received - b.received)) {
        const { receivedAt, expiresAt } = parseReceiptDates(day(b.received), b.expiry === null ? undefined : day(b.expiry), now);
        const batch = await tx.ingredientBatch.create({ data: { ingredientId: ingredient.id, lotCode: b.lotCode, quantityRemaining: b.qty, receivedAt, expiresAt } });
        // Seed receipts for a consistent audit trail in base units.
        await tx.stockTransaction.create({ data: { ingredientId: ingredient.id, batchId: batch.id, userId: owner.id, type: "IN", quantity: b.qty, beforeQty: balance, afterQty: balance + b.qty, enteredQuantity: b.qty, enteredUnit: ingredient.unit, enteredFactor: 1, note: "Saldo awal [DEMO]", createdAt: receivedAt } });
        balance += b.qty;
      }
    }

    await tx.menu.create({ data: { name: "Kopi Nays [DEMO]", category: "Kopi", description: "Signature coffee Nays Kopi: perpaduan espresso mantap, susu segar gurih, dan sirup gula aren asli.", price: 18000, isAvailable: true, aliases: { create: [{ alias: "kopi aren" }, { alias: "es kopi aren" }, { alias: "kopi gula aren" }, { alias: "kopi signature" }] } } });
    await tx.menu.create({ data: { name: "Matcha Latte [DEMO]", category: "Non-Kopi", description: "Matcha bubuk murni kualitas prima diseduh dengan susu segar hangat atau dingin yang lembut.", price: 20000, isAvailable: true, aliases: { create: [{ alias: "matcha" }, { alias: "green tea" }] } } });
    await tx.setting.upsert({ where: { key: "EXPIRY_THRESHOLD_DAYS" }, update: {}, create: { key: "EXPIRY_THRESHOLD_DAYS", value: "3" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  console.log("Seed berhasil: 5 bahan, 7 batch, 7 transaksi awal, 2 menu demo. Satuan kemasan aktif.");
}

main().catch(e => { console.error("Seed error:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
