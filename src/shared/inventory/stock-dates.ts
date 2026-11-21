// Nays Kopi operates in WIB (UTC+07:00). Expiry input is a calendar date.
const DAY_MS = 86_400_000;

export function jakartaDateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function jakartaDayStart(value: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Format tanggal harus YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || jakartaDateKey(date) !== value) {
    throw new Error("Tanggal tidak valid");
  }
  return date;
}

export function isBatchExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && jakartaDateKey(expiresAt) < jakartaDateKey(now);
}

export function expiryAlertEnd(now: Date, thresholdDays: number): Date {
  return new Date(jakartaDayStart(jakartaDateKey(now)).getTime() + (thresholdDays + 1) * DAY_MS - 1);
}

export function parseReceiptDates(receivedDate?: string, expiryDate?: string, now: Date = new Date()) {
  const received = receivedDate === undefined ? jakartaDateKey(now) : receivedDate;
  const receivedAt = jakartaDayStart(received);
  if (received > jakartaDateKey(now)) {
    throw new Error("Tanggal penerimaan tidak boleh di masa depan");
  }
  if (expiryDate === undefined) return { receivedAt, expiresAt: null };
  const expiresAt = jakartaDayStart(expiryDate);
  if (expiryDate < received) {
    throw new Error("Tanggal kedaluwarsa tidak boleh sebelum tanggal penerimaan");
  }
  return { receivedAt, expiresAt };
}
