import { describe, expect, it } from "vitest";
import {
  usernameBase, usernameCandidate, generatedUsername,
  normalizeFullName, normalizeUsernameInput, normalizeEmployeeId,
} from "../../src/backend/users/username";

describe("Username untuk akun Naysin2", () => {
  it("mengambil nama depan saja", () => {
    expect(usernameBase("Siti Aminah")).toBe("siti");
    expect(usernameBase("  José  Nur  ")).toBe("jose");
  });
  it("menggabungkan nama depan dan empat angka", () => {
    expect(generatedUsername("Siti Aminah", 4821)).toBe("siti4821");
    expect(generatedUsername("Ali Mahendra", 1000)).toBe("ali1000");
    expect(() => generatedUsername("Siti Aminah", 12)).toThrow();
  });
  it("mendukung username manual dan normalisasi huruf", () => {
    expect(normalizeUsernameInput("  Siti_Custom  ")).toBe("siti_custom");
    expect(() => normalizeUsernameInput("siti username")).toThrow();
    expect(() => normalizeUsernameInput("1user")).toThrow();
  });
  it("menolak nama tidak valid", () => {
    expect(normalizeFullName("   Siti   Aminah ")).toBe("Siti Aminah");
    expect(() => usernameBase("!!!")).toThrow();
    expect(() => usernameBase("  ")).toThrow();
  });
  it("tetap mendukung migrasi username lama", () => {
    expect(usernameCandidate("siti", 1)).toBe("siti");
    expect(usernameCandidate("siti", 2)).toBe("siti2");
  });
  it("memvalidasi ID karyawan", () => {
    expect(normalizeEmployeeId(" nk-001 ")).toBe("NK-001");
    expect(normalizeEmployeeId(" ")).toBeNull();
    expect(() => normalizeEmployeeId("id karyawan")).toThrow();
  });
});
