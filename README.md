# Service RBAC

Mengelola autentikasi, pengguna, role, menu, dan hak akses menu. Menerbitkan JWT RS256.

Bagian dari **Aplikasi Pendaftaran Beasiswa Pelatihan**. Sesuai persyaratan dokumen,
service ini adalah **repo Git tersendiri**, bukan bagian dari satu monorepo.

| | |
|---|---|
| Stack | Node 20 + TypeScript + Express + Prisma + Zod |
| Port internal | `3001` |
| Database | MySQL `db_rbac` |
| Health check | `GET /health` |

## Menjalankan secara lokal

```bash
cp .env.example .env      # lalu isi nilainya
npm install
npm run prisma:generate
npm run dev               # http://localhost:3001/health
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan dengan hot reload (tsx watch) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build |
| `npm run typecheck` | `tsc --noEmit`, wajib bersih sebelum lapor selesai |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run prisma:migrate` | Buat & terapkan migration (development) |
| `npm run seed` | Jalankan seed |

## Struktur

```
src/
├── config/       env loader ter-validasi Zod, koneksi Prisma
├── modules/      <fitur>/{controller,service,repository,schema}.ts
├── middlewares/  auth, error-handler, request-id, validate
├── routes/
├── utils/        logger JSON, envelope response, error domain
├── app.ts
└── server.ts
prisma/schema.prisma
prisma/seed.ts
```

## Aturan yang mengikat service ini

- **Envelope response seragam**: `{ success, data, message, errors }` di semua endpoint.
- **Semua query lewat Prisma.** Dilarang string concatenation dan `$queryRawUnsafe`.
- **Tidak pernah mem-publish port ke host.** Service ini hanya `expose` di network
  `internal`; satu-satunya pintu masuk dari luar adalah API Gateway. Identitas user
  dipercaya dari header `X-User-Id` / `X-User-Role` yang dikirim Gateway — model ini
  hanya aman selama service tidak bisa dihubungi langsung dari luar.
- **Error response tidak pernah memuat stack trace** atau versi framework.
- Secrets hanya lewat environment variable. `.env` tidak pernah di-commit.

## Catatan khusus

- **Private key JWT hanya ada di service ini** (ADR-005). API Gateway hanya memegang
  public key sehingga bisa memverifikasi token, tapi tidak bisa menerbitkannya.
- **Role tidak pernah diambil dari input pengguna.** Dropdown "Masuk Sebagai" pada
  mockup login internal murni kosmetik; role selalu dibaca dari kolom `users.role_id`.
- Password memakai **argon2id**, tidak pernah plaintext, tidak pernah MD5/SHA1.
- Refresh token disimpan **hashed** dan dirotasi setiap kali dipakai.
