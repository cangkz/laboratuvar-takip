# Protez Takip

Klinik, kurye ve diş protez laboratuvarı arasındaki iş akışını QR kod ve durum zaman çizelgesiyle takip eden operasyon uygulaması.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/protez-takip/src/App.tsx` — Türkçe web uygulaması, yönlendirme ve ana ekranlar
- `artifacts/protez-takip/src/index.css` — uygulama tema tokenları ve ortak arayüz stilleri
- `artifacts/api-server/src/routes/prosthesis.ts` — klinik, doktor, iş, QR ve dashboard API route'ları
- `lib/api-spec/openapi.yaml` — API sözleşmesinin tek kaynağı
- `lib/db/src/schema/prosthesis.ts` — PostgreSQL tablo ve insert şemaları

## Architecture decisions

- İş durumları klinikten teslim alma, kurye, laboratuvara kabul, üretim, kalite kontrol ve kliniğe teslim adımlarını aynı durum zaman çizgisinde taşır.
- QR kodun kendisi işin benzersiz `qrCode` değerinden üretilir; tarama ekranı kamera okuyucusu veya manuel kod girişiyle aynı `/jobs/qr/:qrCode` endpoint'ini kullanır.
- Frontend, OpenAPI'den üretilen React Query hook'larını kullanır; durum değişikliklerinden sonra iş, timeline ve dashboard sorguları invalidation ile yenilenir.

## Product

- Operasyon dashboard'u: aktif işler, bugünkü teslimler, alım bekleyenler ve teslime hazır vakalar.
- İş oluşturma: klinik/doktor, hasta referansı, protez türü, renk, öncelik, teslim tarihi ve not.
- QR kimliği: iş oluşturulduğunda benzersiz QR üretilir, iş detayında gösterilir, kamera ile okutularak işe gidilir.
- Klinik ve doktor dizini: klinik bazında doktorlar ve o kliniğin iş listesi.
- İş detayı: klinik, doktor, protetik bilgiler ve sorumluluk zaman çizgisi; bir sonraki duruma ilerletme.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
