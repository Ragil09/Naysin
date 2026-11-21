import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { executeStockMutation } from "@/backend/inventory/stock-service";
import { TransactionType, WasteReason } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ingredientId = searchParams.get("ingredientId");
  const type = searchParams.get("type") as TransactionType | null;

  const where: any = {};
  if (ingredientId) where.ingredientId = ingredientId;
  if (type) where.type = type;

  const transactions = await prisma.stockTransaction.findMany({
    where,
    include: {
      ingredient: { select: { name: true, unit: true } },
      user: { select: { name: true, role: true } },
      batch: { select: { lotCode: true, expiresAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      ingredientId,
      type,
      quantity,
      inputUnit,
      expectedFactor,
      batchId,
      lotCode,
      receivedDate,
      expiryDate,
      note,
      wasteReason,
      idempotencyKey,
    } = body;

    if (typeof ingredientId !== "string" || !ingredientId || !type ||
        (typeof quantity !== "number" && (typeof quantity !== "string" || !quantity.trim()))) {
      return NextResponse.json(
        { error: "ingredientId, type, dan quantity wajib diisi" },
        { status: 400 }
      );
    }

    if ([inputUnit, batchId, lotCode, receivedDate, expiryDate, note, idempotencyKey].some(
      (value) => value !== undefined && value !== null && typeof value !== "string"
    )) {
      return NextResponse.json({ error: "Data transaksi tidak valid" }, { status: 400 });
    }

    if (expectedFactor !== undefined && (typeof expectedFactor !== "number" || !Number.isSafeInteger(expectedFactor))) {
      return NextResponse.json({ error: "Faktor konversi tidak valid" }, { status: 400 });
    }

    const result = await executeStockMutation(prisma, {
      ingredientId,
      type: type as TransactionType,
      quantity: Number(quantity),
      inputUnit: inputUnit || undefined,
      expectedFactor,
      userId: user.userId,
      batchId: batchId || undefined,
      lotCode: lotCode || undefined,
      receivedDate: receivedDate || undefined,
      expiryDate: expiryDate || undefined,
      note: note || undefined,
      wasteReason: wasteReason as WasteReason | undefined,
      idempotencyKey: idempotencyKey || undefined,
    });

    return NextResponse.json({ result }, { status: result.idempotentReplay ? 200 : 201 });
  } catch (error: any) {
    if (error.code === "P2034" || error.code === "P2002") {
      return NextResponse.json({ error: "Transaksi stok bersamaan atau duplikat. Periksa riwayat sebelum mencoba kembali." }, { status: 409 });
    }
    console.error("Stock mutation error:", error.message);
    const isConflict = error.message.includes("Saldo tidak mencukupi") || error.message.includes("stok tidak boleh negatif");
    return NextResponse.json(
      { error: error.message || "Gagal memproses mutasi stok" },
      { status: isConflict ? 409 : 400 }
    );
  }
}

