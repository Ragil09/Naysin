import { describe, expect, it, vi } from "vitest";
import { answerMenuQuery } from "@/backend/assistant/menu-ai-service";

const menus = [
  { name: "Matcha Latte", category: "Matcha", description: "Matcha murni dengan susu.", price: 20000, isAvailable: true, aliases: [{ alias: "matcha" }, { alias: "green tea" }], tags: [], ingredients: [] },
  { name: "Matcha Strawberry", category: "Matcha", description: "Matcha dengan stroberi.", price: 24000, isAvailable: true, aliases: [], tags: [{name: "Minuman Dingin"}], ingredients: [{ingredient:{name:"Susu Segar",unit:"kotak"}}] },
  { name: "Matcha", category: "Matcha", description: "Matcha klasik.", price: 16000, isAvailable: true, aliases: [], tags: [], ingredients: [] },
  { name: "Strawberry Special", category: "Non-Kopi", description: "Stroberi.", price: 22000, isAvailable: true, aliases: [{alias:"matcha strawberry"}], tags: [], ingredients: [] },
];
const prisma = { menu: { findMany: vi.fn(async () => menus) } } as any;

describe("Menu name priority", () => {
  it.each(["matcha strawberry", "MaTchA   STRAWBERRY!", "matcha-strawberry", "jelaskan matcha strawberry dong"])("matches official name without alias: %s", async question => {
    const result = await answerMenuQuery(prisma, question);
    expect(result.matchedMenuItems).toEqual(["Matcha Strawberry"]);
    expect(result.answer).not.toContain("Matcha Latte");
  });
  it("returns the correct price", async () => {
    const result = await answerMenuQuery(prisma, "berapa harga matcha strawberry?");
    expect(result.matchedMenuItems).toEqual(["Matcha Strawberry"]);
    expect(result.answer).toContain("24.000");
  });
  it("returns the correct ingredients", async () => {
    const result = await answerMenuQuery(prisma, "apa bahan matcha strawberry?");
    expect(result.matchedMenuItems).toEqual(["Matcha Strawberry"]);
    expect(result.answer).toContain("Susu Segar");
  });
  it("keeps existing aliases functional", async () => {
    expect((await answerMenuQuery(prisma, "green tea")).matchedMenuItems).toEqual(["Matcha Latte"]);
  });
  it("prioritizes a longer official name over a shorter one", async () => {
    expect((await answerMenuQuery(prisma, "matcha latte")).matchedMenuItems).toEqual(["Matcha Latte"]);
  });
  it("does not match aliases inside unrelated words", async () => {
    expect((await answerMenuQuery(prisma, "rematchaing")).status).toBe("FALLBACK");
  });
});
