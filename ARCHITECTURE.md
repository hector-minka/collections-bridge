# Collections Bridge — Architecture Document

This document describes the technical architecture of the **Minka Collections Bridge**: how it is built, how data flows, what actions it performs, and how to integrate with it. It is intended for developers who need to understand, maintain, or extend the service.

---

## 1. Overview and Purpose

The Collections Bridge is a **standalone NestJS service** that sits between:

- **Payments Hub (Minka Ledger)** — where payment artifacts (anchors) and payment-collection intents live.
- **RTP (Real-Time Payment) network** — which notifies the bridge when a payment has been fulfilled (e.g. committed).

**Responsibilities:**

1. **Intent generation (anchor-created flow):** When the Ledger sends an `anchor_created` event, the bridge ensures a **payment-collection intent** exists on the Ledger (one per `merchantCode:paymentReferenceNumber`), links the new anchor to that intent via labels, and persists a **collection** record locally.
2. **Fulfillment (RTP / intent-updated flow):** When the RTP network sends an `intent-updated` event with status `committed`, the bridge finds the matching intent on the Ledger, submits a **committed proof**, updates all related anchors (COMPLETED / CANCELLED), and marks the collection as **COMPLETED** in the database.

The bridge **does not** expose the Ledger’s full API; it implements a small set of webhooks and read-only/query endpoints for collections.

---

## 2. Technology Stack

| Layer        | Technology |
|-------------|------------|
| Runtime     | Node.js 20 |
| Language    | TypeScript 5.x |
| Framework   | NestJS 10 |
| API         | REST, Express |
| Ledger client | `@minka/ledger-sdk` 2.28.x, `@minka/types` 2.28.x |
| Database    | PostgreSQL 15 (TypeORM 0.3.x) |
| Logging     | Pino + nestjs-pino |
| Validation  | class-validator, class-transformer |
| Docs        | Swagger/OpenAPI (@nestjs/swagger) |
| Health      | @nestjs/terminus |
| Security    | Helmet, CORS, Throttler (rate limit) |

The bridge uses a **single Ledger** (configured via `MINKA_LEDGER_SERVER` and `MINKA_LEDGER_NAME`), both for creating/reading intents and for reading/updating anchors (e.g. payment-initiation-demo).

---

## 3. High-Level Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                   Collections Bridge                      │
                    │  ┌─────────────────┐    ┌─────────────────────────────┐ │
                    │  │ Collections     │    │ LedgerService               │ │
                    │  │ Controller      │───▶│ (Minka Ledger SDK)          │ │
                    │  │ (REST +         │    │ - getAnchor, getIntent       │ │
                    │  │  webhooks)      │    │ - createIntent, submitProof  │ │
                    │  └────────┬────────┘    │ - addProofToAnchor, etc.     │ │
                    │           │              └──────────────┬──────────────┘ │
                    │           ▼                             │                │
                    │  ┌─────────────────┐                    │                │
                    │  │ Collections     │────────────────────┘                │
                    │  │ Service         │                                      │
                    │  │ (business logic)│───────▶ PostgreSQL (collections)     │
                    │  └─────────────────┘                                      │
                    └─────────────────────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
         ▼                               ▼                               ▼
  Payments Hub                   RTP / Servibanca                 Clients (optional)
  POST /webhooks/                 POST /webhooks/                  GET /merchant-txid/:id
  anchor-created                  rtp-fulfillment                  GET /anchor/:handle
  (anchor_created event)          (intent-updated,                 GET /intent/:handle
                                   status=committed)                GET /?status=...
