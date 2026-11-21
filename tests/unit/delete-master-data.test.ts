import { describe, expect, it, vi, beforeEach } from "vitest";
import { ingredientDeleteDecision } from "@/backend/inventory/ingredient-delete-helpers";
import { DELETE as deleteIngredient } from "@/app/api/ingredients/[id]/route";
import { DELETE as deleteMenu } from "@/app/api/menus/[id]/route";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), account: vi.fn(), ingredientFind: vi.fn(), ingredientDelete: vi.fn(), ingredientUpdate: vi.fn(), menuDelete: vi.fn(),
}));
vi.mock("@/backend/auth", () => ({ getCurrentUser: mock.getUser }));
vi.mock("@/backend/db", () => ({ prisma: {
  user: { findUnique: mock.account },
  ingredient: { findUnique: mock.ingredientFind, delete: mock.ingredientDelete, update: mock.ingredientUpdate },
  menu: { deleteMany: mock.menuDelete },
  $transaction: async (callback: (tx: unknown) => unknown) => callback({
    ingredient: { findUnique: mock.ingredientFind, delete: mock.ingredientDelete, update: mock.ingredientUpdate },
  }),
} }));

const context = { params: Promise.resolve({ id: "item-1" }) };
const request = {} as any;

describe("Master data deletion - role and inventory safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.getUser.mockResolvedValue({ userId: "owner-1", role: "OWNER" });
    mock.account.mockResolvedValue({ role: "OWNER", isActive: true });
    mock.ingredientFind.mockResolvedValue({ id: "item-1", isActive: true, currentStock: 0, _count: { menuItems: 0, batches: 0, transactions: 0 } });
    mock.ingredientDelete.mockResolvedValue({ id: "item-1" });
    mock.ingredientUpdate.mockResolvedValue({ id: "item-1", isActive: false });
    mock.menuDelete.mockResolvedValue({ count: 1 });
  });
  it("requires login for both DELETE APIs", async () => {
    mock.getUser.mockResolvedValue(null);
    expect((await deleteIngredient(request, context)).status).toBe(401);
    expect((await deleteMenu(request, context)).status).toBe(401);
  });
  it("denies Staff even when calling API directly", async () => {
    mock.getUser.mockResolvedValue({ userId: "staff-1", role: "STAFF" });
    mock.account.mockResolvedValue({ role: "STAFF", isActive: true });
    expect((await deleteIngredient(request, context)).status).toBe(403);
    expect((await deleteMenu(request, context)).status).toBe(403);
    expect(mock.ingredientDelete).not.toHaveBeenCalled();
    expect(mock.menuDelete).not.toHaveBeenCalled();
  });
  it("rejects inactive owner account even with an old OWNER cookie", async () => {
    mock.account.mockResolvedValue({ role: "OWNER", isActive: false });
    expect((await deleteIngredient(request, context)).status).toBe(403);
    expect((await deleteMenu(request, context)).status).toBe(403);
  });
  it("blocks stock and menu-linked ingredients", async () => {
    expect(ingredientDeleteDecision({ currentStock: 12, menuItems: 0, batches: 0, transactions: 0 }).allowed).toBe(false);
    expect(ingredientDeleteDecision({ currentStock: 0, menuItems: 1, batches: 0, transactions: 0 }).allowed).toBe(false);
    mock.ingredientFind.mockResolvedValue({ id: "item-1", isActive: true, currentStock: 2, _count: { menuItems: 0, batches: 0, transactions: 0 } });
    expect((await deleteIngredient(request, context)).status).toBe(409);
    expect(mock.ingredientDelete).not.toHaveBeenCalled();
  });
  it("hard deletes only unused zero-stock ingredients", async () => {
    const res = await deleteIngredient(request, context);
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("deleted");
    expect(mock.ingredientDelete).toHaveBeenCalledTimes(1);
  });
  it("archives zero-stock ingredients when transaction history exists", async () => {
    mock.ingredientFind.mockResolvedValue({ id: "item-1", isActive: true, currentStock: 0, _count: { menuItems: 0, batches: 1, transactions: 3 } });
    const res = await deleteIngredient(request, context);
    expect((await res.json()).action).toBe("archived");
    expect(mock.ingredientUpdate).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { isActive: false } });
    expect(mock.ingredientDelete).not.toHaveBeenCalled();
  });
  it("removes menu with owner privileges, leaving ingredients intact", async () => {
    const res = await deleteMenu(request, context);
    expect(res.status).toBe(200);
    expect(mock.menuDelete).toHaveBeenCalledWith({ where: { id: "item-1" } });
    expect(mock.ingredientDelete).not.toHaveBeenCalled();
  });
});
