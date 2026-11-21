Perbaikan konfigurasi Vitest alias @/ untuk Naysin2

1. Salin vitest.config.ts ke root proyek Naysin2, sejajar dengan package.json dan tsconfig.json.
2. Jalankan di root proyek:
   npx.cmd vitest run tests/unit/username-generation.test.ts tests/unit/menu-ai-service.test.ts
   npx.cmd vitest run
   npx.cmd tsc --noEmit
3. Tidak perlu mengubah database, menjalankan seed, atau mengubah kode frontend/backend.

Alasan: alias @/* pada tsconfig.json dibaca oleh TypeScript/Next.js, tetapi Vitest perlu alias resolusi tersendiri.
