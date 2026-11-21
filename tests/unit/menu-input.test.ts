import { describe, expect, it } from "vitest";
import { readMenuInput, readTag } from "@/backend/menus/menu-input";

const basic = { name: " Matcha Latte ", category: "Matcha", description: "Matcha dengan susu", price: 22000 };
describe("Master Menu input", () => {
  it("normalizes and deduplicates tags, aliases and composition", () => {
    const data = readMenuInput({ ...basic, tags: [" MATCHA ", " Minuman  Dingin "], aliases: [" Green   Tea ", "green tea"], ingredientIds: ["a", "a", "b"] });
    expect(data.name).toBe("Matcha Latte");
    expect(data.tags).toEqual([{ name: "Matcha", key: "matcha" }, { name: "Minuman Dingin", key: "minuman dingin" }]);
    expect(data.aliases).toEqual(["green tea"]);
    expect(data.ingredientIds).toEqual(["a", "b"]);
    expect(data.price).toBe(22000);
  });
  it("preserves zero, unknown prices and inactive status", () => {
    expect(readMenuInput({ ...basic, price: 0, isAvailable: false }).price).toBe(0);
    expect(readMenuInput({ ...basic, price: "" }).price).toBeNull();
    expect(readMenuInput({ ...basic, isAvailable: false }).isAvailable).toBe(false);
    expect(readMenuInput(basic).ingredientIds).toBeUndefined();
  });
  it("rejects invalid form input", () => {
    for (const price of [-1, 1.5, "abc", true, 2147483648]) expect(() => readMenuInput({ ...basic, price })).toThrow();
    expect(() => readMenuInput({ ...basic, description: " " })).toThrow();
    expect(() => readMenuInput({ ...basic, aliases: [3] })).toThrow();
    expect(() => readMenuInput({ ...basic, isAvailable: "false" })).toThrow();
    expect(() => readTag("   ")).toThrow();
  });
});
