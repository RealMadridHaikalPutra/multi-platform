# Multi-Marketplace Sync Backend

Backend Fastify (Node.js) dengan arsitektur modular + clean architecture untuk sinkronisasi stok terpusat lintas marketplace (Shopee Open Platform dan TikTok Shop Partner API).

## Tujuan Utama

- Sinkronisasi stok dan pesanan terpusat secara near real-time.
- Webhook sebagai sumber data utama, polling terjadwal sebagai fallback.
- Semua update stok/pesanan diproses asynchronous via BullMQ, aman terhadap race condition per SKU.
- Observability siap untuk penelitian: latency sinkronisasi, error rate, dan konsistensi data antar platform.

## Arsitektur

Struktur modul:

- `src/modules/product`: CRUD data master produk.
- `src/modules/inventory`: baca data stok + endpoint update stok asynchronous.
- `src/modules/order`: baca data pesanan + endpoint upsert pesanan asynchronous.
- `src/modules/webhook`: endpoint webhook Shopee/TikTok + validasi payload Zod + verifikasi signature.
- `src/modules/queue`: BullMQ queue service dan worker processor.
- `src/modules/sync`: polling fallback, pencatatan event sinkronisasi, consistency check.
- `src/modules/ws`: WebSocket gateway (`@fastify/websocket`) untuk update real-time ke frontend.
- `src/modules/observability`: endpoint metrik untuk black-box/performance testing.

Layer clean architecture:

- Controller: parsing request/response + validasi payload.
- Service: business flow dan orkestrasi lintas modul.
- Repository: akses database Drizzle ORM.
- Infrastructure: PostgreSQL, Redis, external API client (axios + retry/rate-limit handling).

## Sinkronisasi Hybrid

1. Webhook (primary source)

- `POST /api/webhooks/shopee`
- `POST /api/webhooks/tiktok`

Flow:

- Payload divalidasi dengan Zod.
- Signature divalidasi (HMAC SHA-256).
- Event disimpan ke tabel `sync_events`.
- Event di-enqueue ke BullMQ.

2. Polling fallback (setiap 5 menit)

- Scheduler via fastify-schedule/@fastify/schedule + toad-scheduler interval 5 menit.
- Enqueue job `POLL_MARKETPLACE` untuk Shopee dan TikTok.
- Worker memanggil API eksternal untuk menarik event yang terlewat.

## Konsistensi dan Concurrency Control

- Queue job key per SKU: `sku:<sku>:<event-type>:<event-id>`.
- Worker concurrency tinggi, tetapi eksekusi per SKU diserialkan dengan Redis distributed lock.
- Saat update stok di DB, repository menjalankan transaksi ACID + `pg_advisory_xact_lock(hashtext(sku))`.

## REST API Utama

- Produk:
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

- Inventory:
- `GET /api/inventory`
- `GET /api/inventory/:sku`
- `PUT /api/inventory/:sku` (enqueue stock set)
- `PATCH /api/inventory/:sku/adjust` (enqueue stock adjust)
- `DELETE /api/inventory/:sku`

- Order:
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders` (enqueue upsert)
- `PUT /api/orders/external/:externalOrderId` (enqueue upsert)
- `DELETE /api/orders/:id`

- Sync:
- `POST /api/sync/poll/trigger`
- `GET /api/sync/events/unprocessed`

- Observability:
- `GET /api/observability/health`
- `GET /api/observability/metrics`
- `GET /api/observability/latency`
- `GET /api/observability/consistency`
- `POST /api/observability/benchmark/sync`

- WebSocket:
- `GET /ws`

## Metrik Penelitian

Endpoint observability menyediakan metrik berikut:

- `errorRate`: rasio job gagal terhadap total job sinkronisasi.
- `avgLatencyMs` dan `p95LatencyMs`: rerata dan p95 latency processing job.
- `consistencyMismatchRate`: mismatch data pusat vs marketplace.
- Snapshot queue (waiting/active/completed/failed/delayed).

## Menjalankan Proyek

1. Salin `.env.example` menjadi `.env` dan isi kredensial.
2. Jalankan PostgreSQL dan Redis.
3. Install dependency (`npm install`) pada environment yang memiliki Node.js.
4. Jalankan migrasi schema Drizzle (`npm run drizzle:generate` lalu `npm run drizzle:migrate`).
5. Jalankan server (`npm run dev`).

Dokumentasi API tersedia di `/docs`.

## Mode Dummy (Tanpa DB/Redis)

Jika ingin mencoba frontend tanpa setup database dan Redis, aktifkan mode dummy.

1. Salin `.env.example` menjadi `.env`.
2. Set `USE_DUMMY_DATA=true`.
3. Jalankan server (`npm run dev`).

Endpoint produk, inventory, order, dan observability akan memakai data JSON dummy yang bisa dimodifikasi via API.

## Pengujian

- Black-box:
- `npm run test:blackbox` (server harus berjalan di `TARGET_URL`, default `http://127.0.0.1:3000`).

- Performance:
- `npm run test:perf` untuk menjalankan load test `autocannon`.

## Batasan Scope

- Tidak mencakup pembayaran.
- Tidak mencakup pengiriman.
- Tidak mencakup fitur AI.
