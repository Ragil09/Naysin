import { randomInt } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/backend/db";
import { hashPassword } from "@/backend/auth";
import {
  generatedUsername, normalizeEmployeeId, normalizeFullName, normalizeUsernameInput,
} from "./username";

export class AccountValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const PUBLIC_FIELDS = {
  id: true, name: true, username: true, employeeId: true,
  role: true, isActive: true, createdAt: true,
} as const;

function raiseValidation(err: unknown): never {
  throw new AccountValidationError(err instanceof Error ? err.message : "Data akun tidak valid");
}

function knownUniqueError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.map(String) : [];
    if (target.includes("employeeId")) throw new AccountValidationError("ID karyawan sudah digunakan", 409);
    throw new AccountValidationError("Username atau ID karyawan sudah digunakan", 409);
  }
  throw err;
}

async function unusedUsername(name: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = generatedUsername(name, randomInt(1000, 10000));
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new AccountValidationError("Gagal menghasilkan username unik. Coba lagi.", 409);
}

/** Preview is not a reservation; POST always checks uniqueness again. */
export async function nextAvailableUsername(name: string): Promise<string> {
  try { return await unusedUsername(name); } catch (err) {
    if (err instanceof AccountValidationError) throw err;
    return raiseValidation(err);
  }
}

export type CreateUserInput = {
  name?: unknown;
  username?: unknown; // empty means generate first-name + random 4 digits
  employeeId?: unknown;
  role?: unknown;
  password?: unknown;
};

export async function createEmployeeAccount(input: CreateUserInput) {
  let name: string;
  let employeeId: string | null;
  let chosen: string | null;
  try {
    name = normalizeFullName(input?.name);
    employeeId = normalizeEmployeeId(input?.employeeId);
    chosen = typeof input?.username === "string" && input.username.trim()
      ? normalizeUsernameInput(input.username) : null;
    if (!chosen) generatedUsername(name, 1000); // validate first name for auto-generation
  } catch (err) { return raiseValidation(err); }
  if (input.role !== Role.OWNER && input.role !== Role.STAFF) {
    throw new AccountValidationError("Role hanya dapat berupa OWNER atau STAFF");
  }
  if (typeof input.password !== "string" || input.password.length < 10 || input.password.length > 128) {
    throw new AccountValidationError("Password awal harus 10–128 karakter");
  }
  if (employeeId && await prisma.user.findUnique({ where: { employeeId }, select: { id: true } })) {
    throw new AccountValidationError("ID karyawan sudah digunakan", 409);
  }
  const passwordHash = await hashPassword(input.password);
  // Retry random collisions only. Manually entered usernames are never silently changed.
  for (let attempt = 0; attempt < (chosen ? 1 : 100); attempt++) {
    const username = chosen ?? await unusedUsername(name);
    try {
      return await prisma.user.create({
        data: { name, username, employeeId, email: null, passwordHash, role: input.role },
        select: PUBLIC_FIELDS,
      });
    } catch (err) {
      if (!chosen && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.map(String) : [];
        if (target.includes("username")) continue;
      }
      return knownUniqueError(err);
    }
  }
  throw new AccountValidationError("Gagal membuat username unik. Coba lagi.", 409);
}

export type UpdateUserInput = {
  name?: unknown;
  username?: unknown;
  employeeId?: unknown;
  role?: unknown;
  isActive?: unknown;
  password?: unknown; // optional, blank keeps previous password
};

/** Protect the active Owner account and retain history through soft deletion. */
export async function updateEmployeeAccount(id: string, actorId: string, input: UpdateUserInput) {
  let name: string;
  let username: string;
  let employeeId: string | null;
  try {
    name = normalizeFullName(input?.name);
    username = normalizeUsernameInput(input?.username);
    employeeId = normalizeEmployeeId(input?.employeeId);
  } catch (err) { return raiseValidation(err); }
  if (input.role !== Role.OWNER && input.role !== Role.STAFF) {
    throw new AccountValidationError("Role tidak valid");
  }
  if (typeof input.isActive !== "boolean") throw new AccountValidationError("Status akun tidak valid");
  if (input.password != null && typeof input.password !== "string") {
    throw new AccountValidationError("Password tidak valid");
  }
  const password = input.password as string | undefined;
  if (password && (password.length < 10 || password.length > 128)) {
    throw new AccountValidationError("Password baru harus 10–128 karakter");
  }
  // Hash before acquiring the database transaction to minimize lock duration.
  const passwordHash = password ? await hashPassword(password) : undefined;

  try {
    return await prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
      if (!existing) throw new AccountValidationError("Akun tidak ditemukan", 404);
      if (id === actorId && (input.role !== Role.OWNER || !input.isActive)) {
        throw new AccountValidationError("Tidak dapat menurunkan role atau menonaktifkan akun sendiri", 409);
      }
      if (existing.role === Role.OWNER && existing.isActive && (input.role !== Role.OWNER || !input.isActive)) {
        const count = await tx.user.count({ where: { role: Role.OWNER, isActive: true } });
        if (count <= 1) throw new AccountValidationError("Tidak dapat menonaktifkan Owner aktif terakhir", 409);
      }
      return tx.user.update({
        where: { id },
        data: { name, username, employeeId, role: input.role as Role, isActive: input.isActive as boolean, ...(passwordHash ? { passwordHash } : {}) },
        select: PUBLIC_FIELDS,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if (err instanceof AccountValidationError) throw err;
    return knownUniqueError(err);
  }
}

/** Users with stock history must remain as audit references and are deactivated. */
export async function deleteEmployeeAccount(id: string, actorId: string) {
  if (id === actorId) throw new AccountValidationError("Tidak dapat menghapus akun yang sedang digunakan", 409);
  try {
    return await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id }, select: { role: true, isActive: true, _count: { select: { transactions: true } } },
      });
      if (!user) throw new AccountValidationError("Akun tidak ditemukan", 404);
      if (!user.isActive) throw new AccountValidationError("Akun ini sudah nonaktif", 409);
      if (user.role === Role.OWNER) {
        const count = await tx.user.count({ where: { role: Role.OWNER, isActive: true } });
        if (count <= 1) throw new AccountValidationError("Owner aktif terakhir tidak dapat dihapus", 409);
      }
      if (user._count.transactions > 0) {
        await tx.user.update({ where: { id }, data: { isActive: false } });
        return { deleted: false, deactivated: true };
      }
      await tx.user.delete({ where: { id } });
      return { deleted: true, deactivated: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if (err instanceof AccountValidationError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new AccountValidationError("Akun memiliki data terkait sehingga tidak dapat dihapus permanen", 409);
    }
    throw err;
  }
}
