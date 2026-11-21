"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, RefreshCw, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";

type Account = {
  id: string;
  name: string;
  username: string | null;
  employeeId: string | null;
  role: "OWNER" | "STAFF";
  isActive: boolean;
  createdAt: string;
};

const field = "w-full rounded-xl border border-stone-300 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400";

export default function UsersPage() {
  const [users, setUsers] = useState<Account[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Tidak dapat memuat daftar pengguna");
    setUsers(data.users ?? []);
    setCurrentUserId(data.currentUserId ?? "");
  }, []);

  useEffect(() => { loadUsers().catch(e => setError(e instanceof Error ? e.message : "Gagal memuat akun")); }, [loadUsers]);

  function resetForm() {
    setEditingId(null);
    setName(""); setUsername(""); setEmployeeId(""); setRole("STAFF"); setIsActive(true);
    setPassword(""); setConfirm("");
  }

  function startEdit(user: Account) {
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username ?? "");
    setEmployeeId(user.employeeId ?? "");
    setRole(user.role);
    setIsActive(user.isActive);
    setPassword(""); setConfirm("");
    setError(""); setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function suggest() {
    if (!name.trim()) { setError("Isi nama lengkap terlebih dahulu"); return; }
    setSuggestLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/users/username-suggestion?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat username");
      setUsername(data.username);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat username"); }
    finally { setSuggestLoading(false); }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setSuccess("");
    if (password !== confirm) { setError("Konfirmasi password tidak cocok"); return; }
    if (!editingId && password.length < 10) { setError("Password awal minimal 10 karakter"); return; }
    if (editingId && password && password.length < 10) { setError("Password baru minimal 10 karakter"); return; }
    if (editingId && !username.trim()) { setError("Username akun yang diedit tidak boleh kosong"); return; }
    setLoading(true);
    try {
      const res = await fetch(editingId ? `/api/users/${encodeURIComponent(editingId)}` : "/api/users", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, employeeId, role, isActive, ...(password ? { password } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (editingId ? "Gagal mengubah akun" : "Gagal membuat akun"));
      setSuccess(editingId ? `Akun @${data.user.username} berhasil diperbarui.` : `Akun @${data.user.username} berhasil dibuat. Berikan kredensial kepada pemilik akun melalui kanal aman.`);
      resetForm();
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan akun"); }
    finally { setLoading(false); }
  }

  async function deleteUser(user: Account) {
    if (user.id === currentUserId) return;
    const approved = window.confirm(`Hapus akun @${user.username}?\n\nAkun tanpa riwayat transaksi dihapus permanen. Akun dengan riwayat transaksi hanya dinonaktifkan agar audit stok tetap tersimpan.`);
    if (!approved) return;
    setError(""); setSuccess(""); setDeletingId(user.id);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus akun");
      setSuccess(data.deactivated ? `Akun @${user.username} dinonaktifkan karena memiliki riwayat transaksi.` : `Akun @${user.username} berhasil dihapus.`);
      if (editingId === user.id) resetForm();
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus akun"); }
    finally { setDeletingId(null); }
  }

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Manajemen Akun</h1>
      <p className="text-sm text-stone-500 mt-1">Tambah, edit, dan hapus akun Owner atau Karyawan. Khusus Owner.</p>
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}</div>}
    {success && <div role="status" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800">{success}</div>}
    <form onSubmit={onSubmit} className="rounded-2xl bg-white border border-stone-200 p-5 md:p-6 shadow-sm space-y-4">
      <div className="flex justify-between gap-3 items-center">
        <h2 className="font-semibold text-lg flex items-center gap-2"><UserPlus className="w-5 h-5 text-amber-700" />{editingId ? "Edit Akun" : "Tambah Akun"}</h2>
        {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"><X className="w-4 h-4"/> Batal edit</button>}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block space-y-1 text-sm font-medium text-stone-700">Nama lengkap *
          <input required maxLength={120} minLength={3} className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan nama lengkap karyawan" />
        </label>
        <label className="block space-y-1 text-sm font-medium text-stone-700">ID karyawan (opsional)
          <input maxLength={32} className={field} value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Masukkan ID karyawan" />
        </label>
      </div>
      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block space-y-1 text-sm font-medium text-stone-700">Username {editingId ? "*" : "(boleh manual atau generate)"}
          <input className={field} autoComplete="off" maxLength={32} value={username} onChange={e => setUsername(e.target.value)} placeholder="Ketik username sendiri atau klik Generate" />
        </label>
        <button type="button" onClick={suggest} disabled={suggestLoading || !name.trim()} className="px-3 py-2.5 text-sm rounded-lg border border-amber-600 text-amber-800 hover:bg-amber-50 disabled:opacity-50">{suggestLoading ? "Mengecek..." : "Generate Username"}</button>
      </div>
      <p className="text-xs text-stone-500">Generate menghasilkan nama depan + 4 angka acak. Username manual akan diperiksa keunikannya saat disimpan. Jika username tambah akun dibiarkan kosong, backend akan membuatnya otomatis.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block space-y-1 text-sm font-medium text-stone-700">Role akun *
          <select className={field} value={role} onChange={e => setRole(e.target.value as "OWNER" | "STAFF")} disabled={editingId === currentUserId}>
            <option value="STAFF">Karyawan (Staff)</option>
            <option value="OWNER">Owner</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm font-medium text-stone-700">Status akun
          <select className={field} value={isActive ? "active" : "inactive"} onChange={e => setIsActive(e.target.value === "active")} disabled={!editingId || editingId === currentUserId}>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
      </div>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-stone-700 flex items-start gap-2"><ShieldCheck className="h-5 w-5 text-amber-700 shrink-0"/> Role Owner memiliki hak mengelola semua akun. Akun yang sedang digunakan tidak bisa menonaktifkan atau menurunkan role-nya sendiri.</div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block space-y-1 text-sm font-medium text-stone-700">{editingId ? "Password baru (kosongkan jika tetap)" : "Password awal *"}
          <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required={!editingId} className={field} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 10 karakter" />
        </label>
        <label className="block space-y-1 text-sm font-medium text-stone-700">{editingId ? "Konfirmasi password baru" : "Konfirmasi password *"}
          <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required={!editingId || !!password} className={field} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ulangi password" />
        </label>
      </div>
      <div className="flex justify-end"><button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold">{loading ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Buat Akun"}</button></div>
    </form>
    <section className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
      <div className="p-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-lg">Daftar Akun</h2><div className="flex items-center gap-3"><label className="flex items-center gap-1.5 text-xs text-stone-600"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}/> Tampilkan akun nonaktif</label><button type="button" onClick={() => loadUsers().catch(e => setError(e.message))} className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-amber-700"><RefreshCw className="w-4 h-4"/> Muat ulang</button></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-stone-100 text-stone-600"><tr><th className="p-3">Nama</th><th className="p-3">Username</th><th className="p-3">ID Karyawan</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr></thead>
        <tbody>{users.filter(u => showInactive || u.isActive).map(u => <tr key={u.id} className="border-t border-stone-100"><td className="p-3 font-medium">{u.name}</td><td className="p-3 font-mono text-xs">{u.username ?? "Belum migrasi"}</td><td className="p-3">{u.employeeId ?? "—"}</td><td className="p-3">{u.role === "OWNER" ? "Owner" : "Karyawan"}</td><td className="p-3">{u.isActive ? "Aktif" : "Nonaktif"}</td>
          <td className="p-3"><div className="flex items-center gap-2">
            <button type="button" onClick={() => startEdit(u)} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-100"><Pencil className="w-3.5 h-3.5"/> Edit</button>
            <button type="button" onClick={() => deleteUser(u)} disabled={deletingId === u.id || u.id === currentUserId || !u.isActive} title={u.id === currentUserId ? "Akun yang sedang digunakan tidak dapat dihapus" : "Hapus atau nonaktifkan akun"} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5"/> Hapus</button>
          </div></td></tr>)}</tbody></table>{users.filter(u => showInactive || u.isActive).length === 0 && <p className="p-4 text-sm text-stone-500">Belum ada akun yang ditampilkan.</p>}</div>
    </section>
  </div>;
}
