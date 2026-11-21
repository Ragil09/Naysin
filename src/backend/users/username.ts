/** Account names and usernames are stored separately. New accounts can use
 * an automatically generated first-name + four-digit username or a manual one. */
export function normalizeFullName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Nama lengkap wajib diisi");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120) throw new Error("Nama lengkap harus 3–120 karakter");
  return name;
}

/** Extract the Latin first name; it is never used as a username without digits
 * when creating a new account. usernameCandidate is kept for legacy backfill. */
export function usernameBase(fullName: string): string {
  const name = normalizeFullName(fullName);
  const first = name.split(" ")[0]
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 28);
  if (!first) throw new Error("Nama depan harus mengandung huruf Latin");
  return first;
}

/** Four digits are always added, even for the first account with a given name. */
export function generatedUsername(fullName: string, digits: number): string {
  if (!Number.isInteger(digits) || digits < 1000 || digits > 9999) {
    throw new Error("Angka acak harus empat digit");
  }
  return `${usernameBase(fullName)}${digits}`;
}

/** Kept for one-time legacy username migration. Not used for new accounts. */
export function usernameCandidate(base: string, n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error("Nomor kandidat tidak valid");
  const suffix = n === 1 ? "" : String(n);
  return base.slice(0, 32 - suffix.length) + suffix;
}

export function normalizeUsernameInput(value: unknown): string {
  if (typeof value !== "string") throw new Error("Username wajib berupa teks");
  const username = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error("Username harus 3–32 karakter, diawali huruf, dan hanya boleh huruf kecil, angka, titik, underscore, atau strip");
  }
  return username;
}

export function normalizeEmployeeId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("ID karyawan harus berupa teks");
  const id = value.trim().toUpperCase();
  if (!id) return null;
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(id)) {
    throw new Error("ID karyawan maksimal 32 karakter (huruf, angka, titik, strip, garis miring, atau underscore)");
  }
  return id;
}
