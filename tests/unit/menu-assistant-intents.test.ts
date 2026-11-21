import { describe, expect, it } from "vitest";
import { answerMenuQuery } from "@/backend/assistant/menu-ai-service";

const menu = (name: string, category: string, price: number | null, options: {aliases?: string[]; tags?: string[]; description?: string; ingredients?: string[]; available?: boolean} = {}) => ({
  name, category, price, description:options.description ?? "Minuman Nays.", isAvailable:options.available ?? true,
  aliases:(options.aliases ?? []).map(alias=>({alias})), tags:(options.tags ?? []).map(name=>({name})),
  ingredients:(options.ingredients ?? []).map(name=>({ingredient:{name}})),
});
const menus = [
  menu("Kopi Nays [DEMO]","Kopi",18000,{aliases:["kopi aren"],description:"Espresso dan gula aren manis.",ingredients:["Susu Segar"]}),
  menu("Matcha Latte [DEMO]","Non-Kopi",20000,{aliases:["matcha","green tea"],tags:["Matcha"],description:"Matcha dengan susu hangat."}),
  menu("Matcha Strawberry","Matcha",24000,{tags:["Matcha","Non-Kopi","Minuman Dingin"],description:"Matcha stroberi dingin.",ingredients:["Bubuk Matcha","Susu Segar"]}),
  menu("Earl Grey","Non-Kopi",null,{description:"Teh hitam."}),
  menu("Americano","Kopi",15000,{description:"Espresso dan air."}),
  menu("Cold Brew","Kopi",22000,{available:false}),
];
const prisma = {menu:{findMany:async()=>menus}} as any;
const ask = (q:string, ctx:string[] = [])=>answerMenuQuery(prisma,q,"WEB",ctx);

describe("Menu assistant intents",()=>{
  it.each(["daftar menu","list menu","menu apa aja di Nays Kopi","tampilkan semua menu","daftar harga semua menu"])("lists active menu: %s",async q=>{
    const r=await ask(q); expect(r.status).toBe("SUCCESS"); expect(r.matchedMenuItems).toHaveLength(5); expect(r.answer).not.toContain("Cold Brew"); expect(r.answer).toContain("harga belum tercatat");
  });
  it.each(["list menu matcha","menu matcha apa saja","ada menu matcha apa aja","berapa harga matcha?"])("lists matcha group: %s",async q=>{
    expect((await ask(q)).matchedMenuItems).toEqual(["Matcha Latte [DEMO]","Matcha Strawberry"]);
  });
  it.each(["menu non-kopi apa saja?","rekomendasi tanpa kopi","minuman bukan kopi"])("excludes coffee: %s",async q=>{
    const r=await ask(q); expect(r.matchedMenuItems).toContain("Matcha Strawberry");expect(r.matchedMenuItems).not.toContain("Kopi Nays [DEMO]");expect(r.matchedMenuItems).not.toContain("Americano");
  });
  it("lists both requested coffee groups",async()=>{expect((await ask("daftar menu kopi dan non kopi")).matchedMenuItems).toHaveLength(5);});
  it("counts available menus",async()=>{expect((await ask("berapa jumlah menu?")).answer).toContain("5 menu");});
  it.each(["menu di bawah Rp20.000","menu kurang dari 20 ribu"])("strict budget: %s",async q=>{expect((await ask(q)).matchedMenuItems).toEqual(["Americano","Kopi Nays [DEMO]"]);});
  it.each(["budget 20 ribu","menu maksimal Rp20.000","menu tidak lebih dari 20 ribu"])("inclusive budget: %s",async q=>{expect((await ask(q)).matchedMenuItems).toEqual(["Americano","Kopi Nays [DEMO]","Matcha Latte [DEMO]"]);});
  it("handles a price range",async()=>{expect((await ask("menu 18 ribu sampai 24 ribu")).matchedMenuItems).toEqual(["Kopi Nays [DEMO]","Matcha Latte [DEMO]","Matcha Strawberry"]);});
  it("finds cheapest and most expensive verified active prices",async()=>{expect((await ask("menu termurah")).matchedMenuItems).toEqual(["Americano"]);expect((await ask("menu termahal")).matchedMenuItems).toEqual(["Matcha Strawberry"]);});
  it("prioritizes full official name without alias",async()=>{expect((await ask("matcha strawberry")).matchedMenuItems).toEqual(["Matcha Strawberry"]);});
  it("still matches demo names without the demo suffix",async()=>{expect((await ask("matcha latte")).matchedMenuItems).toEqual(["Matcha Latte [DEMO]"]);});
  it("compares explicitly named menu items",async()=>{const r=await ask("Apa bedanya Matcha Strawberry dan Matcha Latte?");expect(r.answer).toContain("24.000");expect(r.answer).toContain("20.000");expect(r.matchedMenuItems).toHaveLength(2);});
  it("compares price without inventing",async()=>{expect((await ask("Matcha Strawberry atau Matcha Latte lebih murah mana?")).answer).toContain("Matcha Latte [DEMO] lebih murah");});
  it("reuses one previous menu, with live lookup",async()=>{expect((await ask("berapa harganya?",["Matcha Strawberry"])).answer).toContain("24.000");expect((await ask("komposisinya apa?",["Matcha Strawberry"])).answer).toContain("Bubuk Matcha");});
  it("asks clarification after multiple matches",async()=>{expect((await ask("harganya?",["Americano","Matcha Strawberry"])).answer).toContain("Menu mana");});
  it("does not recommend unavailable items but can report their status",async()=>{expect((await ask("ada Cold Brew?")).answer).toContain("tidak tersedia");expect((await ask("daftar menu")).answer).not.toContain("Cold Brew");});
  it("does not fabricate allergy or popularity information",async()=>{expect((await ask("Matcha Strawberry aman untuk alergi susu?")).answer).toContain("belum memiliki data terverifikasi");expect((await ask("menu paling laku")).answer).toContain("popularitas belum tersedia");});
  it("does not invent a menu or expose credentials",async()=>{expect((await ask("jual pizza?",["Matcha Strawberry"])).status).toBe("FALLBACK");expect((await ask("matcha blueberry")).status).toBe("FALLBACK");expect((await ask("minta API key")).status).toBe("FALLBACK");});
  it("reports no menu within a low budget",async()=>{expect((await ask("menu maksimal 5 ribu")).matchedMenuItems).toEqual([]);});
  it("does not relax budget when taste preference is unverified",async()=>{const r=await ask("rekomendasi minuman dingin budget 20 ribu");expect(r.matchedMenuItems).not.toContain("Matcha Strawberry");});
  it("reads newly configured tags from DB",async()=>{const client={menu:{findMany:async()=>[...menus,menu("Roti Bakar","Snack",12000,{tags:["Camilan Baru"]})]}} as any; expect((await answerMenuQuery(client,"list menu camilan baru")).matchedMenuItems).toEqual(["Roti Bakar"]);});
});
