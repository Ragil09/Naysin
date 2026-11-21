import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/users/route";
import { GET as SUGGEST } from "@/app/api/users/username-suggestion/route";
import { PATCH, DELETE } from "@/app/api/users/[id]/route";

const mock = vi.hoisted(() => ({
  current: vi.fn(), findMany: vi.fn(), createAccount: vi.fn(), suggest: vi.fn(),
  editAccount: vi.fn(), deleteAccount: vi.fn(),
}));
vi.mock("@/backend/auth", () => ({ getCurrentUser: mock.current }));
vi.mock("@/backend/db", () => ({ prisma: { user: { findMany: mock.findMany } } }));
vi.mock("@/backend/users/user-service", () => ({
  createEmployeeAccount: mock.createAccount,
  nextAvailableUsername: mock.suggest,
  updateEmployeeAccount: mock.editAccount,
  deleteEmployeeAccount: mock.deleteAccount,
  AccountValidationError: class AccountValidationError extends Error {},
}));

const add = () => new Request("http://localhost/api/users", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Siti Aminah", username: "siti2984", role: "STAFF", password: "valid-password" }),
}) as any;
const preview = () => new Request("http://localhost/api/users/username-suggestion?name=Siti%20Aminah") as any;
const edit = () => new Request("http://localhost/api/users/u2", {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Siti Aminah", username: "siti_pegawai", role: "STAFF", isActive: true }),
}) as any;
const remove = () => new Request("http://localhost/api/users/u2", { method: "DELETE" }) as any;
const context = { params: Promise.resolve({ id: "u2" }) };

describe("Hak akses manajemen akun Owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.current.mockResolvedValue({ userId: "u1", role: "OWNER" });
    mock.findMany.mockResolvedValue([]);
    mock.createAccount.mockResolvedValue({ id: "u2", username: "siti2984", role: "STAFF" });
    mock.suggest.mockResolvedValue("siti4821");
    mock.editAccount.mockResolvedValue({ id: "u2", username: "siti_pegawai", role: "STAFF" });
    mock.deleteAccount.mockResolvedValue({ deleted: false, deactivated: true });
  });
  it("menolak tamu pada semua API", async () => {
    mock.current.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(add())).status).toBe(401);
    expect((await SUGGEST(preview())).status).toBe(401);
    expect((await PATCH(edit(), context)).status).toBe(401);
    expect((await DELETE(remove(), context)).status).toBe(401);
  });
  it("menolak Staff pada semua API", async () => {
    mock.current.mockResolvedValue({ userId: "u2", role: "STAFF" });
    expect((await GET()).status).toBe(403);
    expect((await POST(add())).status).toBe(403);
    expect((await SUGGEST(preview())).status).toBe(403);
    expect((await PATCH(edit(), context)).status).toBe(403);
    expect((await DELETE(remove(), context)).status).toBe(403);
    expect(mock.editAccount).not.toHaveBeenCalled();
    expect(mock.deleteAccount).not.toHaveBeenCalled();
  });
  it("mengizinkan Owner melihat, membuat, edit, dan hapus", async () => {
    const list = await GET();
    expect(list.status).toBe(200);
    expect((await list.json()).currentUserId).toBe("u1");
    const createResult = await POST(add());
    expect(createResult.status).toBe(201);
    expect((await createResult.json()).user.username).toBe("siti2984");
    expect((await SUGGEST(preview())).status).toBe(200);
    expect((await PATCH(edit(), context)).status).toBe(200);
    expect(mock.editAccount).toHaveBeenCalledWith("u2", "u1", expect.objectContaining({ username: "siti_pegawai" }));
    const deleted = await DELETE(remove(), context);
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).deactivated).toBe(true);
  });
});
