import { describe, expect, it, vi } from "vitest";
import { answerMenuQuery } from "@/backend/assistant/menu-ai-service";
import { menuAccess } from "@/backend/menus/menu-access";
import { saveMenu } from "@/backend/menus/menu-service";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), userFind: vi.fn(), transaction: vi.fn() }));
vi.mock("@/backend/auth", () => ({ getCurrentUser: mocks.getUser }));
vi.mock("@/backend/db", () => ({ prisma: { user: { findUnique: mocks.userFind }, $transaction: mocks.transaction } }));

const basic = { name: "Matcha Berry", category: "Matcha", tags: ["Buah"], price: 24000, description: "Matcha dengan stroberi", aliases: ["green berry"], ingredientIds: ["i1"] };
describe("Owner menu management", () => {
  it("blocks anonymous, staff, and inactive owner sessions", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    expect((await menuAccess(true))?.status).toBe(401);
    mocks.getUser.mockResolvedValue({ userId: "u1", role: "STAFF" });
    mocks.userFind.mockResolvedValue({ role: "STAFF", isActive: true });
    expect((await menuAccess(true))?.status).toBe(403);
    expect(await menuAccess()).toBeNull();
    mocks.getUser.mockResolvedValue({ userId: "u1", role: "OWNER" });
    mocks.userFind.mockResolvedValue({ role: "OWNER", isActive: false });
    expect((await menuAccess(true))?.status).toBe(403);
    mocks.userFind.mockResolvedValue({ role: "OWNER", isActive: true });
    expect(await menuAccess(true)).toBeNull();
  });
  it("persists menu, catalog tags, alias and composition in one transaction", async () => {
    const tx = { menu: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new" }) }, menuAlias: { findMany: vi.fn().mockResolvedValue([]) }, ingredient: { findMany: vi.fn().mockResolvedValue([{ id: "i1", isActive: true }]) }, menuTag: { upsert: vi.fn().mockImplementation(async ({ create }) => ({ id: create.key, ...create })) } };
    mocks.transaction.mockImplementation(fn => fn(tx));
    await expect(saveMenu(basic)).resolves.toEqual({ id: "new" });
    expect(tx.menu.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: basic.name, category: "Matcha", price: 24000, aliases: { create: [{ alias: "green berry" }] }, tags: { connect: [{ id: "buah" }, { id: "matcha" }] }, ingredients: { create: [{ ingredient: { connect: { id: "i1" } } }] } }) }));
    tx.menuAlias.findMany.mockResolvedValue([{ alias: "green berry" }]);
    await expect(saveMenu(basic)).rejects.toThrow("Istilah sudah digunakan");
  });
  it("matches added alias or additional tag in the assistant", async () => {
    const rows = [{ ...basic, id: "m1", isAvailable: true, aliases: [{ alias: "green berry" }], tags: [{ name: "Buah" }], ingredients: [] }];
    const db = { menu: { findMany: vi.fn().mockResolvedValue(rows) } } as any;
    expect((await answerMenuQuery(db, "berapa harga green berry?")).answer).toContain("24.000");
    expect((await answerMenuQuery(db, "buah")).matchedMenuItems).toContain("Matcha Berry");
    expect(db.menu.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isAvailable: true }, include: expect.objectContaining({ tags: true }) }));
  });
});
