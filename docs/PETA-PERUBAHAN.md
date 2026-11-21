# Peta Pemindahan File (Refactor Naysin2)

Perubahan ini tidak menambah, menghapus, atau mengubah kolom tabel database. Isi fungsi bisnis dipertahankan; sebagian besar penyesuaian hanya pada path import dan penempatan modul.

## Frontend

- `src/components/AppShell.tsx` → `src/frontend/components/AppShell.tsx`
- `src/components/public/PublicHome.tsx` → `src/frontend/components/public/PublicHome.tsx`
- Komponen halaman yang dahulu ditulis langsung di `src/app/(dashboard)/**/page.tsx`, `src/app/(auth)/login/page.tsx`, dan `src/app/assistant/page.tsx` kini berada di `src/frontend/pages/`; file `page.tsx` tetap ada sebagai entry routing Next.js.

## Backend

- `src/features/assistant/` → `src/backend/assistant/`
- `src/features/menus/` → `src/backend/menus/`
- `src/features/users/` → `src/backend/users/`
- `src/features/whatsapp/` → `src/backend/whatsapp/`
- `src/features/public/{assistant-quota,menu-catalog}.ts` → `src/backend/public/`
- `src/features/inventory/{alert-service,ingredient-csv,stock-service}.ts` → `src/backend/inventory/`
- `src/app/api/ingredients/[id]/delete-helpers.ts` → `src/backend/inventory/ingredient-delete-helpers.ts`
- `src/lib/auth.ts`, `src/lib/db.ts` → `src/backend/auth.ts`, `src/backend/db.ts`

## Shared

- `src/features/inventory/{stock-dates,stock-units}.ts` → `src/shared/inventory/`
- `src/features/public/whatsapp-order.ts` → `src/shared/whatsapp-order.ts`
- Tipe respons katalog publik dipindah ke `src/shared/types/public-menu.ts` sehingga komponen browser tidak tergantung pada berkas backend database.

## Verifikasi

Pemeriksaan otomatis tanpa dependensi: `npm.cmd run check:structure`.
Pemeriksaan lengkap sesudah install: `npx.cmd tsc --noEmit` dan `npx.cmd vitest run`.

Jangan menyalin isi ZIP ke folder lama tanpa menghapus file lama yang sudah dipindahkan, karena file duplikat bisa tetap terbaca oleh TypeScript. Lebih aman menguji di direktori baru yang terpisah dan memindahkan perubahan melalui branch Git setelah validasi.