```

- **Inbound:** Webhooks from Payments Hub and RTP; optional GETs from clients.
- **Outbound:** All Ledger interaction (intents, anchors, proofs) and local PostgreSQL writes.

---

## 4. Component Overview

### 4.1 CollectionsController (`src/collections/collections.controller.ts`)

- **Base path:** `api/v1/collections` (versioned).
- **Webhooks:** Return **200 immediately** and process the payload **asynchronously** so the caller (Ledger/RTP) does not retry on slow processing.
- **Query endpoints:** Synchronous; return collection(s) or 404.

### 4.2 CollectionsService (`src/collections/services/collections.service.ts`)

- Orchestrates **anchor-created** and **intent-updated** flows.
- Uses **LedgerService** for all Ledger calls and **TypeORM repository** for the `collections` table.
- Enforces **idempotency** (e.g. intent proof, anchor proofs) and uses a **per-intent lock** when updating anchor statuses to avoid duplicate proofs under parallel webhook calls.

### 4.3 LedgerService (`src/collections/services/ledger.service.ts`)

- Wraps **Minka Ledger SDK**: single configured ledger, JWT auth with signer keys.
- Exposes: anchor read/search, intent read/create, proof submission, anchor proof (COMPLETED/CANCELLED), label handling, idempotency helpers.

### 4.4 CollectionEntity (`src/collections/entities/collection.entity.ts`)

- **Table:** `collections`.
- **Fields:** id, merchantTxId, anchorHandle, intentHandle, schema, status, anchorData (JSONB), intentData (JSONB), fulfillmentEvidence (JSONB), fulfilledAt, createdAt, updatedAt.
- **Indexes:** merchantTxId, anchorHandle, intentHandle.

### 4.5 Configuration (`src/config/configuration.ts`)

- Loaded by `ConfigModule`; values from `process.env` (see §6).

---

## 5. Data Model: Collection

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| id                   | uuid      | Primary key (auto). |
| merchantTxId         | varchar   | Business key; from anchor metadata or `merchantCode:paymentReferenceNumber`. |
| anchorHandle         | varchar   | Ledger anchor handle (e.g. QR-xxx, @MERCHxxx). |
| intentHandle         | varchar   | Ledger intent handle (e.g. 0076570881:FACT-2024-001246). |
| schema               | varchar   | `qr-code` or `dynamic-key`. |
| status               | varchar   | `PENDING`, `COMPLETED`, `CANCELLED`. |
| anchorData           | jsonb     | Snapshot of anchor from webhook. |
| intentData           | jsonb     | Snapshot of intent from Ledger. |
| fulfillmentEvidence  | jsonb     | Proof detail and metadata when status becomes COMPLETED. |
| fulfilledAt          | timestamp | When the collection was marked COMPLETED. |
| createdAt / updatedAt| timestamp | Auditing. |

---

## 6. Configuration (Environment)

| Variable | Purpose |
|----------|---------|
| PORT | HTTP port (default 3000). |
| NODE_ENV | development / production. |
| CORS_ORIGIN | Allowed origin(s) for CORS. |
| LOG_LEVEL | Pino level (e.g. info, debug). |
| DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME | PostgreSQL connection. |
| DB_SYNCHRONIZE | If `true`, TypeORM creates/updates tables (dev only; use false in prod). |
| DB_LOGGING | SQL logging (true/false). |
| MINKA_LEDGER_SERVER | Ledger API base URL (e.g. https://ldg-stg.one/api/v2). |
| MINKA_LEDGER_NAME | Ledger identifier. |
| MINKA_LEDGER_TIMEOUT | Request timeout (ms). |
| MINKA_LEDGER_PUBLIC_KEY | Ledger public key (base64). |
| MINKA_SIGNER_FORMAT | Key format (e.g. ed25519-raw). |
| MINKA_SIGNER_PUBLIC | Bridge signer public key (base64). |
| MINKA_SIGNER_SECRET | Bridge signer secret key (base64); must be kept secret. |
| INTENT_CLAIM_SOURCE_HANDLE | Claim source handle for intents (e.g. servibanca); must exist on Ledger. |

---

## 7. Flow 1: Anchor-Created (Intent Generation)

**Trigger:** Payments Hub sends `POST /api/v1/collections/webhooks/anchor-created` with an **anchor_created** event (body contains `data.anchor` with full anchor payload).

**Response:** Controller returns `200 { received: true, signal: 'anchor-created' }` immediately and processes in the background.

### 7.1 Steps (CollectionsService.handleAnchorCreated)

1. **Validate and extract**
   - Require `event.data.anchor` and `event.data.anchor.data.handle`.
   - Read anchor from `event.data.anchor` (no extra Ledger read).

2. **Derive intent handle and merchantTxId**
   - **Intent handle** = `merchantCode:paymentReferenceNumber`.
   - **merchantCode:**
     - **dynamic-key / dynamic-keys:** from `anchor.data.custom.merchantCode`.
     - **qr-code:** from `anchor.data.target.custom.merchantCode` or `target.merchantCode` (or target if string).
   - **paymentReferenceNumber:** from `anchor.data.custom.paymentReferenceNumber`.
   - **merchantTxId:** from `anchor.data.custom.metadata.merchantTxId` or fallback to intent handle.

3. **Schema**
   - From `anchor.data.schema` (e.g. qr-code, dynamic-key).

4. **Claim target**
   - From `anchor.data.target` (string handle or `target.handle`) for the intent claim.

5. **Symbol and amount**
   - From `anchor.data.symbol` and `anchor.data.amount` (required for intent creation).

6. **Local collection (idempotent by merchantTxId)**
   - Find collection by `merchantTxId`.
   - If none: create with merchantTxId, anchorHandle, schema, status PENDING, anchorData.
   - If exists: update anchorHandle, anchorData, and optionally schema.

7. **Intent on Ledger (idempotent by intent handle)**
   - Try `getIntent(intentHandleFromAnchor)`.
   - **If intent exists:** call `addAnchorLabelToIntent(intentHandleFromAnchor, anchorHandle, schema)` so the new anchor is in the intent’s labels (format `anchorHandle:schema`).
   - **If not:** call `createIntent(...)` with handle, anchorHandle, schema, claimTargetHandle, symbolHandle, amount, merchantTxId. On conflict/409, fall back to adding the anchor label as above.

8. **Persist intent on collection**
   - Set `collection.intentHandle` and `collection.intentData` from the intent response and save.

### 7.2 Ledger Actions in This Flow

- `getIntent(handle)` — read intent by handle.
- `createIntent({ handle, anchorHandle, anchorSchema, claimTargetHandle, symbolHandle, amount, merchantTxId })` — create payment-collection intent with one claim (transfer from INTENT_CLAIM_SOURCE_HANDLE to claimTargetHandle), access for bridge signer, and label `anchorHandle:schema`.
- `addAnchorLabelToIntent(intentHandle, anchorHandle, anchorSchema)` — add proof with `custom.labels.$addToSet = "anchorHandle:schema"`.

---

## 8. Flow 2: RTP Fulfillment (Intent-Updated, status = committed)

**Trigger:** RTP (or Ledger proxy) sends `POST /api/v1/collections/webhooks/rtp-fulfillment` with an **intent-updated** event: `data.signal`, `data.intent.data`, `data.intent.meta` (e.g. status).

**Response:** Controller returns `200 { success: true }` immediately and processes via `setImmediate` (async).

### 8.1 Steps (CollectionsService.processIntentUpdatedEventAsync)

1. **Parse and filter**
   - Read `data.intent.data`, `data.intent.meta`, `data.signal`.
   - **Only continue if `data.intent.meta.status === 'committed'`**; otherwise log and return.

2. **Resolve anchor from claim**
   - Take first claim: `claims[0].target`.
   - **idQR** = `target.custom.idQR` or `target.custom.idQr`.
   - **aliasValue** = `target.custom.aliasValue`.
   - Require at least one of idQR or aliasValue.

3. **Find anchor on Ledger**
   - `findAnchorByIdQROrAliasValue(idQR, aliasValue)`:
     - If **idQR:** direct HTTP GET to Ledger `/anchors?data.custom.paymentId=...` with header `x-schema: qr-code` (QR anchors store paymentId).
     - If **aliasValue only:** treat as **anchor handle** (dynamic-key) and call `sdk.anchor.read(aliasValue)`.

4. **Resolve merchantCode and paymentReferenceNumber**
   - From anchor: same rule as anchor-created (dynamic-key → `data.custom.merchantCode`; else target’s merchantCode).
   - paymentReferenceNumber from `anchor.data.custom.paymentReferenceNumber`.

5. **Find intent on Ledger**
   - `getIntentByMerchantCodeAndPaymentReference(merchantCode, paymentReferenceNumber)` → `getIntent(merchantCode:paymentReferenceNumber)`.

6. **Submit committed proof (idempotent)**
   - If `intentHasCommittedProofFromUs(intentHandleOnDemoLedger)` is true, skip.
   - Else `submitProof(intentHandleOnDemoLedger, proofDetail)` where proofDetail = { rtpIntentHandle, rtpStatus: 'committed', fulfilledAt, anchorHandle }.
   - Proof custom includes `status: 'committed'`, `detail` (JSON string of proofDetail), and `coreId` = rtpIntentHandle (Payments Hub reports).

7. **Update anchors (serialized per intent, idempotent)**
   - Acquire **per-intent lock** (so parallel webhooks for the same intent do not double-submit proofs).
   - `getIntent(intentHandleOnDemoLedger)` then `getAnchorHandlesFromIntentLabels(intentRecord)` (parse labels like `anchorHandle:schema`, skip `merchant-txid:...`).
   - For each anchor handle:
     - If handle === **completing anchor** (the one that fulfilled): if not already our COMPLETED proof, `addProofToAnchor(handle, { status: 'COMPLETED', reason: 'completed', paymentReference: intentHandleOnDemoLedger })`.
     - Else: if not already our CANCELLED proof, `addProofToAnchor(handle, { status: 'CANCELLED', reason: 'completed by <completingAnchorHandle>', paymentReference })`.
   - Release lock.

8. **Update collection**
   - Find collection by intentHandle or by merchantTxId (from anchor custom or intent handle).
   - Set status = COMPLETED, fulfillmentEvidence = proofDetail, fulfilledAt = now; save.

### 8.2 Ledger Actions in This Flow

- `findAnchorByIdQROrAliasValue(idQR, aliasValue)` — direct GET by paymentId (QR) or `anchor.read(aliasValue)` (dynamic-key).
- `getIntent(handle)` — read intent.
- `getIntentByMerchantCodeAndPaymentReference(merchantCode, paymentReferenceNumber)` — same as getIntent(merchantCode:paymentReferenceNumber).
- `intentHasCommittedProofFromUs(intentHandle)` — read intent, check meta.proofs for our signer and status committed.
- `submitProof(intentHandle, detail)` — intent.from(record).hash().sign({ custom: { moment, status: 'committed', detail: JSON.stringify(detail), coreId } }).send().
- `getAnchorHandlesFromIntentLabels(intentRecord)` — parse meta.labels (anchorHandle:schema).
- `anchorHasProofFromUs(anchorHandle, 'COMPLETED'|'CANCELLED')` — read anchor, check proofs for our signer and given status.
- `addProofToAnchor(anchorHandle, custom)` — anchor.from(record).hash().sign({ custom }).send() (proof only; no data change).

---

## 9. LedgerService: Method Reference

| Method | Purpose |
|--------|---------|
| getAnchor(handle) | Read anchor by handle (SDK anchor.read). |
| getAnchorByLabel(key, value) | List anchors by meta.labels. |
| findAnchorByPaymentIdDirectRequest(paymentId) | GET /anchors with data.custom.paymentId and x-schema: qr-code. |
| findAnchorByIdQROrAliasValue(idQR?, aliasValue?) | Resolve anchor: by paymentId (QR) or by handle (aliasValue = dynamic-key handle). |
| getIntent(handle) | Read intent by handle (SDK intent.read). |
| getIntentByMerchantCodeAndPaymentReference(merchantCode, paymentRef) | getIntent(merchantCode:paymentRef). |
| getIntentByMerchantTxId(merchantTxId) | List intents by label merchant-txid:..., then filter by custom.merchantTxId. |
| createIntent(data) | Create payment-collection intent (handle, claims, access, label anchorHandle:schema). |
| addAnchorLabelToIntent(intentHandle, anchorHandle, anchorSchema) | Add proof with labels.$addToSet = "anchorHandle:schema". |
| updateAnchor(handle, { custom?, labels? }) | Merge custom/labels and send update (data + meta) with new proof. |
| intentHasCommittedProofFromUs(intentHandle) | True if intent has a proof from our signer with custom.status === 'committed'. |
| submitProof(intentHandle, detail) | Add proof to intent with status committed, detail (JSON string), coreId (RTP intent handle). |
| getAnchorHandlesFromIntentLabels(intentRecord) | Parse meta.labels to list anchor handles (skip merchant-txid). |
| anchorHasProofFromUs(anchorHandle, status) | True if anchor has our proof with custom.status === status (COMPLETED/CANCELLED). |
| addProofToAnchor(anchorHandle, custom) | Add proof to anchor (custom: moment, status, reason, paymentReference). |

---

## 10. REST API Endpoints

Base path: **`/api/v1`**. All collection routes are under **`/api/v1/collections`**.

### 10.1 Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | /collections/webhooks/anchor-created | Accepts anchor_created event from Payments Hub. Returns 200 immediately; processing is async. Body: AnchorCreatedEventDto (data.anchor required). |
| POST | /collections/webhooks/rtp-fulfillment | Accepts intent-updated event (e.g. from RTP). Returns 200 immediately; processing is async. Body: intent payload with data.intent.data and data.intent.meta.status. |

### 10.2 Query

| Method | Path | Description |
|--------|------|-------------|
| GET | /collections/merchant-txid/:merchantTxId | Get one collection by merchant transaction ID. 404 if not found. |
| GET | /collections/anchor/:anchorHandle | Get one collection by anchor handle. 404 if not found. |
| GET | /collections/intent/:intentHandle | Get one collection by intent handle. 404 if not found. |
| GET | /collections | List collections. Optional query: status, merchantTxId. Ordered by createdAt DESC. |

### 10.3 Health (for orchestration / Kubernetes)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Full health check (heap, RSS, disk). |
| GET | /health/liveness | Liveness probe. |
| GET | /health/readiness | Readiness probe. |

Swagger UI: **`/api/docs`** (when running).

---

## 11. Idempotency and Concurrency

- **Anchor-created:** Idempotent by merchantTxId (one collection) and by intent handle (create intent once or add label).
- **Intent proof:** Before submitting committed proof, bridge checks `intentHasCommittedProofFromUs`; if already present, proof is not sent again.
- **Anchor proofs:** Before adding COMPLETED or CANCELLED, bridge checks `anchorHasProofFromUs(handle, status)`; each anchor gets at most one such proof from the bridge.
- **Parallel webhooks:** A **per-intent-handle lock** serializes the block that updates anchor statuses (COMPLETED/CANCELLED) so that concurrent requests for the same intent do not submit duplicate proofs; the second request waits and then sees existing proofs and skips.

---

## 12. Security and Middleware

- **Helmet:** Enabled (CSP relaxed for Swagger).
- **CORS:** Configurable via CORS_ORIGIN.
- **Throttler:** 100 requests per minute per IP (configurable).
- **Ledger:** All Ledger requests use JWT signed with the bridge signer (ed25519-raw); signer identity and ledger audience are set in SDK options.
- **Validation:** class-validator on webhook DTOs; body parser limit 50MB.

---

## 13. Database and Migrations

- **PostgreSQL:** One table, `collections` (see §5).
- **TypeORM:** Entities and repository; migrations run at startup when `migrationsRun: true` (see app.module).
- **Migration:** `CreateCollectionsTable1736698762000` creates `collections` and indexes; recorded in default `migrations` table so it runs only once per database.

---

## 14. Deployment (Outline)

- **Docker:** Dockerfile multi-stage (builder + production); Yarn for install/build; production stage runs `node dist/src/main.js`.
- **Compose:** postgres + app; app env includes PORT, DB_*, MINKA_*; healthcheck hits `http://localhost:${PORT}/api/v1/health`.
- **Init script:** Optional `scripts/create-tables.sql` for Postgres (e.g. uuid-ossp + CREATE TABLE IF NOT EXISTS) for fresh volumes; app still runs migrations on startup so tables exist even if init did not run.

---

## 15. Summary of Actions the Bridge Performs

| Action | When | Ledger | DB |
|--------|------|--------|-----|
| Create or update collection | anchor-created | — | Insert or update by merchantTxId |
| Get intent by handle | anchor-created, rtp-fulfillment | GET intent | — |
| Create intent | anchor-created (if no intent) | POST intent (payment-collection) | — |
| Add anchor label to intent | anchor-created (intent exists or duplicate create) | POST proof (labels $addToSet) | — |
| Find anchor by idQR or aliasValue | rtp-fulfillment | GET anchors by paymentId or anchor.read(handle) | — |
| Submit committed proof to intent | rtp-fulfillment (if not already our proof) | POST proof (committed, detail, coreId) | — |
| Add COMPLETED proof to anchor | rtp-fulfillment (completing anchor) | POST proof on anchor | — |
| Add CANCELLED proof to anchors | rtp-fulfillment (other anchors in intent labels) | POST proof on each anchor | — |
| Update collection to COMPLETED | rtp-fulfillment | — | Update status, fulfillmentEvidence, fulfilledAt |

This document reflects the codebase as of the last update; for exact request/response shapes and examples, see the Swagger UI and the DTOs in `src/collections/dto/`.
