# NaysIn / Naysin2

Sistem digital manajemen stok dan asisten menu untuk Nays Kopi. Proyek ini tetap merupakan **satu aplikasi Next.js** yang memisahkan kode tampilan (frontend), logika server (backend), dan utilitas bersama (shared). Repository GitHub tetap **satu repository**.

## Struktur proyek

```text
src/
  app/                 # Entry point routing Next.js (halaman + API routes)
    (auth)/            # Halaman login
    (dashboard)/       # Halaman internal Owner / Staff
    api/               # Route handlers Next.js; otorisasi dan delegasi ke backend
    assistant/         # Chat publik
    page.tsx           # Beranda katalog publik
  frontend/
    components/        # Komponen UI (AppShell, PublicHome)
    pages/             # Implementasi halaman (login, dashboard, dll)
  backend/
    assistant/         # Rule-based dan Gemini
    inventory/         # Mutasi stok, ringkasan, ekspor CSV
    menus/             # CRUD, tag, validasi, gambar menu
    public/            # Katalog publik, pembatasan kuota chat
    users/             # Manajemen akun dan username
    whatsapp/          # Adapter WhatsApp (terpisah dari Click-to-Chat)
    auth.ts            # Sesi & password
    db.ts              # Prisma Client
  shared/              # Kode murni (tanpa akses DB / secret)
    inventory/         # Konversi satuan dan penanganan tanggal
    types/             # Tipe data publik
    whatsapp-order.ts  # Pembentukan link wa.me
prisma/                # Schema dan seed
public/                # Aset statis
tests/                 # Pengujian
```

Rincian impor dan pembagian tanggung jawab: [docs/STRUKTUR-FRONTEND-BACKEND.md](docs/STRUKTUR-FRONTEND-BACKEND.md).

## Teknologi

Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma 6, `jose`/bcryptjs (autentikasi), Vitest. Gemini API dipanggil dari backend untuk membantu pemahaman pertanyaan; data faktual menu diambil dari PostgreSQL. Klik pemesanan WhatsApp via `wa.me` tidak membutuhkan webhook Meta.

## Menjalankan secara lokal di Windows (PowerShell)

Gunakan Node.js yang kompatibel dengan Next.js 16, lalu:

```powershell
npm.cmd install --legacy-peer-deps
```

Buat `.env` sendiri berdasarkan `.env.example`. Siapkan database PostgreSQL **naysin2**, dan isi `DATABASE_URL`, `DIRECT_URL`, serta `AUTH_SECRET` dengan nilai lokal Anda. **Jangan unggah `.env` ke GitHub**.

Jika database lama sudah dibuat, perubahan struktur folder ini **tidak memerlukan** `prisma db push` atau seed ulang. Untuk proyek baru yang datanya belum ada, langkah setup database dapat dilakukan sesuai prosedur biasa.

```powershell
npx.cmd prisma generate
npm.cmd run check:structure
npx.cmd tsc --noEmit
npx.cmd vitest run
npm.cmd run dev -- --port 3001
```

- Beranda pelanggan: http://localhost:3001
- Asisten menu pelanggan: http://localhost:3001/assistant
- Login Owner/Staff: http://localhost:3001/login
- Dashboard: http://localhost:3001/dashboard

## Konfigurasi opsional

- `GEMINI_API_KEY`, `GEMINI_MODEL`, `ASSISTANT_PROVIDER`: Gemini API (server-side).
- `PUBLIC_GEMINI_ENABLED=true`: Memungkinkan chat publik memanggil Gemini dengan pembatasan kuota backend.
- `NAYSIN_WHATSAPP_NUMBER`: Nomor mitra untuk tautan Click-to-Chat.
- Kredensial `WHATSAPP_*`: Hanya untuk adapter webhook Meta yang disiapkan terpisah; tidak diperlukan untuk tombol pesan melalui WhatsApp.

## Catatan refactoring

Refactoring ini bertujuan **memindahkan file dan memperbarui import saja**, bukan mengubah tampilan atau alur bisnis. Data database dan akun yang sudah ada tetap dipertahankan. Lakukan pengujian lokal sebelum push/merge ke branch utama.
