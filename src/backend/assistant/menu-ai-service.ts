import type { PrismaClient } from "@prisma/client";

export interface AssistantResponse {
  answer: string;
  isGrounded: boolean;
  status: "SUCCESS" | "FALLBACK" | "ERROR";
  matchedMenuItems: string[];
}

export const MENU_ASSISTANT_VERSION = "rules-menu-v3";
export const FALLBACK_MESSAGE =
  "Maaf, informasi mengenai menu tersebut belum tersedia secara resmi di sistem kami. Silakan langsung tanyakan atau konfirmasi kepada barista/staf Nays Kopi kami.";

type Menu = {
  name: string; category: string; description: string; price: number | null;
  isAvailable: boolean; aliases: { alias: string }[]; tags?: { name: string }[];
  ingredients: { ingredient: { name: string } }[];
};
type Match = { menu: Menu; start: number; length: number; official: boolean };
const words = (text: string) => text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const normalized = (text: string) => words(text).join(" ");
const menuName = (name: string) => name.replace(/\s*\[DEMO\]\s*$/i, "");
const has = (text: string, phrase: string) => !!phrase && (` ${normalized(text)} `).includes(` ${normalized(phrase)} `);
const money = (price: number) => `Rp${price.toLocaleString("id-ID")}`;
const priceText = (m: Menu) => m.price == null ? "harga belum tercatat" : money(m.price);
const detail = (m: Menu) => `${m.name} (${priceText(m)}): ${m.description}`;
const result = (answer: string, menus: Menu[] = []): AssistantResponse => ({ answer, status: "SUCCESS", isGrounded: true, matchedMenuItems: menus.map(m => m.name) });
const fallback = (answer = FALLBACK_MESSAGE): AssistantResponse => ({ answer, status: "FALLBACK", isGrounded: false, matchedMenuItems: [] });
const nonCoffee = (m: Menu) => [m.category, ...(m.tags ?? []).map(t => t.name)].some(s => /\b(non kopi|non coffee|tanpa kopi)\b/.test(normalized(s)));
const coffee = (m: Menu) => !nonCoffee(m) && [m.category, ...(m.tags ?? []).map(t => t.name)].some(s => /\b(kopi|coffee|espresso)\b/.test(normalized(s)));
const tagNames = (m: Menu) => [m.category, ...(m.tags ?? []).map(t => t.name)];
const ingredientNames = (m: Menu) => (m.ingredients ?? []).map(i => i.ingredient.name);
const menuFields = (m: Menu) => [menuName(m.name), ...tagNames(m), ...m.aliases.map(a => a.alias), m.description, ...ingredientNames(m)];
const STOP = new Set("apa apakah ada adakah saja aja yang yg untuk dengan dan atau di dari ke ini itu saya aku kami kak dong ya nih minuman menu makanan daftar list semua seluruh tampilkan tunjukkan kasih minta lihat boleh bisa mau pengen ingin jual tersedia ready rekomendasi rekomendasikan saran sarankan cocok enak paling lebih berapa berapaan harga harganya biaya rp rupiah kisaran budget maksimal max minimal min diatas dibawah kurang atas bawah sampai hingga antara ribu rb k aja sekitar cuma hanya tidak bukan tanpa selain jangan mengandung pakai pake bahan komposisi resep terbuat isi rasa rasanya seperti gimana bagaimana jelaskan deskripsi info informasi mana perbedaan beda bedanya bandingkan versus vs sama murah mahal termurah termahal favorit populer laku manis segar dingin hangat panas creamy pahit asam ringan hari sekarang masih habis diskon promo jadi tolong dong dongk yaa sini sana kalian punya tersedia kah dongk nih dongh jenis macam pilihan ada apa aja aja tunjukin kasihkan kasih tau tahu kasih tau nampilin sebutkan sebutin tampilkan lihatkan berikan kasihkan kasi berapakah jumlah total banyak terima kasih makasih naysin nays kopinya".split(" "));
// Taste/temperature are useful preferences only when explicitly documented.
const PREFERENCES = ["manis", "segar", "dingin", "hangat", "panas", "creamy", "pahit", "asam", "ringan", "cokelat", "stroberi", "strawberry"];

