"use client";

import { useEffect, useState } from "react";
import { Plus, Search, AlertCircle, ShieldAlert, Pencil, Download, Trash2, RotateCcw } from "lucide-react";

import { PACKAGE_UNITS, formatStock } from "@/shared/inventory/stock-units";

const emptyForm = { name: "", unit: "kotak", alternateUnit: "", unitsPerAlternate: 12, minimumStock: 0, notes: "" };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(showArchived ? "/api/ingredients?includeArchived=true" : "/api/ingredients", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setIngredients(json.ingredients || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(data => setIsOwner(data?.user?.role === "OWNER")).catch(() => {});
  }, []);
  useEffect(() => { void loadData(); }, [showArchived]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/ingredients/${editing}` : "/api/ingredients", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Gagal menyimpan bahan baku"); return; }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch { setErrorMsg("Gagal terhubung ke server"); }
    finally { setSaving(false); }
  }

  async function exportCsv() {
    setExportError("");
    setExporting(true);
    try {
      const res = await fetch("/api/ingredients/export", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal mengekspor bahan baku");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "naysin_bahan_baku.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Gagal mengekspor bahan baku");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(item: any) {
    if (!isOwner || deletingId) return;
    if (!window.confirm(`Hapus bahan baku "${item.name}"?\n\nBahan harus memiliki stok 0 dan tidak digunakan menu. Jika memiliki riwayat transaksi, bahan akan diarsipkan agar riwayat tidak hilang.`)) return;
    setDeletingId(item.id); setActionError(""); setActionSuccess("");
    try {
      const res = await fetch(`/api/ingredients/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menghapus bahan baku.");
      setActionSuccess(result.message || "Bahan berhasil dihapus.");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menghapus bahan baku.");
    } finally { setDeletingId(null); }
  }

  async function restoreIngredient(item: any) {
    if (!isOwner || deletingId) return;
    setDeletingId(item.id); setActionError(""); setActionSuccess("");
    try {
      const res = await fetch(`/api/ingredients/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengaktifkan bahan baku.");
      setActionSuccess(`Bahan baku ${item.name} berhasil diaktifkan kembali.`);
      await loadData();
    } catch (err) { setActionError(err instanceof Error ? err.message : "Gagal memulihkan bahan baku."); }
    finally { setDeletingId(null); }
  }

  function openForm(item?: any) {
    setEditing(item?.id || null);
    setErrorMsg("");
    setForm(item ? { name: item.name, unit: item.unit, alternateUnit: item.alternateUnit || "", unitsPerAlternate: item.unitsPerAlternate || 12, minimumStock: item.minimumStock, notes: item.notes || "" } : emptyForm);
    setShowModal(true);
  }

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">
            Master Bahan Baku
          </h2>
          <p className="text-sm text-stone-500">
            Daftar seluruh bahan baku aktif, batas minimum stok, dan unit operasional.
          </p>
        </div>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              title="Ekspor seluruh master bahan baku"
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-medium rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? "Mengekspor..." : "Export CSV"}</span>
            </button>
            <button
              type="button"
              onClick={() => openForm()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Bahan</span>
            </button>
          </div>
        )}
      </div>
      {exportError && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
          {exportError}
        </div>
      )}

      {isOwner && <label className="inline-flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        Tampilkan juga bahan baku yang diarsipkan
      </label>}
      {actionError && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{actionError}</div>}
      {actionSuccess && <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{actionSuccess}</div>}

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
        <Search className="w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Cari bahan baku (misal: Kopi, Susu, Gula)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[11px] font-semibold border-b border-stone-200">
              <tr>
                <th className="px-5 py-3.5">Nama Bahan</th>
                <th className="px-5 py-3.5">Saldo Saat Ini</th>
                <th className="px-5 py-3.5">Ambang Min.</th>
                <th className="px-5 py-3.5">Satuan</th>
                <th className="px-5 py-3.5">Status Stok</th>
                {isOwner && <th className="px-5 py-3.5">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((item) => {
                const isLow = item.currentStock <= item.minimumStock;
                return (
                  <tr key={item.id} className="hover:bg-stone-50/60 transition">
                    <td className="px-5 py-4 font-medium text-stone-900">
                      {item.name}
                      {!item.isActive && <span className="ml-2 text-xs font-semibold text-stone-500">(Diarsipkan)</span>}
                      {item.notes && (
                        <p className="text-xs text-stone-400 font-normal">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-stone-900">
                      {formatStock(item.currentStock, item.unit, item.alternateUnit, item.unitsPerAlternate)}
                    </td>
                    <td className="px-5 py-4 text-stone-500">
                      {item.minimumStock.toLocaleString("id-ID")} {item.unit}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-stone-600">
                      {item.unit}
                      {item.alternateUnit && <p className="mt-1 text-stone-500">1 {item.alternateUnit} = {item.unitsPerAlternate} {item.unit}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {!item.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">Diarsipkan</span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          Menipis
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Aman
                        </span>
                      )}
                    </td>
                    {isOwner && <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2">
                      {item.isActive ? <>
                        <button type="button" onClick={() => openForm(item)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:bg-amber-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                        <button type="button" disabled={deletingId !== null} onClick={() => void handleDelete(item)} aria-label={`Hapus bahan ${item.name}`} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" />{deletingId === item.id ? "Memproses..." : "Hapus"}</button>
                      </> : <button type="button" disabled={deletingId !== null} onClick={() => void restoreIngredient(item)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 text-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-50 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" /> Pulihkan</button>}
                    </div></td>}
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={isOwner ? 6 : 5} className="text-center py-8 text-stone-400">
                    Tidak ada bahan baku yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Bahan */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 mb-1">{editing ? "Edit Bahan Baku" : "Tambah Bahan Baku Baru"}</h3>
            <p className="text-xs text-stone-500 mb-4">
              Khusus akun Owner. Masukkan nama bahan baku dan satuan dasar operasional.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nama Bahan Baku
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bubuk Cokelat Murni"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600"
                />
              </div>

              <datalist id="package-units">{PACKAGE_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Satuan Dasar (Terkecil)</label>
                  <input type="text" list="package-units" required maxLength={30} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg" placeholder="kotak" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Ambang Minimum ({form.unit})</label>
                  <input type="number" min="0" step="1" required value={form.minimumStock} onChange={e => setForm({ ...form, minimumStock: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg" />
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-2">
                <label className="block text-xs font-semibold text-stone-700">Satuan Tambahan (Opsional)</label>
                <input type="text" list="package-units" maxLength={30} placeholder="Contoh: dus (kosongkan jika tidak ada)" value={form.alternateUnit} onChange={e => setForm({ ...form, alternateUnit: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-300 bg-white rounded-lg" />
                {form.alternateUnit.trim() && <><label className="block text-xs font-semibold text-stone-700">Jumlah {form.unit} dalam 1 {form.alternateUnit}</label><input type="number" required min="2" step="1" value={form.unitsPerAlternate} onChange={e => setForm({ ...form, unitsPerAlternate: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-stone-300 bg-white rounded-lg" /><p className="text-xs text-amber-700">1 {form.alternateUnit} = {form.unitsPerAlternate} {form.unit}</p></>}
                <p className="text-xs text-stone-500">Saldo dan ambang minimum selalu menggunakan satuan dasar. Satuan dasar tidak bisa diganti setelah memiliki stok atau riwayat; satuan tambahan dapat diubah.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Catatan / Cara Simpan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Simpan di freezer suhu -18C"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition shadow-sm"
                >
                  {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Bahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

