"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatStock } from "@/shared/inventory/stock-units";
import { jakartaDateKey } from "@/shared/inventory/stock-dates";

type Batch = { id: string; lotCode: string | null; quantityRemaining: number; expiresAt: string | null; receivedAt: string };
type Ingredient = { id: string; name: string; unit: string; alternateUnit: string | null; unitsPerAlternate: number | null; currentStock: number; batches: Batch[] };

export default function NewStockMutationPage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({
    ingredientId: "",
    type: "IN",
    quantity: "",
    inputUnit: "",
    note: "",
    wasteReason: "EXPIRED",
    batchId: "",
    lotCode: "",
    receivedDate: jakartaDateKey(),
    expiryDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch("/api/ingredients?includeBatches=true")
      .then((res) => {
        if (!res.ok) throw new Error("Gagal mengambil bahan baku");
        return res.json();
      })
      .then((data) => {
        setIngredients(data.ingredients || []);
        if (data.ingredients && data.ingredients.length > 0) {
          setForm((prev) => ({ ...prev, ingredientId: data.ingredients[0].id }));
        }
      }).catch(() => setErrorMsg("Gagal mengambil data bahan baku"));
  }, []);

  const selectedIngredient = ingredients.find((i) => i.id === form.ingredientId);
  const batches = selectedIngredient?.batches || [];
  const legacyQty = Math.max(0, (selectedIngredient?.currentStock || 0) - batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0));
  const availableBatches = batches.filter(batch =>
    (form.type === "ADJUSTMENT" || batch.quantityRemaining > 0) &&
    (form.type !== "OUT" || !batch.expiresAt || jakartaDateKey(new Date(batch.expiresAt)) >= jakartaDateKey())
  );
  const selectedBatch = batches.find(batch => batch.id === form.batchId);
  const inputUnit = form.inputUnit || selectedIngredient?.unit || "";
  const factor = selectedIngredient && selectedIngredient.alternateUnit === inputUnit ? (selectedIngredient.unitsPerAlternate || 1) : 1;
  const availableQty = selectedBatch?.quantityRemaining ?? (form.batchId === "legacy" ? legacyQty : undefined);
  const maxInput = availableQty !== undefined ? Math.floor(availableQty / factor) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.type !== "IN" && !form.batchId) {
      setErrorMsg("Pilih batch atau stok lama terlebih dahulu");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const idempotencyKey = "web-" + crypto.randomUUID();

    try {
      const res = await fetch("/api/stock/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: form.ingredientId,
          type: form.type,
          quantity: Number(form.quantity),
          inputUnit,
          expectedFactor: factor,
          batchId: form.type !== "IN" && form.batchId !== "legacy" ? form.batchId : undefined,
          lotCode: form.type === "IN" ? form.lotCode || undefined : undefined,
          receivedDate: form.type === "IN" ? form.receivedDate : undefined,
          expiryDate: form.type === "IN" ? form.expiryDate || undefined : undefined,
          note: form.note || undefined,
          wasteReason: form.type === "WASTE" ? form.wasteReason : undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal mencatat mutasi stok");
      } else {
        setSuccessMsg(
          `Mutasi ${form.type} berhasil dicatat. Saldo terbaru: ${data.result.afterQty} ${selectedIngredient?.unit || ""}`
        );
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      }
    } catch {
      setErrorMsg("Terjadi kegagalan jaringan saat mengirim mutasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">
          Catat Transaksi Stok
        </h2>
        <p className="text-sm text-stone-500">
          Input mutasi stok masuk, keluar operasional, opname, atau pencatatan waste/rusak.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        {errorMsg && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tipe Mutasi */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { type: "IN", label: "Masuk (IN)" },
                { type: "OUT", label: "Keluar (OUT)" },
                { type: "ADJUSTMENT", label: "Opname" },
                { type: "WASTE", label: "Waste (Terbuang)" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setForm({ ...form, type: item.type, batchId: "", quantity: "" })}
                  className={`py-2 px-1 text-xs font-semibold rounded-lg border text-center transition ${
                    form.type === item.type
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pilih Bahan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Bahan Baku
            </label>
            <select
              value={form.ingredientId}
              onChange={(e) => setForm({ ...form, ingredientId: e.target.value, batchId: "", inputUnit: "", quantity: "" })}
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600 bg-white"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (Saldo: {formatStock(ing.currentStock, ing.unit, ing.alternateUnit, ing.unitsPerAlternate)})
                </option>
              ))}
            </select>
          </div>

          {form.type === "IN" ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900">Informasi Batch Penerimaan</p>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Kode Batch / Lot (Opsional)</label>
                <input type="text" value={form.lotCode} onChange={(e) => setForm({ ...form, lotCode: e.target.value })}
                  placeholder="Contoh: LOT-001" className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Tanggal Penerimaan</label>
                <input type="date" required max={jakartaDateKey()} value={form.receivedDate}
                  onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Tanggal Kedaluwarsa (Jika Ada)</label>
                <input type="date" min={form.receivedDate || undefined} value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white" />
                <p className="mt-1 text-xs text-stone-500">Isi sesuai label pemasok. Kosongkan hanya jika tanggal tidak berlaku atau belum diketahui; batch tanpa tanggal tidak memicu peringatan kedaluwarsa.</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Batch / Stok Lama</label>
              <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value, quantity: "" })}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white">
                <option value="">Pilih batch...</option>
                {availableBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.lotCode || `Batch ${batch.id.slice(0, 8)}`} | {batch.quantityRemaining} {selectedIngredient?.unit} | Exp: {batch.expiresAt ? jakartaDateKey(new Date(batch.expiresAt)) : "Tidak diketahui"}
                  </option>
                ))}
                {legacyQty > 1e-8 && <option value="legacy">Stok lama tanpa batch ({legacyQty} {selectedIngredient?.unit})</option>}
              </select>
              <p className="text-xs text-stone-500 mt-1">{form.type === "OUT" ? "Pilih batch dengan tanggal kedaluwarsa terdekat yang masih berlaku. Batch kedaluwarsa hanya dapat dibuang melalui Waste." : form.type === "ADJUSTMENT" ? "Opname mengubah saldo batch atau stok lama yang dipilih, bukan saldo total bahan." : "Pilih batch yang benar-benar dibuang agar sisa stok sesuai."}</p>
            </div>
          )}

          {/* Unit kemasan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Satuan Transaksi</label>
            <select value={inputUnit} onChange={e => setForm({ ...form, inputUnit: e.target.value, quantity: "" })} className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white" required>
              {selectedIngredient && <option value={selectedIngredient.unit}>{selectedIngredient.unit} (satuan dasar)</option>}
              {selectedIngredient?.alternateUnit && <option value={selectedIngredient.alternateUnit}>{selectedIngredient.alternateUnit} (1 = {selectedIngredient.unitsPerAlternate} {selectedIngredient.unit})</option>}
            </select>
            {factor > 1 && <p className="mt-1 text-xs text-stone-500">1 {inputUnit} = {factor} {selectedIngredient?.unit}. Gunakan satuan dasar untuk pencatatan sisa kemasan.</p>}
          </div>

          {/* Kuantitas */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {form.type === "ADJUSTMENT"
                ? "Hasil Hitung Fisik Batch / Stok Lama (Saldo Baru)"
                : `Jumlah Kuantitas (${inputUnit})`}
            </label>
            <input
              type="number"
              step="1"
              min={form.type === "ADJUSTMENT" ? "0" : "1"}
              max={form.type === "OUT" || form.type === "WASTE" ? maxInput : undefined}
              required
              placeholder="Contoh: 2"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600"
            />
          </div>

          {selectedIngredient && form.quantity !== "" && Number.isSafeInteger(Number(form.quantity)) && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">{form.quantity} {inputUnit} = {Number(form.quantity) * factor} {selectedIngredient.unit} (satuan dasar)</p>}

          {/* Waste Reason if WASTE */}
          {form.type === "WASTE" && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Penyebab Pembuangan (Waste Reason)
              </label>
              <select
                value={form.wasteReason}
                onChange={(e) => setForm({ ...form, wasteReason: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600 bg-white"
              >
                <option value="EXPIRED">Kedaluwarsa (Expired)</option>
                <option value="SPOILED">Basi / Rusak Penyimpanan</option>
                <option value="DAMAGED">Kemasan Bocor / Pecah</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
          )}

          {/* Catatan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Keterangan / Nomor Referensi (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Penerimaan supplier #PO-902 atau pemakaian shift sore"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg outline-none focus:border-amber-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !!successMsg || !form.ingredientId || (form.type !== "IN" && !form.batchId)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 text-white font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{loading ? "Menyimpan Transaksi..." : "Simpan Mutasi Stok"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

