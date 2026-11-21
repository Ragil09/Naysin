"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BotMessageSquare, Coffee, LockKeyhole, MessageCircle, Search, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import type { PublicMenuItem } from "@/shared/types/public-menu";
import { createWhatsAppOrderLink } from "@/shared/whatsapp-order";

export function PublicHome({ menus, orderNumber }: { menus: PublicMenuItem[]; orderNumber: string | null }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("Semua");
  const tags = useMemo(() => ["Semua", ...Array.from(new Set(menus.flatMap(menu => menu.tags))).sort((a,b) => a.localeCompare(b,"id"))], [menus]);
  const filtered = useMemo(() => menus.filter(menu => {
    const matchesTag = tag === "Semua" || menu.tags.some(t => t.toLowerCase() === tag.toLowerCase());
    const terms = `${menu.name} ${menu.category} ${menu.tags.join(" ")} ${menu.description}`.toLocaleLowerCase("id-ID");
    return matchesTag && terms.includes(query.trim().toLocaleLowerCase("id-ID"));
  }), [menus, query, tag]);
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center gap-3">
          <Link href="/" aria-label="Beranda Nays Kopi" className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-amber-600 text-white font-extrabold text-xl flex items-center justify-center">N</span>
            <span className="leading-tight"><span className="block font-bold tracking-tight">NaysIn</span><span className="block text-xs text-stone-500">Nays Kopi</span></span>
          </Link>
          <nav aria-label="Navigasi utama" className="flex items-center gap-2 sm:gap-4">
            <a href="#daftar-menu" className="hidden sm:inline-flex text-sm text-stone-600 hover:text-amber-700">Daftar Menu</a>
            <Link href="/assistant" className="hidden sm:inline-flex text-sm text-stone-600 hover:text-amber-700">Asisten AI</Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-100"><LockKeyhole className="w-4 h-4"/>Login Staff / Owner</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-stone-900 text-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid md:grid-cols-[1.5fr_1fr] gap-10 items-center">
            <div className="space-y-5">
              <div className="inline-flex gap-2 items-center rounded-full border border-amber-500/30 bg-amber-600/15 px-3 py-1.5 text-amber-300 text-xs font-semibold"><Coffee className="w-4 h-4"/> Selamat datang di Nays Kopi</div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">Temukan menu favoritmu di <span className="text-amber-400">Nays Kopi.</span></h1>
              <p className="max-w-xl text-stone-300 text-sm sm:text-base leading-relaxed">Jelajahi pilihan menu kami, cari minuman sesuai selera, dan pesan dengan mudah melalui WhatsApp.</p>
              <div className="flex flex-wrap gap-3">
                <a href="#daftar-menu" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold">Lihat Menu <ArrowRight className="w-4 h-4"/></a>
                <Link href="/assistant" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-stone-600 hover:bg-stone-800 text-white text-sm font-semibold"><Sparkles className="w-4 h-4"/> Tanya Asisten AI</Link>
              </div>
            </div>
            <div className="rounded-2xl border border-stone-700 bg-stone-800/70 p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center"><UtensilsCrossed className="w-6 h-6 text-white"/></div>
              <h2 className="font-bold text-xl">Menu terbaru dari kedai</h2>
              <p className="text-sm text-stone-300">Nama, harga, dan ketersediaan menu diambil langsung dari sistem NaysIn yang dikelola Owner.</p>
              <div className="grid grid-cols-2 gap-3 border-t border-stone-700 pt-4">
                <div><span className="block text-2xl font-bold text-amber-400">{menus.length}</span><span className="text-xs text-stone-400">Menu tersedia</span></div>
                <div><span className="block text-2xl font-bold text-amber-400">{Math.max(0,tags.length-1)}</span><span className="text-xs text-stone-400">Kategori / tag</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="daftar-menu" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16 scroll-mt-20 space-y-6">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div><div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-5 h-5 text-amber-700"/><h2 className="text-2xl font-bold tracking-tight">Daftar Menu</h2></div><p className="text-sm text-stone-500">Pilih menu yang kamu suka, lalu pesan melalui WhatsApp.</p></div>
            <Link href="/assistant" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-950"><BotMessageSquare className="w-4 h-4"/> Butuh rekomendasi AI?</Link>
          </div>
          <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-4 space-y-4">
            <label className="relative block"><span className="sr-only">Cari menu</span><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari nama, deskripsi, atau tag menu..." className="w-full rounded-xl border border-stone-300 py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-amber-500"/></label>
            <div className="flex gap-2 flex-wrap" aria-label="Filter kategori">
              {tags.map(t => <button key={t} onClick={()=>setTag(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${tag===t ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}>{t}</button>)}
            </div>
          </div>
          <p className="text-xs text-stone-500" aria-live="polite">Menampilkan {filtered.length} dari {menus.length} menu tersedia</p>
          {filtered.length === 0 ? <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500 text-sm">{menus.length ? "Tidak ada menu yang cocok. Coba kata kunci atau kategori lain." : "Menu belum tersedia. Silakan kembali lagi nanti."}</div> :
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(menu => {
                const orderHref = createWhatsAppOrderLink(orderNumber, menu);
                return <article key={menu.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-amber-50 text-amber-700 flex items-center justify-center">
                    {menu.imageUrl ? <img src={menu.imageUrl} alt={`Foto ${menu.name}`} loading="lazy" className="w-full h-full object-cover"/> : <Coffee className="w-10 h-10" aria-label="Gambar menu belum tersedia"/>}
                  </div>
                  <div><h3 className="text-lg font-bold text-stone-900">{menu.name}</h3><div className="flex flex-wrap gap-1.5 mt-2">{menu.tags.map(t=><span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">{t}</span>)}</div></div>
                  <p className="text-sm text-stone-600 leading-relaxed flex-1">{menu.description || "Deskripsi menu belum tersedia."}</p>
                  <div className="border-t border-stone-100 pt-3 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-lg font-bold text-stone-900">{menu.price === null ? <span className="text-sm">Konfirmasi harga</span> : `Rp${menu.price.toLocaleString("id-ID")}`}</span>
                    {orderHref ? <a href={orderHref} target="_blank" rel="noopener noreferrer" aria-label={`Pesan ${menu.name} melalui WhatsApp`} className="inline-flex items-center gap-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-3.5 py-2.5"><MessageCircle className="w-4 h-4"/> Pesan</a> : <span className="rounded-xl bg-stone-100 px-3 py-2.5 text-xs font-medium text-stone-500">WhatsApp belum diatur</span>}
                  </div>
                </article>;
              })}
            </div>}
          {!orderNumber && <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Pemesanan WhatsApp belum aktif karena nomor mitra belum dikonfigurasi. Pengunjung tetap dapat melihat daftar menu.</p>}
        </section>
      </main>
      <footer className="bg-stone-900 text-stone-300"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between gap-3 text-xs"><span>© {new Date().getFullYear()} Nays Kopi · Powered by NaysIn</span><div className="flex gap-4"><Link href="/assistant" className="hover:text-white">Asisten Menu</Link><Link href="/login" className="hover:text-white">Login Staff / Owner</Link></div></div></footer>
    </div>
  );
}
