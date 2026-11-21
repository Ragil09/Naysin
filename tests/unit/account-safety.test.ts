import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteEmployeeAccount, updateEmployeeAccount, AccountValidationError } from "@/backend/users/user-service";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), count: vi.fn(), del: vi.fn(), update: vi.fn(), transaction: vi.fn(), hash: vi.fn(),
}));
vi.mock("@/backend/db", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/backend/auth", () => ({ hashPassword: mocks.hash }));

const tx = {
  user: { findUnique: mocks.findUnique, count: mocks.count, delete: mocks.del, update: mocks.update },
};

describe("Pengamanan edit dan hapus akun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    mocks.hash.mockResolvedValue("hash");
    mocks.count.mockResolvedValue(2);
    mocks.del.mockResolvedValue({});
    mocks.update.mockResolvedValue({ id: "u2", username: "siti4821" });
  });
  it("Owner tidak boleh menghapus dirinya sendiri", async () => {
    await expect(deleteEmployeeAccount("u1", "u1")).rejects.toBeInstanceOf(AccountValidationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("Akun dengan transaksi tidak dihapus fisik", async () => {
    mocks.findUnique.mockResolvedValue({ role: "STAFF", isActive: true, _count: { transactions: 3 } });
    await expect(deleteEmployeeAccount("u2", "u1")).resolves.toEqual({ deleted: false, deactivated: true });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { isActive: false } });
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it("Akun tanpa transaksi bisa dihapus fisik", async () => {
    mocks.findUnique.mockResolvedValue({ role: "STAFF", isActive: true, _count: { transactions: 0 } });
    await expect(deleteEmployeeAccount("u2", "u1")).resolves.toEqual({ deleted: true, deactivated: false });
    expect(mocks.del).toHaveBeenCalledWith({ where: { id: "u2" } });
  });
  it("Owner aktif terakhir tidak dapat dihapus", async () => {
    mocks.findUnique.mockResolvedValue({ role: "OWNER", isActive: true, _count: { transactions: 0 } });
    mocks.count.mockResolvedValue(1);
    await expect(deleteEmployeeAccount("u2", "u1")).rejects.toMatchObject({ status: 409 });
  });
  it("Owner tidak bisa menonaktifkan dirinya sendiri lewat edit", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u1", role: "OWNER", isActive: true });
    await expect(updateEmployeeAccount("u1", "u1", {
      name: "Budi Santoso", username: "budi1234", role: "OWNER", isActive: false,
    })).rejects.toMatchObject({ status: 409 });
  });
});
