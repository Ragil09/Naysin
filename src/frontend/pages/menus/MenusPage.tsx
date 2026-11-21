"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, ImagePlus, Coffee } from "lucide-react";

type Tag = { id: string; name: string; key: string };
type Ingredient = { id: string; name: string; isActive: boolean };
type Menu = { id: string; name: string; category: string; description: string; price: number | null; isAvailable: boolean; notes: string | null; aliases: { id: string; alias: string }[]; tags: Tag[]; ingredients: { ingredientId: string; ingredient: { name: string; isActive: boolean } }[]; image: { menuId: string; updatedAt: string } | null };
const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const emptyForm = { name: "", category: "", tags: [] as string[], price: "", description: "", aliases: [] as string[], notes: "", isAvailable: true, ingredientIds: [] as string[] };
const field = "w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white";
const primary = "inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
const secondary = "inline-flex items-center justify-center gap-2 px-3 py-2 border border-stone-200 bg-white hover:bg-stone-50 rounded-lg text-sm font-medium disabled:opacity-50";

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [owner, setOwner] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aliasInput, setAliasInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [tagError, setTagError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [ingredientReady, setIngredientReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (!selectedImage) { setImagePreview(null); return; }
    const url = URL.createObjectURL(selectedImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  async function loadMenus() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/menus", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat menu.");
      setMenus(data.menus || []); setTags(data.tags || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat menu."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void loadMenus();
    fetch("/api/auth/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(async data => {
      const isOwner = data?.user?.role === "OWNER";
      setOwner(isOwner);
      if (isOwner) {
        const r = await fetch("/api/ingredients", { cache: "no-store" });
        if (r.ok) { const result = await r.json(); setIngredients(result.ingredients || []); setIngredientReady(true); }
      }
    }).catch(() => {});
  }, []);

  function openForm(menu?: Menu) {
    setEditing(menu?.id ?? null);
    setSelectedImage(null); setRemoveImage(false);
    setForm(menu ? { name: menu.name, category: menu.category, tags: menu.tags.map(t => t.name).filter(t => key(t) !== key(menu.category)), price: menu.price === null ? "" : String(menu.price), description: menu.description, aliases: menu.aliases.map(a => a.alias), notes: menu.notes ?? "", isAvailable: menu.isAvailable, ingredientIds: menu.ingredients.map(i => i.ingredientId) } : { ...emptyForm });
    setAliasInput(""); setTagInput(""); setFormError(""); setTagError(""); setTagOpen(false); setOpen(true);
  }
  function addAliases() {
    const entries = aliasInput.split(/[,\n]/).map(key).filter(Boolean);
    setForm(old => ({ ...old, aliases: [...new Set([...old.aliases, ...entries])] }));
    setAliasInput("");
  }
  async function addTag() {
    const name = tagInput.trim(); if (!name) { setTagError("Isi nama tag."); return; }
    setAddingTag(true); setTagError("");
    try {
      const res = await fetch("/api/menus/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Gagal membuat tag.");
      const canonical = data.tag.name as string;
      setTags(old => [...old.filter(t => key(t) !== key(canonical)), canonical].sort((a,b) => a.localeCompare(b, "id")));
      if (open) setForm(old => old.category ? { ...old, tags: key(old.category) === key(canonical) || old.tags.some(t => key(t) === key(canonical)) ? old.tags : [...old.tags, canonical] } : { ...old, category: canonical });
      setTagInput(""); setTagOpen(false); if (!open) setSuccess(`Tag ${canonical} siap digunakan.`);
    } catch (err) { setTagError(err instanceof Error ? err.message : "Gagal membuat tag."); }
    finally { setAddingTag(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setFormError(""); setSaving(true);
    const aliases = [...new Set([...form.aliases, ...aliasInput.split(/[,\n]/).map(key).filter(Boolean)])];
    try {
      const res = await fetch(editing ? `/api/menus/${editing}` : "/api/menus", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, aliases, price: form.price === "" ? null : Number(form.price), ingredientIds: ingredientReady ? form.ingredientIds : undefined }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Gagal menyimpan menu.");
      const menuId = data.menu.id as string;
      // Simpan ID setelah menu baru berhasil dibuat, agar kegagalan upload tidak membuat duplikat.
      setEditing(menuId);
      if (selectedImage) {
        const upload = new FormData();
        upload.append("image", selectedImage);
        const imageRes = await fetch(`/api/menus/${encodeURIComponent(menuId)}/image`, { method: "POST", body: upload });
        const imageData = await imageRes.json();
        if (!imageRes.ok) throw new Error(imageData.error || "Menu disimpan, tetapi unggah gambar gagal. Coba simpan kembali.");
        setSelectedImage(null);
      } else if (removeImage) {
        const imageRes = await fetch(`/api/menus/${encodeURIComponent(menuId)}/image`, { method: "DELETE" });
        const imageData = await imageRes.json();
        if (!imageRes.ok) throw new Error(imageData.error || "Menu tersimpan, tetapi penghapusan gambar gagal.");
        setRemoveImage(false);
      }
      setSuccess(editing ? "Perubahan menu berhasil disimpan." : "Menu baru berhasil ditambahkan."); setOpen(false); setTagOpen(false); await loadMenus();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Gagal menyimpan menu."); }
    finally { setSaving(false); }
  }
  async function deleteMenu(menu: Menu) {
    if (!owner || deletingId) return;
    if (!window.confirm(`Hapus menu "${menu.name}" secara permanen?\n\nIstilah/alias dan relasi bahan pada menu ikut terhapus. Stok bahan baku tidak berubah.`)) return;
    setDeletingId(menu.id); setSuccess(""); setError("");
    try {
      const res = await fetch(`/api/menus/${encodeURIComponent(menu.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus menu.");
      await loadMenus();
      setSuccess(`Menu ${menu.name} berhasil dihapus.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal menghapus menu."); }
    finally { setDeletingId(null); }
  }
  const menuTags = (m: Menu) => [...new Map([m.category, ...m.tags.map(t => t.name)].map(t => [key(t), t])).values()];
  const filtered = menus.filter(m => (!filter || menuTags(m).some(t => key(t) === key(filter))) && [m.name, m.description, ...menuTags(m), ...m.aliases.map(a => a.alias)].some(v => key(v).includes(key(search))));
  const tagEditor = <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3 space-y-2"><label className="block text-xs font-semibold">Nama tag baru</label><div className="flex flex-wrap gap-2"><input aria-label="Nama tag baru" className={`${field} flex-1 min-w-32`} maxLength={60} value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Contoh: Matcha" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!addingTag) void addTag(); } }}/><button type="button" className={primary} disabled={addingTag || saving} onClick={() => void addTag()}>{addingTag ? "Menyimpan..." : "Buat tag"}</button><button type="button" className={secondary} disabled={addingTag} onClick={() => { setTagOpen(false); setTagError(""); }}>Batal</button></div>{tagError && <p role="alert" className="text-sm text-red-700">{tagError}</p>}</div>;

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h2 className="text-2xl font-bold tracking-tight text-stone-900">Master Menu &amp; Pengetahuan Asisten AI</h2><p className="text-sm text-stone-500">Kelola menu resmi, harga, tag, komposisi, dan istilah pelanggan.</p></div>
      {owner && <div className="flex gap-2 flex-wrap"><button className={secondary} onClick={() => { setTagInput(""); setTagError(""); setTagOpen(v => !v); }}><Plus className="w-4 h-4"/> Tag Baru</button><button className={primary} onClick={() => openForm()}><Plus className="w-4 h-4"/> Tambah Menu</button></div>}
    </div>
    {owner && tagOpen && !open && tagEditor}
    {success && <p role="status" className="text-sm bg-emerald-50 text-emerald-800 p-3 rounded-lg">{success}</p>}
    {error && <div role="alert" className="text-sm bg-red-50 text-red-800 p-3 rounded-lg">{error} <button className="underline" onClick={() => void loadMenus()}>Coba lagi</button></div>}
    <div className="flex flex-col sm:flex-row gap-3"><div className="flex flex-1 items-center gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-sm"><Search className="w-5 h-5 text-stone-400"/><input aria-label="Cari menu" className="w-full text-sm outline-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu, tag, atau istilah..."/></div><select aria-label="Filter tag" className={`${field} sm:w-48`} value={filter} onChange={e => setFilter(e.target.value)}><option value="">Semua tag</option>{tags.map(t => <option key={key(t)}>{t}</option>)}</select></div>
    {loading && <p className="text-sm text-stone-500">Memuat menu...</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filtered.map(menu => <div key={menu.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4"><div className="space-y-3">
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-amber-50 flex items-center justify-center text-amber-700">
        {menu.image ? <img src={`/api/menus/${encodeURIComponent(menu.id)}/image?v=${encodeURIComponent(menu.image.updatedAt)}`} alt={`Foto ${menu.name}`} loading="lazy" className="w-full h-full object-cover"/> : <Coffee className="w-10 h-10" aria-label="Belum ada foto menu"/>}
      </div><div className="flex items-start justify-between gap-2"><h3 className="font-bold text-stone-900">{menu.name}</h3>{owner && <div className="flex gap-2">
        <button title="Edit menu" aria-label={`Edit ${menu.name}`} className={secondary} onClick={() => openForm(menu)}><Pencil className="w-4 h-4"/></button>
        <button title="Hapus menu" aria-label={`Hapus ${menu.name}`} disabled={deletingId !== null} className={`${secondary} text-rose-700 border-rose-200 hover:bg-rose-50`} onClick={() => void deleteMenu(menu)}><Trash2 className="w-4 h-4"/></button>
      </div>}</div><div className="flex flex-wrap gap-1">{menuTags(menu).map(t => <span key={key(t)} className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">{t}</span>)}</div><p className="text-sm text-stone-600 whitespace-pre-wrap">{menu.description}</p>{menu.aliases.length > 0 && <div><p className="text-[11px] uppercase font-semibold text-stone-500 mb-1">Istilah / Alias</p><div className="flex flex-wrap gap-1">{menu.aliases.map(a => <span key={a.id} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">{a.alias}</span>)}</div></div>}{menu.ingredients.length > 0 && <p className="text-xs text-stone-500">Bahan: {menu.ingredients.map(i => i.ingredient.name).join(", ")}</p>}{owner && menu.notes && <p className="text-xs text-stone-500 whitespace-pre-wrap">Catatan: {menu.notes}</p>}</div><div className="border-t border-stone-100 pt-3 flex items-center justify-between gap-2"><span className="text-sm font-bold">{menu.price === null ? "Harga belum diverifikasi" : `Rp${menu.price.toLocaleString("id-ID")}`}</span><span className={`text-xs rounded px-2 py-1 ${menu.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{menu.isAvailable ? "Tersedia" : "Tidak tersedia"}</span></div></div>)}
      {!loading && !filtered.length && <p className="col-span-full text-center py-12 text-stone-400">Tidak ada menu yang sesuai.</p>}
    </div>
    {owner && open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-labelledby="menu-title" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"><div className="flex items-center justify-between mb-4"><h3 id="menu-title" className="text-xl font-bold">{editing ? "Edit Menu" : "Tambah Menu Baru"}</h3><button type="button" aria-label="Tutup" disabled={saving || addingTag} onClick={() => { setOpen(false); setTagOpen(false); }}><X className="w-5 h-5"/></button></div><form className="space-y-4" onSubmit={save}>
      <label className="block text-sm font-medium">Nama menu *<input className={`${field} mt-1`} required maxLength={150} value={form.name} onChange={e => setForm(o => ({ ...o, name: e.target.value }))} placeholder="Contoh: Kopi Nays"/></label>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
        <label htmlFor="menu-image" className="text-sm font-medium flex items-center gap-2"><ImagePlus className="w-4 h-4"/> Foto menu (opsional)</label>
        <div className="rounded-lg overflow-hidden bg-amber-50 text-amber-700 flex items-center justify-center w-full max-w-sm aspect-[4/3]">
          {imagePreview ? <img src={imagePreview} alt="Pratinjau gambar baru" className="w-full h-full object-cover"/> : editing && !removeImage && menus.some(m => m.id === editing && m.image) ? <img src={`/api/menus/${encodeURIComponent(editing)}/image?v=${encodeURIComponent(menus.find(m => m.id === editing)?.image?.updatedAt ?? "")}`} alt="Gambar menu saat ini" className="w-full h-full object-cover"/> : <Coffee className="w-10 h-10" aria-label="Belum ada gambar"/>}
        </div>
        <input id="menu-image" type="file" accept="image/jpeg,image/png,image/webp" className={`${field} cursor-pointer`} disabled={saving} onChange={event => {
          const file = event.target.files?.[0] ?? null;
          if (file && (file.size > 1_500_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
            setFormError("Gambar harus JPG, PNG, atau WebP dengan ukuran maksimal 1,5 MB.");
            setSelectedImage(null);
            event.target.value = "";
            return;
          }
          setFormError(""); setSelectedImage(file); if (file) setRemoveImage(false);
        }}/>
        <p className="text-xs text-stone-500">Gunakan foto JPG, PNG, atau WebP maksimal 1,5 MB. Foto ditampilkan di katalog pelanggan.</p>
        {(selectedImage || (editing && menus.some(m => m.id === editing && m.image) && !removeImage)) &&
          <button type="button" className={`${secondary} text-rose-700`} disabled={saving} onClick={() => { setSelectedImage(null); setRemoveImage(true); const input = document.getElementById("menu-image") as HTMLInputElement | null; if (input) input.value = ""; }}>Hapus foto</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="block text-sm font-medium">Tag utama / kategori *<select className={`${field} mt-1`} required value={form.category} onChange={e => setForm(o => ({ ...o, category: e.target.value, tags: o.tags.filter(t => key(t) !== key(e.target.value)) }))}><option value="">Pilih tag utama</option>{[...new Map([...tags, ...(form.category ? [form.category] : [])].map(t => [key(t),t])).values()].map(t => <option key={key(t)} value={t}>{t}</option>)}</select></label><label className="block text-sm font-medium">Harga (Rp)<input className={`${field} mt-1`} type="number" min="0" max="2147483647" step="1" value={form.price} onChange={e => setForm(o => ({ ...o, price: e.target.value }))} placeholder="18000"/><span className="text-xs text-stone-500">Kosong jika belum diverifikasi.</span></label></div>
      <div className="space-y-2"><div className="flex justify-between items-center gap-2"><p className="text-sm font-medium">Tag tambahan (opsional)</p><button type="button" className={secondary} onClick={() => { setTagOpen(v => !v); setTagError(""); }}><Plus className="w-4 h-4"/> Buat tag baru</button></div>{tagOpen && tagEditor}<div className="flex flex-wrap gap-2">{tags.filter(t => key(t) !== key(form.category)).map(t => <label key={key(t)} className="text-sm inline-flex items-center gap-1.5 border border-stone-200 rounded-md px-2 py-1"><input type="checkbox" checked={form.tags.some(a => key(a) === key(t))} onChange={e => setForm(o => ({ ...o, tags: e.target.checked ? [...o.tags,t] : o.tags.filter(a => key(a) !== key(t)) }))}/>{t}</label>)}</div></div>
      <label className="block text-sm font-medium">Deskripsi *<textarea className={`${field} mt-1 min-h-24`} required maxLength={2000} value={form.description} onChange={e => setForm(o => ({ ...o, description: e.target.value }))} placeholder="Rasa, ciri khas, dan informasi resmi menu..."/></label>
      <div className="space-y-2"><label htmlFor="menu-alias" className="text-sm font-medium">Istilah / alias pelanggan</label><div className="flex gap-2"><input id="menu-alias" className={field} value={aliasInput} onChange={e => setAliasInput(e.target.value)} placeholder="kopi aren, es kopi gula aren" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAliases(); } }}/><button type="button" className={secondary} onClick={addAliases}><Plus className="w-4 h-4"/> Tambah</button></div><p className="text-xs text-stone-500">Pisahkan beberapa istilah dengan koma. Istilah juga tersimpan jika langsung menekan Simpan.</p><div className="flex flex-wrap gap-2">{form.aliases.map(a => <button key={a} type="button" aria-label={`Hapus istilah ${a}`} className="text-xs px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 inline-flex gap-1 items-center" onClick={() => setForm(o => ({ ...o, aliases: o.aliases.filter(v => v !== a) }))}>{a}<X className="w-3 h-3"/></button>)}</div></div>
      <div><p className="text-sm font-medium mb-1">Komposisi / bahan baku (opsional)</p>{ingredientReady ? <div className="border border-stone-200 rounded-lg p-3 max-h-40 overflow-auto space-y-2">{ingredients.filter(i => i.isActive || form.ingredientIds.includes(i.id)).map(i => <label className="flex items-center gap-2 text-sm" key={i.id}><input type="checkbox" checked={form.ingredientIds.includes(i.id)} onChange={e => setForm(o => ({ ...o, ingredientIds: e.target.checked ? [...o.ingredientIds, i.id] : o.ingredientIds.filter(v => v !== i.id) }))}/>{i.name}{!i.isActive && " (nonaktif)"}</label>)}{!ingredients.length && <p className="text-xs text-stone-500">Belum ada bahan baku.</p>}</div> : <p className="text-xs text-stone-500">Daftar bahan belum tersedia; relasi lama tidak akan diubah.</p>}<p className="text-xs text-stone-500 mt-1">Digunakan sebagai referensi jawaban asisten, tidak mengurangi stok otomatis.</p></div>
      <label className="block text-sm font-medium">Catatan internal<textarea className={`${field} mt-1`} maxLength={1000} value={form.notes} onChange={e => setForm(o => ({ ...o, notes: e.target.value }))} rows={2}/></label>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.isAvailable} onChange={e => setForm(o => ({ ...o, isAvailable: e.target.checked }))}/> Menu tersedia (dapat dijawab/direkomendasikan asisten)</label>
      {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{formError}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-stone-100"><button type="button" className={secondary} disabled={saving || addingTag} onClick={() => { setOpen(false); setTagOpen(false); }}>Batal</button><button className={primary} type="submit" disabled={saving || addingTag}>{saving ? "Menyimpan..." : "Simpan Menu"}</button></div>
    </form></div></div>}
  </div>;
}
