"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";

export default function AssistantTestPage() {
  const [messages, setMessages] = useState<
    Array<{ sender: "user" | "bot"; text: string; isGrounded?: boolean; provider?: "GEMINI" | "RULES" }>
  >([
    {
      sender: "bot",
      text: "Halo! Saya asisten menu Nays Kopi. Tanyakan daftar menu, harga, bahan, ketersediaan, perbandingan, atau rekomendasi sesuai anggaran.",
      isGrounded: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [previousMenuNames, setPreviousMenuNames] = useState<string[]>([]);
  const scrollEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendQuestion(input);
  }

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;
    const userText = question.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userText, channel: "WEB", previousMenuNames }),
      });

      const data = await res.json();
      setPreviousMenuNames(res.ok && Array.isArray(data.matchedMenuItems) ? data.matchedMenuItems : []);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.answer || data.error || "Maaf, asisten tidak dapat memproses pertanyaan.",
          isGrounded: data.isGrounded,
          provider: data.provider === "GEMINI" ? "GEMINI" : "RULES",
        },
      ]);
    } catch {
      setPreviousMenuNames([]);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Maaf, terjadi kesalahan koneksi saat memproses respon.",
          isGrounded: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">
            Simulasi & Uji Asisten Menu AI
          </h2>
        </div>
        <p className="text-sm text-stone-500">
          Uji asisten Gemini API dengan data menu dari PostgreSQL. Jika Gemini belum dikonfigurasi atau gagal, sistem otomatis memakai aturan lama.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["Daftar menu", "Menu non-kopi apa saja?", "Menu di bawah Rp25.000", "Menu termurah"].map(question => (
          <button key={question} type="button" disabled={loading} onClick={() => void sendQuestion(question)} className="text-xs px-3 py-1.5 border border-amber-200 bg-amber-50 text-amber-900 rounded-full hover:bg-amber-100 disabled:opacity-50">{question}</button>
        ))}
        <button type="button" disabled={loading} onClick={() => { setPreviousMenuNames([]); setInput(""); setMessages([{ sender: "bot", text: "Halo! Silakan tanya tentang menu Nays Kopi.", isGrounded: true }]); }} className="text-xs px-3 py-1.5 border border-stone-200 rounded-full hover:bg-stone-100 disabled:opacity-50">Reset chat</button>
      </div>
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                m.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.sender === "bot" && (
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 text-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.sender === "user"
                    ? "bg-stone-900 text-white rounded-br-xs"
                    : "bg-stone-100 text-stone-800 rounded-bl-xs border border-stone-200/60"
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {m.sender === "bot" && m.isGrounded !== undefined && (
                  <div className="mt-2 pt-1 border-t border-stone-200/50 flex items-center gap-1 text-[10px] text-stone-500 font-mono">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        m.isGrounded ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span>{m.provider === "GEMINI" ? "Gemini API + data menu PostgreSQL" : m.provider === "RULES" ? "Mode cadangan: rule-based" : "Database Nays Kopi"}{!m.isGrounded ? " · informasi belum terverifikasi" : ""}</span>
                  </div>
                )}
              </div>
              {m.sender === "user" && (
                <div className="w-8 h-8 rounded-full bg-stone-300 text-stone-700 flex items-center justify-center shrink-0 text-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-center text-xs text-stone-400">
              <Bot className="w-4 h-4 animate-bounce text-amber-600" />
              <span>Menyiapkan jawaban berdasarkan menu resmi...</span>
            </div>
          )}
          <div ref={scrollEnd} />
        </div>

        {/* Input box */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2"
        >
          <input
            type="text"
            maxLength={500}
            placeholder="Tanyakan tentang menu (misal: 'Rekomendasi non kopi yang manis')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-2.5 text-sm bg-white border border-stone-300 rounded-xl outline-none focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

