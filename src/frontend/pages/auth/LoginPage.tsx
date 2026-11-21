"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coffee, Lock, UserRound, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || "Username atau password tidak sesuai");
      else {
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setErrorMsg("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-stone-800/80 border border-stone-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"><Coffee className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-bold tracking-tight text-white">NaysIn</h1>
          <p className="text-sm text-stone-400 mt-1">Sistem Digital Manajemen Stok & Asisten Menu Nays Kopi</p>
        </div>
        {errorMsg && <div role="alert" className="mb-6 p-3.5 bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs rounded-xl flex items-center gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-stone-300 mb-1.5">Username</label>
            <div className="relative">
              <UserRound className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
              <input id="username" autoComplete="username" type="text" required placeholder="Masukkan username" value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-stone-900/80 border border-stone-700 rounded-xl outline-none focus:border-amber-500 text-white" />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-stone-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
              <input id="password" autoComplete="current-password" type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-stone-900/80 border border-stone-700 rounded-xl outline-none focus:border-amber-500 text-white" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 text-white font-semibold rounded-xl transition shadow-lg text-sm">{loading ? "Memverifikasi..." : "Masuk ke Sistem"}</button>
        </form>
        <Link href="/" className="block text-center mt-6 text-sm text-amber-300 hover:text-amber-200">← Kembali ke katalog menu</Link>
      </div>
    </div>
  );
}
