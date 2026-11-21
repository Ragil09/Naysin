import { PrismaClient } from "@prisma/client";
import { expiryAlertEnd, isBatchExpired } from "@/shared/inventory/stock-dates";

export interface StockSummaryAlerts {
  totalIngredients: number;
  lowStockCount: number;
  expiringBatchesCount: number;
  expiredBatchesCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    alternateUnit?: string | null;
    unitsPerAlternate?: number | null;
  }>;
  expiringBatches: Array<{
    id: string;
    ingredientName: string;
    lotCode: string | null;
    quantityRemaining: number;
    unit: string;
    alternateUnit?: string | null;
    unitsPerAlternate?: number | null;
    expiresAt: Date;
    isExpired: boolean;
  }>;
}

/**
 * Request-time deterministic calculation for stock alerts and summary.
 * Complies with Netlify Serverless stateless constraints (no daemon/cron required).
 */
export async function calculateStockSummary(
  prisma: PrismaClient,
  thresholdDays: number = 3
): Promise<StockSummaryAlerts> {
  const now = new Date();
  const thresholdDate = expiryAlertEnd(now, thresholdDays);

  const [ingredients, batches] = await Promise.all([
    prisma.ingredient.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minimumStock: true,
        unit: true,
        alternateUnit: true,
        unitsPerAlternate: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.ingredientBatch.findMany({
      where: {
        ingredient: { isActive: true },
        quantityRemaining: { gt: 0 },
        expiresAt: { not: null, lte: thresholdDate },
      },
      include: {
        ingredient: {
          select: { name: true, unit: true, alternateUnit: true, unitsPerAlternate: true },
        },
      },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  const lowStockItems = ingredients.filter(
    (item) => item.currentStock <= item.minimumStock
  );

  let expiredBatchesCount = 0;
  let expiringBatchesCount = 0;

  const expiringBatches = batches.map((b) => {
    const isExpired = isBatchExpired(b.expiresAt, now);
    if (isExpired) {
      expiredBatchesCount++;
    } else {
      expiringBatchesCount++;
    }
    return {
      id: b.id,
      ingredientName: b.ingredient.name,
      lotCode: b.lotCode,
      quantityRemaining: b.quantityRemaining,
      unit: b.ingredient.unit,
      alternateUnit: b.ingredient.alternateUnit,
      unitsPerAlternate: b.ingredient.unitsPerAlternate,
      expiresAt: b.expiresAt!,
      isExpired,
    };
  });

  return {
    totalIngredients: ingredients.length,
    lowStockCount: lowStockItems.length,
    expiringBatchesCount,
    expiredBatchesCount,
    lowStockItems,
    expiringBatches,
  };
}

