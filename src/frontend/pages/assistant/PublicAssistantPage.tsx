"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Coffee, Send, Sparkles, User } from "lucide-react";

type Message = { sender: "user" | "bot"; text: string; provider?: "GEMINI" | "RULES" };

export default function PublicAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([{ sender: "bot", text: "Halo! Mau tanya daftar menu, harga, bahan, atau minta rekomendasi minuman?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previousMenuNames, setPreviousMenuNames] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, loading]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(old => [...old, { sender: "user", text }]);
    setLoading(true);
    try {
      const response = await fetch("/api/public/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, previousMenuNames }),
      });
      const data = await response.json() as { answer?: string; error?: string; matchedMenuItems?: string[]; provider?: "GEMINI" | "RULES" };
      setPreviousMenuNames(response.ok && Array.isArray(data.matchedMenuItems) ? data.matchedMenuItems.slice(0, 1) : []);
      setMessages(old => [...old, { sender: "bot", text: response.ok ? data.answer || "Maaf, belum ada jawaban." : data.error || "Maaf, asisten tidak tersedia.", provider: response.ok ? data.provider : undefined }]);
    } catch {
      setPreviousMenuNames([]);
      setMessages(old => [...old, { sender: "bot", text: "Koneksi ke asisten gagal. Silakan coba kembali nanti." }]);
    } finally { setLoading(false); }
  }
  return <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
    <header className="bg-white border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-800"><ArrowLeft className="w-4 h-4"/> Kembali ke Katalog</Link>
        <Link href="/" className="flex gap-2 items-center font-bold"><span className="w-8 h-8 rounded-lg bg-amber-600 text-white flex justify-center items-center">N</span> NaysIn</Link>
      </div>
    </header>
    <main className="w-full max-w-4xl mx-auto flex-1 flex flex-col gap-5 px-4 sm:px-6 py-8">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-amber-600"/> Asisten Menu Nays Kopi</h1><p className="text-sm text-stone-500 mt-1">Cari menu, bandingkan harga, atau minta rekomendasi berdasarkan informasi yang tercatat di kedai.</p></div>
      <div className="flex flex-wrap gap-2">
        {["Daftar menu apa saja?", "Ada menu matcha?", "Rekomendasi di bawah 25 ribu"].map(t => <button key={t} disabled={loading} onClick={()=>void send(t)} className="text-xs px-3 py-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-full hover:bg-amber-100 disabled:opacity-50">{t}</button>)}
        <button disabled={loading} onClick={()=>{ setPreviousMenuNames([]); setMessages([{sender:"bot",text:"Halo! Ada yang ingin ditanyakan tentang menu Nays Kopi?"}]); }} className="text-xs px-3 py-2 bg-white text-stone-600 border border-stone-200 rounded-full hover:bg-stone-100 disabled:opacity-50">Reset chat</button>
      </div>
      <section aria-label="Percakapan asisten menu" className="bg-white border border-stone-200 shadow-sm rounded-2xl overflow-hidden flex flex-col min-h-[480px] h-[min(65vh,630px)]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" aria-live="polite">
          {messages.map((m,i)=><div key={i} className={`flex items-start gap-3 ${m.sender==="user"?"justify-end":"justify-start"}`}>
            {m.sender==="bot"&&<span className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-600 text-white shrink-0"><Bot className="w-4 h-4"/></span>}
            <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] leading-relaxed ${m.sender==="user"?"bg-stone-900 text-white":"bg-stone-100 text-stone-800 border border-stone-200"}`}>
              <p className="whitespace-pre-line">{m.text}</p>
              {m.sender==="bot"&&m.provider&&<p className="border-t border-stone-200 mt-2 pt-2 text-[11px] text-stone-500">{m.provider==="GEMINI"?"Gemini + data menu PostgreSQL":"Asisten menu berbasis aturan"}</p>}
            </div>
            {m.sender==="user"&&<span className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-200 text-stone-600 shrink-0"><User className="w-4 h-4"/></span>}
          </div>)}
          {loading&&<div className="flex items-center gap-2 text-xs text-stone-500"><Coffee className="w-4 h-4 text-amber-700 animate-pulse"/> Menyiapkan jawaban...</div>}
          <div ref={endRef}/>
        </div>
        <form onSubmit={e=>{e.preventDefault(); void send(input);}} className="p-3 sm:p-4 bg-stone-50 border-t border-stone-200 flex items-center gap-2">
          <input aria-label="Pertanyaan untuk asisten" value={input} onChange={e=>setInput(e.target.value)} maxLength={500} placeholder="Tanyakan tentang menu..." className="min-w-0 flex-1 px-4 py-3 bg-white border border-stone-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"/>
          <button type="submit" disabled={!input.trim()||loading} aria-label="Kirim pertanyaan" className="rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white p-3"><Send className="w-4 h-4"/></button>
        </form>
      </section>
      <p className="text-xs text-stone-500">Informasi menu dapat berubah. Untuk alergi dan pesanan khusus, mohon konfirmasi kepada staf Nays Kopi. Asisten publik memiliki batas penggunaan harian.</p>
    </main>
  </div>;
}
