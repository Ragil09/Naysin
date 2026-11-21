import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/reports/stock/route";

const mocks = vi.hoisted(() => ({ session: vi.fn(), account: vi.fn(), transactions: vi.fn() }));
vi.mock("@/backend/auth", () => ({ getCurrentUser: mocks.session }));
vi.mock("@/backend/db", () => ({ prisma: { user: { findUnique: mocks.account }, stockTransaction: { findMany: mocks.transactions } } }));

const req = new Request("http://localhost/api/reports/stock?format=csv") as NextRequest;

describe("Owner-only stock report export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ userId: "u1", role: "OWNER" });
    mocks.account.mockResolvedValue({ role: "OWNER", isActive: true });
    mocks.transactions.mockResolvedValue([]);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(req)).status).toBe(401);
    expect(mocks.transactions).not.toHaveBeenCalled();
  });

  it("rejects Staff even via a direct API URL", async () => {
    mocks.session.mockResolvedValue({ userId: "s1", role: "STAFF" });
    expect((await GET(req)).status).toBe(403);
    expect(mocks.transactions).not.toHaveBeenCalled();
  });

  it("rejects a stale Owner session after a role change", async () => {
    mocks.account.mockResolvedValue({ role: "STAFF", isActive: true });
    expect((await GET(req)).status).toBe(403);
    expect(mocks.transactions).not.toHaveBeenCalled();
  });

  it("rejects inactive or missing Owner accounts", async () => {
    mocks.account.mockResolvedValueOnce({ role: "OWNER", isActive: false }).mockResolvedValueOnce(null);
    expect((await GET(req)).status).toBe(403);
    expect((await GET(req)).status).toBe(403);
    expect(mocks.transactions).not.toHaveBeenCalled();
  });

  it("lets an active Owner download the existing CSV", async () => {
    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain("Jumlah Input,Satuan Input,Faktor Konversi");
    expect(mocks.transactions).toHaveBeenCalledTimes(1);
  });
});
