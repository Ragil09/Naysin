# Struktur Frontend–Backend Naysin2

## Tujuan

Memperjelas kontribusi frontend dan backend dalam **satu repository GitHub**, tanpa memecah Next.js menjadi dua server/deployment. Seluruh rute URL tetap memakai `src/app` sesuai App Router. Tidak ada endpoint atau tabel yang diganti akibat pemindahan folder.

## Tanggung jawab

| Bagian | Folder | Pemilik tugas |
|---|---|---|
| Halaman login, dashboard, Master Menu, katalog pelanggan, form | `src/app/(auth)`, `src/app/(dashboard)`, `src/app/assistant`, `src/app/page.tsx` | Frontend (berkoordinasi dengan Backend) |
| Komponen UI | `src/frontend/components/` | Frontend |
| Implementasi halaman (login, dashboard, stok, menu, akun, chat) | `src/frontend/pages/` | Frontend |
| Endpoint Next.js (HTTP, validasi request, otorisasi) | `src/app/api/` | Backend |
| Database, sesi login, Gemini, manajemen stok, menu, akun | `src/backend/` | Backend |
| Fungsi bersama yang aman dipakai browser | `src/shared/` | Frontend & Backend |
| Skema, seed, pengujian | `prisma/`, `tests/` | Backend & QA |

> **Penting:** File `src/app/.../page.tsx` tetap ada sebagai entry point tipis yang meneruskan komponen dari `src/frontend/pages/`. File `src/app/api/.../route.ts` tidak dipindah menjadi `src/backend` karena Next.js menentukan route HTTP berdasarkan lokasinya. File route menjadi penghubung tipis ke modul `src/backend`.

## Aturan import

- Komponen frontend boleh import dari `src/frontend` dan `src/shared`.
- Komponen frontend **tidak** boleh mengimpor modul runtime dari `src/backend` (karena berisi Prisma, `process.env`, akses server, dan kredensial).
- Modul backend boleh import dari `src/shared`, tetapi tidak bergantung pada komponen frontend.
- `src/app/page.tsx` adalah Server Component yang boleh memanggil `getPublicMenuCatalog()` dari backend untuk memberi props serializable ke `PublicHome`.
- `src/shared/types/public-menu.ts` menjadi kontrak data antara katalog backend dan kartu pelanggan frontend.
- Gunakan alias `@/` yang sudah tersedia di `tsconfig.json`.

## Contoh alur

**Katalog pelanggan**: `src/app/page.tsx` → `src/backend/public/menu-catalog.ts` → Prisma → props `PublicHome` dari `src/frontend/components/public/`.

**Transaksi stok**: `src/app/(dashboard)/stock/new/page.tsx` → `src/app/api/stock/transactions/route.ts` → `src/backend/inventory/stock-service.ts` → Prisma.

**Gemini**: `src/app/api/public/assistant/route.ts` → `src/backend/assistant/gemini-menu-service.ts` → API Gemini + data menu PostgreSQL. Rule-based tetap berada di `src/backend/assistant/menu-ai-service.ts`.

**Pesan WhatsApp**: `src/frontend/components/public/PublicHome.tsx` → `src/shared/whatsapp-order.ts` → tautan `wa.me`. Endpoint `src/app/api/whatsapp/webhook/route.ts` merupakan adapter Meta yang terpisah; tidak diperlukan untuk click-to-chat.

## Riwayat dan cara menerapkan

Ini hasil pemisahan kode **berdasarkan versi source yang diunggah**. Riwayat commit dari GitHub tidak disertakan dalam file ZIP; karena itu perubahan ini tidak mengklaim tanggal pekerjaan sebelumnya.

1. Backup folder dan database Naysin2.
2. Ekstrak ZIP refactor ke **folder baru** dahulu, bukan langsung menimpa folder aktif.
3. Salin `.env` pribadi Anda ke folder baru secara lokal (jangan commit ke GitHub).
4. Jalankan `npm.cmd install --legacy-peer-deps`, `npx.cmd prisma generate`, `npm.cmd run check:structure`, `npx.cmd tsc --noEmit`, `npx.cmd vitest run`.
5. Jalankan `npm.cmd run dev -- --port 3001`, lalu uji login Owner/Staff, CRUD bahan dan menu, foto, stok, Gemini, katalog publik, dan WhatsApp link.
6. Commit sebagai *refactor*, misalnya `refactor: reorganize frontend backend shared modules`.

**Tidak perlu** `prisma db push` atau reset demo seed karena skema database tidak diubah.
