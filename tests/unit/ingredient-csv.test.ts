import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildIngredientCsv } from "@/backend/inventory/ingredient-csv";
import { GET } from "@/app/api/ingredients/export/route";
const mocks = vi.hoisted(() => ({ session: vi.fn(), account: vi.fn(), ingredients: vi.fn() }));
vi.mock("@/backend/auth", () => ({ getCurrentUser: mocks.session }));
vi.mock("@/backend/db", () => ({ prisma: { user: { findUnique: mocks.account }, ingredient: { findMany: mocks.ingredients } } }));
vi.mock("@prisma/client", () => ({ Role: { OWNER: "OWNER", STAFF: "STAFF" } }));
vi.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init: ResponseInit) => Response.json(body, init) } }));
const milk = { name: 'Susu, "Segar"', currentStock: 32, minimumStock: 12, unit: "kotak", alternateUnit: "dus", unitsPerAlternate: 12, isActive: true, notes: "=1+1" };

describe("ingredient CSV", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("preserves package units, escapes quotes and neutralizes formulas", () => {
    const csv = buildIngredientCsv([milk]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Susu, ""Segar""",32,"kotak","dus",12,12,"Aman","Aktif","\'=1+1"');
    expect(buildIngredientCsv([]).split("\r\n")).toHaveLength(2);
  });
  it("rejects unauthenticated requests", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.ingredients).not.toHaveBeenCalled();
  });
  it("rejects Staff, even with direct API access", async () => {
    mocks.session.mockResolvedValue({ role: "STAFF" });
    expect((await GET()).status).toBe(403);
    expect(mocks.ingredients).not.toHaveBeenCalled();
  });
  it("rejects an inactive or downgraded Owner", async () => {
    mocks.session.mockResolvedValue({ userId: "demo", role: "OWNER" });
    mocks.account.mockResolvedValue({ isActive: true, role: "STAFF" });
    expect((await GET()).status).toBe(403);
    expect(mocks.ingredients).not.toHaveBeenCalled();
  });
  it("returns CSV only for an active Owner", async () => {
    mocks.session.mockResolvedValue({ userId: "demo", role: "OWNER" });
    mocks.account.mockResolvedValue({ isActive: true, role: "OWNER" });
    mocks.ingredients.mockResolvedValue([milk]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.text()).toContain('"kotak","dus",12');
  });
});