function explicitMatches(query: string, menus: Menu[]): Menu[] {
  const q = words(query);
  const candidates: Match[] = [];
  for (const menu of menus) {
    for (const item of [{ text: menuName(menu.name), official: true }, ...menu.aliases.map(a => ({ text: a.alias, official: false }))]) {
      const w = words(item.text);
      if (!w.length) continue;
      for (let start = 0; start <= q.length - w.length; start++) {
        if (w.every((token, i) => q[start + i] === token)) candidates.push({ menu, start, length: w.length, official: item.official });
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length || Number(b.official) - Number(a.official) || a.start - b.start || a.menu.name.localeCompare(b.menu.name, "id"));
  const chosen: Match[] = [];
  for (const c of candidates) {
    if (chosen.some(x => c.start < x.start+x.length && x.start < c.start+c.length)) continue;
    chosen.push(c);
  }
  return [...new Set(chosen.sort((a,b) => a.start-b.start).map(x => x.menu))];
}

type Budget = { min?: number; max?: number; strictMin?: boolean; strictMax?: boolean };
function parseBudget(q: string): Budget | undefined {
  const amount = String.raw`(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(ribu|rb|k))?`;
  const read = (n: string, u?: string) => u ? Number(n.replace(",", ".")) * 1000 : Number(n.replace(/[.,]/g, ""));
  const range = new RegExp(String.raw`(?:antara\s+)?${amount}\s*(?:-|–|sampai|hingga|s\/d)\s*${amount}`, "i").exec(q);
  if (range) return { min: read(range[1], range[2] || range[4]), max: read(range[3], range[4] || range[2]) };
  const above = /\btidak\s+lebih\s+dari\b/i.test(q) ? null : new RegExp(String.raw`(?:di\s*atas|lebih\s+dari|minimal|min\b|setidaknya)\s*${amount}`, "i").exec(q);
  const below = new RegExp(String.raw`(di\s*bawah|kurang\s+dari|maksimal|max\b|budget|anggaran|modal|bujet|di\s+kisaran|tidak\s+lebih\s+dari|sampai|hingga)\s*[:=]?\s*${amount}`, "i").exec(q);
  if (above || below) return { ...(above ? { min: read(above[1],above[2]), strictMin: /^(di\s*atas|lebih)/i.test(above[0]) } : {}), ...(below ? { max: read(below[2],below[3]), strictMax: /^(di\s*bawah|kurang)/i.test(below[1]) } : {}) };
  const exact = new RegExp(String.raw`(?:harga|harganya)\s*[:=]?\s*${amount}`, "i").exec(q);
  if (exact && (exact[2] || Number(exact[1].replace(/[.,]/g,""))>=1000)) { const p=read(exact[1],exact[2]); return {min:p,max:p}; }
  const standalone = new RegExp(String.raw`(?:menu|minuman)\s+${amount}`, "i").exec(q);
  if (standalone && (standalone[2] || Number(standalone[1].replace(/[.,]/g,""))>=1000)) { const p=read(standalone[1],standalone[2]); return {min:p,max:p}; }
  const only = new RegExp(String.raw`(?:punya|uang)\s*${amount}`, "i").exec(q);
  if (only) return {max: read(only[1],only[2])};
  return undefined;
}
function listResponse(menus: Menu[], header: string, maxItems = 20): AssistantResponse {
  const shown = menus.slice(0, maxItems);
  const lines = shown.map((m,i) => `${i+1}. ${m.name} — ${priceText(m)}`);
  if (menus.length > shown.length) lines.push(`... dan ${menus.length-shown.length} menu lainnya. Silakan sebutkan kategori atau batas harga untuk mempersempit daftar.`);
  return result(`${header} (${menus.length} menu):\n${lines.join("\n")}`, shown);
}

/** Deterministic intent detection and retrieval; no external model or private data exposure. */
export async function answerMenuQuery(
  prisma: PrismaClient, query: string, _channel: "WEB" | "WHATSAPP" = "WEB",
  previousMenuNames: string[] = []
): Promise<AssistantResponse> {
  const q = query.trim();
  const n = normalized(q).replace(/\b(?:di |dari )?nays kopi\b/g, " ").trim().replace(/\s+/g," ");
  if (!n || /^(halo|hai|hi|hello|hey|selamat pagi|selamat siang|selamat sore|selamat malam|assalamualaikum)( kak)?$/.test(n)) return result("Halo! Saya asisten menu Nays Kopi. Mau lihat daftar menu, harga, komposisi, atau rekomendasi sesuai anggaran?");
  if (/^(terima kasih|makasih|thanks|thank you|oke makasih)( banyak| ya| kak)?$/.test(n)) return result("Sama-sama! Silakan tanya lagi jika ingin mengetahui menu lainnya.");
  if (/\b(api key|password|kata sandi|token rahasia|system prompt|instruksi sebelumnya|database password|stok bahan baku internal)\b/.test(n)) return fallback();
  // Ambil menu aktif dan nonaktif secara terpisah. Menu nonaktif hanya boleh
  // disebut saat pelanggan secara spesifik menanyakannya, bukan direkomendasikan.
  const include = {
    aliases: true,
    tags: true,
    ingredients: { include: { ingredient: { select: { name: true } } } },
  } as const;
  const [available, unavailable] = await Promise.all([
    prisma.menu.findMany({ where: { isAvailable: true }, include }),
    prisma.menu.findMany({ where: { isAvailable: false }, include }),
  ]);
  // Filter ulang untuk mengakomodasi mock dan memastikan menu tidak aktif
  // tidak pernah muncul di rekomendasi/daftar menu.
  const menus: Menu[] = [
    ...available.filter(m => m.isAvailable),
    ...unavailable.filter(m => !m.isAvailable),
  ];
  const active = menus.filter(m => m.isAvailable).sort((a,b) => a.name.localeCompare(b.name,"id"));
  const named = explicitMatches(q, menus);
  const budget = parseBudget(q);
  const asksPrice = /\b(harga\w*|berapaan|biaya|tarif|cost|price|rp|diskon|promo)\b/.test(n) || /\bberapa\b/.test(n) && !/\b(kalori|kafein|gula|protein|jumlah|banyak|menu apa|isi|bahan|takaran|ukuran|volume)\b/.test(n);
  const asksIngredients = /\b(komposisi\w*|bahan\w*|resep|terbuat|mengandung|kandungan|pakai|pake|isi)\b/.test(n);
  const health = /\b(alergi|alergen|laktosa|diabetes|hamil|halal|vegan|bebas gluten|gluten free|aman untuk|kalori|kafein|nutrisi|protein|kadar gula)\b/.test(n);
  const compare = /\b(beda\w*|perbedaan|bandingkan|versus|vs|mending|lebih enak)\b/.test(n) || named.length > 1 && /\b(lebih murah|lebih mahal)\b/.test(n);
  const count = /\b(berapa (jumlah |banyak )?menu|jumlah menu|total menu)\b/.test(n);
  const list = count || /\b(list|daftar|katalog|semua|seluruh|apa saja|apa aja|pilihan|tampilkan|lihat menu|menu apa|menu yang ada|menu tersedia|menu dong|menu lengkap|ada apa|menu kalian|menu nya|menunya)\b/.test(n) || /^(menu|minuman|makanan)( nays kopi| kak)?$/.test(n) || /\b(ada|punya) menu( di sini| di sana| minuman)?$/.test(n);
  const recommend = /\b(rekomendasi\w*|saran\w*|suggest|cocok|pilih\w*|paling enak|favorit|best seller|bestseller|paling laku|populer)\b/.test(n);
  const cheap = /\b(termurah|paling murah|harga terendah|murah|hemat)\b/.test(n);
  const pricey = /\b(termahal|paling mahal|harga tertinggi)\b/.test(n);
  const bothCoffeeGroups = /\b(kopi (dan|atau) non kopi|non kopi (dan|atau) kopi)\b/.test(n);
  const noCoffee = !bothCoffeeGroups && /\b(non kopi|non coffee|tanpa kopi|bukan kopi|selain kopi|tidak (mengandung |pakai |ada |mau |suka )?kopi|ga (mau |suka |pakai )?kopi|gak (mau |suka |pakai )?kopi|nggak (mau |suka |pakai )?kopi|jangan kopi)\b/.test(n);
  const negative = /\b(tanpa|bebas|tidak mengandung|tidak pakai|ga pakai|gak pakai|nggak pakai|jangan pakai|bukan|selain)\s+(susu|milk|gula|kafein|gluten|kacang|cokelat)\b/.exec(n);
  const preferences = PREFERENCES.filter(t => has(n,t));
  const knownTags = [...new Set(active.flatMap(tagNames).map(normalized))].filter(Boolean).sort((a,b) => b.length-a.length);
  const requestedTags = knownTags.filter(t => has(n,t) && !(noCoffee && /^(kopi|coffee|espresso)$/.test(t)) && !knownTags.some(other => other!==t && other.length>t.length && has(n,other) && has(other,t)));
  const coffeeRequest = !noCoffee && !bothCoffeeGroups && /\b(kopi|coffee)\b/.test(n);
  const broadTagQuery = requestedTags.length > 0 && !named.some(m => has(n,menuName(m.name)) || m.aliases.some(a=>words(a.alias).length>1 && has(n,a.alias))) && active.some(m => requestedTags.some(t=>tagNames(m).some(tag=>normalized(tag)===t)));
  const group = list || /^menu\s+/.test(n) || recommend || !!budget || cheap || pricey || noCoffee || broadTagQuery && (asksPrice || /\b(ada|punya|tersedia|ready)\b/.test(n));
  // Explicit name/alias must dominate generic overlapping tags; for lists, a single-word alias such as "matcha" is a category hint.
  const specific = named.filter(m => has(n,menuName(m.name)) && words(menuName(m.name)).length>1 || m.aliases.some(a => words(a.alias).length>1 && has(n,a.alias)));
  let targets = compare ? named : group ? specific : named;
  // A generic one-word alias must not silently turn an unknown variant into another menu.
  if (!group && targets.length===1 && !has(n,menuName(targets[0].name))) {
    const m=targets[0];
    const matchedAliases=m.aliases.filter(a=>has(n,a.alias));
    if (matchedAliases.length && matchedAliases.every(a=>words(a.alias).length===1)) {
      const rest=words(n).filter(t=>t.length>1 && !STOP.has(t) && !/^\d+$/.test(t) && !PREFERENCES.includes(t));
      if (rest.some(t=>!menuFields(m).some(field=>has(field,t)))) targets=[];
    }
  }
  // A follow-up only uses the previous single menu, never trusts prior answer text, and always re-reads PostgreSQL.
  const follow = /^(?:(?:kalau|terus|lalu|dan) )?(?:harganya|harga( nya)?|berapa( harganya)?|berapaan|bahannya|bahan( nya)?|apa bahannya|apa komposisinya|komposisinya|rasanya|deskripsinya|masih ada|masih tersedia|tersedia|ada susu|pakai susu|mengandung susu|itu berapa|yang tadi)(?: (berapa|apa|apa saja|apa aja|gimana|bagaimana|kak|ya|dong))*$/.test(n);
  if (!targets.length && !group && follow && previousMenuNames.length===1) targets = menus.filter(m=>m.name===previousMenuNames[0]);
  if (!targets.length && !group && follow) return fallback("Menu mana yang Anda maksud? Sebutkan namanya terlebih dahulu, ya.");

  if (health || negative) {
    const relevant = targets.filter(m=>m.isAvailable);
    const facts = relevant.map(m => `${m.name}: ${ingredientNames(m).length ? ingredientNames(m).join(", ") : m.description}`);
    return result(`${facts.length ? `Informasi yang tercatat:\n${facts.join("\n")}\n\n` : ""}Kami belum memiliki data terverifikasi yang cukup untuk memastikan kandungan gizi, pantangan, atau bebas alergen. Silakan konfirmasi langsung kepada barista, terutama jika memiliki alergi atau kebutuhan diet.`, relevant);
  }
  if (compare) {
    if (targets.length < 2) return fallback("Sebutkan dua nama menu yang ingin dibandingkan, misalnya Kopi Nays dan Matcha Latte.");
    const priced = targets.filter(m=>m.isAvailable && m.price!=null);
    let comparison = "";
    if (/\b(lebih murah|lebih mahal)\b/.test(n) && priced.length===targets.length) {
      const lower = has(n,"lebih murah");
      const extreme = (lower ? Math.min : Math.max)(...priced.map(m=>m.price!));
      comparison = priced.every(m=>m.price===extreme) ? "\n\nHarga menu tersebut sama." : `\n\n${priced.filter(m=>m.price===extreme).map(m=>m.name).join(", ")} ${lower?"lebih murah":"lebih mahal"} berdasarkan harga tercatat.`;
    }
    return result(`Berikut perbandingan berdasarkan data menu:\n${targets.map(m=>`${m.name} — ${priceText(m)}; ${m.isAvailable?"tersedia":"tidak tersedia"}. ${m.description}`).join("\n\n")}${comparison}`,targets);
  }
  if (!group && !targets.length) {
    // Token retrieval for genuine partial names/descriptions. Ignore generic phrasing and common filler.
    const tokens = [...new Set(words(n).filter(t=>t.length>1 && !STOP.has(t) && !/^\d+$/.test(t)))];
    const ranked = active.map(m => ({ m, hits: tokens.filter(t=>menuFields(m).some(field=>has(field,t))), primary: tokens.filter(t=>[menuName(m.name),...m.aliases.map(a=>a.alias)].some(f=>has(f,t))).length })).filter(x=>x.hits.length && (tokens.length===1 || x.hits.length>=2 || x.primary>0 && x.hits.length===tokens.length)).sort((a,b)=>b.hits.length-a.hits.length || b.primary-a.primary);
    if (ranked.length && (ranked.length===1 || ranked[0].hits.length>ranked[1].hits.length || ranked[0].primary>ranked[1].primary)) targets=[ranked[0].m];
    else if (ranked.length) return listResponse(ranked.map(x=>x.m),"Ada beberapa menu yang mungkin Anda maksud");
  }
  if (group && targets.length===0) {
    let candidates = active;
    if (bothCoffeeGroups) candidates = candidates.filter(m=>coffee(m)||nonCoffee(m));
    else if (noCoffee) candidates = candidates.filter(nonCoffee);
    else if (coffeeRequest) candidates = candidates.filter(coffee);
    // Specific tags may also be discoverable from name/alias (e.g. old demo Matcha lacks a Matcha tag).
    const tags = requestedTags.filter(t=>!['kopi','coffee','non kopi','non coffee'].includes(t));
    if (tags.length) candidates=candidates.filter(m=>tags.some(t=>(tagNames(m).some(tag=>normalized(tag)===t) || !/^(non kopi|non coffee)$/.test(t) && [menuName(m.name), ...m.aliases.map(a=>a.alias)].some(field=>has(field,t)))));
    const ignored = new Set([...STOP,...requestedTags.flatMap(words),...preferences,...["kopi","coffee","non","gak","ga","nggak","mau","suka","mengandung","punya","uang","anggaran","bujet","modal","setidaknya","lebih","dikit","an","dan","saja","dong","kak"]]);
    const residual = [...new Set(words(n).filter(t=>t.length>1 && !ignored.has(t) && !/^(?:rp)?\d+(?:k|rb|ribu)?$/.test(t)))];
    if (residual.length) {
      const matched = candidates.filter(m => residual.every(t=>menuFields(m).some(field=>has(field,t))));
      if (!matched.length) return fallback();
      candidates=matched;
    }
    if (budget) candidates=candidates.filter(m=>m.price!=null && (budget.min===undefined || (budget.strictMin ? m.price>budget.min : m.price>=budget.min)) && (budget.max===undefined || (budget.strictMax ? m.price<budget.max : m.price<=budget.max)));
    let preferenceMissing = false;
    if (preferences.length) {
      const preferred=candidates.filter(m=>preferences.every(t=>[m.description, ...tagNames(m)].some(field=>has(field,t))));
      if (preferred.length) candidates=preferred;
      else preferenceMissing=true;
    }
    if (cheap || pricey) {
      candidates=candidates.filter(m=>m.price!=null).sort((a,b)=>pricey? b.price!-a.price!:a.price!-b.price!);
      if (candidates.length) candidates=candidates.filter(m=>m.price===candidates[0].price);
    } else if (budget) candidates.sort((a,b)=>a.price!-b.price!);
    if (!candidates.length) return result("Belum ada menu tersedia yang cocok dengan kriteria tersebut. Coba kategori atau anggaran lain, ya.");
    if (count) return result(`Terdapat ${candidates.length} menu tersedia yang sesuai dengan kriteria tersebut.`);
    const popular = /\b(favorit|best seller|bestseller|paling laku|populer)\b/.test(n);
    const header = popular ? "Data penjualan atau popularitas belum tersedia. Berikut pilihan menu" : cheap ? "Menu dengan harga terendah yang tercatat" : pricey ? "Menu dengan harga tertinggi yang tercatat" : budget ? "Menu sesuai batas harga Anda" : recommend ? "Pilihan menu berdasarkan informasi yang tercatat" : "Daftar menu yang tersedia";
    return listResponse(candidates, preferenceMissing ? `Belum ada keterangan yang memastikan preferensi rasa/suhu tersebut. ${header}` : header, _channel === "WHATSAPP" ? 15 : 100);
  }
  if (!targets.length) return fallback();
  const answers = targets.map(m => {
    if (!m.isAvailable) return `${m.name} saat ini tercatat tidak tersedia. Silakan pilih menu lain atau konfirmasi kepada barista.`;
    if (noCoffee && !nonCoffee(m)) return `${m.name} belum tercatat dalam kategori non-kopi. Silakan pilih menu lain atau konfirmasi kepada barista.`;
    if (budget && (m.price==null || budget.min!==undefined && (budget.strictMin ? m.price<=budget.min : m.price<budget.min) || budget.max!==undefined && (budget.strictMax ? m.price>=budget.max : m.price>budget.max))) return `${m.name}: ${priceText(m)}. ${m.price==null?"Belum bisa dipastikan sesuai anggaran":"Di luar batas harga yang Anda berikan"}.`;
    if (asksIngredients) {
      const ingredients = ingredientNames(m);
      return `${m.name}${asksPrice ? ` (${priceText(m)})` : ""}${ingredients.length?` dibuat menggunakan bahan yang tercatat: ${ingredients.join(", ")}.`:`: rincian bahan belum tercatat.`} ${m.description}${ingredients.length?"":" Silakan konfirmasi komposisi kepada barista."}`;
    }
    if (asksPrice) return m.price==null ? `Untuk ${m.name}, harga resmi saat ini belum tercatat di sistem kami. Silakan langsung konfirmasi ke barista/staf Nays Kopi.` : `Harga resmi untuk ${m.name} (${m.category}) adalah ${money(m.price)}. ${m.description}${/\b(diskon|promo)\b/.test(n)?" Informasi promo belum tercatat; harga tersebut adalah harga resmi, bukan harga diskon.":""}`;
    return `${detail(m)}${/\b(ada|tersedia|ready|habis)\b/.test(n)?" Status: tersedia menurut data menu.":""}`;
  });
  return result(answers.join("\n\n"), targets);
}
