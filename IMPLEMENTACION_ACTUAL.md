# Collections Bridge — Estado actual de la implementación

Este documento describe qué está implementado hoy en el **Collections Bridge** (Payment Collections).

---

## 1. Propósito del bridge

El bridge orquesta la solución **Payment Collections** sobre Minka Payments Hub (Ledger v2):

- **Flow 2**: cuando se crea un anchor de artefacto (QR/dynamic key), el bridge crea o reutiliza un intent y vincula el anchor a ese intent.
- **Flow 3**: cuando la red RTP notifica que un pago se cumplió, el bridge envía un proof al ledger para completar el intent y actualiza la collection local.

El bridge **no** crea anchors ni expone APIs para que el merchant cree artefactos; eso lo hace el Payments Hub. El bridge solo reacciona a eventos y webhooks.

---

## 2. Infraestructura y configuración

| Componente | Estado | Descripción |
|------------|--------|-------------|
| **NestJS 10** | ✅ | App base, inyección de dependencias, módulos. |
| **TypeORM + PostgreSQL** | ✅ | Conexión, entidad `collections`, migración de tabla. |
| **Configuración** | ✅ | `src/config/configuration.ts` y variables de entorno (ledger, signer, DB). |
| **Seguridad** | ✅ | Helmet, CORS, rate limiting (Throttler), validación con class-validator. |
| **Logging** | ✅ | Pino (nestjs-pino), logs estructurados. |
| **Errores** | ✅ | Filtro global que devuelve errores en formato Minka Ledger (`reason`, `detail`, `custom`). |
| **Health** | ✅ | `/api/v1/health`, liveness, readiness. |
| **Swagger** | ✅ | Documentación OpenAPI en `/api/docs`. |
| **Crypto-utils** | ✅ | Hash, firma Ed25519, JWT para autenticación con el ledger. |

---

## 3. Modelo de datos (base de datos)

**Tabla**: `collections`

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | UUID | PK. |
| `merchantTxId` | string | Identificador de transacción del merchant (o fallback: anchor handle). Indexado. |
| `anchorHandle` | string | Handle del anchor en el ledger. |
| `intentHandle` | string | Handle del intent en el ledger. |
| `schema` | string | Tipo de artefacto: `qr-code` o `dynamic-key`. |
| `status` | string | `PENDING`, `COMPLETED`, `CANCELLED`. |
| `anchorData` | JSONB | Copia del objeto anchor (del webhook). |
| `intentData` | JSONB | Copia del objeto intent. |
| `fulfillmentEvidence` | JSONB | Evidencia del pago (RTP webhook). |
| `fulfilledAt` | timestamp | Cuándo se marcó como cumplido. |
| `createdAt`, `updatedAt` | timestamp | Auditoría. |

La base de datos actúa como **cache y trazabilidad local**; la fuente de verdad de anchors e intents es el ledger.

---

## 4. Integración con el Ledger (LedgerService)

Servicio que habla con **Minka Ledger SDK**:

| Método | Implementado | Uso |
|--------|--------------|-----|
| **getAnchor(handle)** | ✅ | Obtener anchor por handle (builder `init().handle().send()`). |
| **getAnchorByLabel(key, value)** | ✅ | Listar anchors por label (ej. `artifact-trxid`, `artifact-payload`). |
| **updateAnchor(handle, updates)** | ✅ | Actualizar anchor (custom metadata, labels); usado para agregar `intentHandle` y label `intent-handle:<handle>`. |
| **getIntentByMerchantTxId(merchantTxId)** | ✅ | Listar intents por label `merchant-txid:<id>` y filtrar por `custom.merchantTxId`. |
| **createIntent({ merchantTxId, custom? })** | ✅ | Crear intent (custom con `merchantTxId`); sin schema fijo por posibles restricciones del ledger. |
| **submitProof(intentHandle, evidence)** | ✅ | Enviar proof de cumplimiento al intent (firma + evidence). |
| **getIntent(handle)** | ✅ | Obtener intent por handle. |

Las firmas se generan con **crypto-utils** (Ed25519, digest, JWT donde aplica).

---

## 5. Flujo 1: No implementado en el bridge

- **Creación de anchors (POST /v2/anchors)** la hace el **Payments Hub** (o el merchant contra el Hub). El bridge no expone este endpoint ni crea anchors por su cuenta.

---

## 6. Flujo 2: Intent generation (anchor_created)

**Endpoint**: `POST /api/v1/collections/webhooks/anchor-created`

**Quién lo llama**: Payments Hub cuando se crea un anchor de artefacto (QR o dynamic key).

**Formato esperado del body**: El que envía el ledger (ej. `data.anchor.data.handle`, `data.signal`, etc.). El DTO está adaptado a esa estructura.

**Qué hace el bridge**:

1. Extrae del evento:
   - `anchorHandle` de `event.data.anchor.data.handle`.
   - Anchor completo de `event.data.anchor` (sin volver a hacer GET al ledger).
   - `merchantTxId` de `anchor.data.custom.metadata.merchantTxId`; si no viene, usa `anchorHandle` como identificador.
   - `schema` del anchor si existe.
2. **Collection local**:
   - Busca collection por `merchantTxId`.
   - Si no existe: crea una nueva (merchantTxId, anchorHandle, schema, status PENDING, anchorData).
   - Si existe: actualiza anchorHandle, anchorData y schema si faltaba.
3. **Intent en el ledger** (idempotente por merchantTxId):
   - Busca intent por `merchantTxId` (vía LedgerService).
   - Si no existe: crea un intent con `createIntent({ merchantTxId })`.
   - Si existe: reutiliza ese intent.
4. **Vincular anchor a intent**:
   - Llama a `updateAnchor(anchorHandle, ...)` para agregar en metadata `intentHandle` y label `intent-handle:<intentHandle>`.
5. Actualiza la collection local con `intentHandle` e `intentData` y persiste.
6. Responde con la collection (DTO de respuesta).

**Logging**: Se registra método, URL, headers, body (parseado y raw), duración y errores.

---

## 7. Flujo 3: Fulfillment (RTP webhook)

**Endpoint**: `POST /api/v1/collections/webhooks/rtp-fulfillment`

**Quién lo llama**: Red RTP (ej. Servibanca) cuando un pago se cumple.

**Body esperado** (RtpWebhookDto): `merchantTxId`, `trxid`, `rrn`, `approvalCode`, `paidAmount`, `currency`, `payer`, `fulfillmentTimestamp`, `artifactPayload`, `rawNetworkPayload` (varios opcionales).

**Qué hace el bridge**:

1. **Resolver el intent**:
   - Si viene `merchantTxId`: busca collection por merchantTxId y/o intent por merchantTxId en el ledger; obtiene `intentHandle`.
   - Si no hay merchantTxId (o no se encontró): busca anchor por labels `artifact-trxid` o `artifact-payload` con `trxid` o `artifactPayload`; del anchor obtiene `data.custom.metadata.intentHandle`.
2. Si no se obtiene `intentHandle`, responde 404.
3. Arma **evidence** con los campos del webhook (merchantTxId, paidAmount, currency, trxid, rrn, approvalCode, payer, fulfillmentTimestamp, rawNetworkPayload).
4. **Envía el proof** al ledger: `submitProof(intentHandle, evidence)`.
5. **Actualiza la collection local** (si existe): status `COMPLETED`, `fulfillmentEvidence`, `fulfilledAt`. Si no había collection local pero el proof se envió bien, igual responde 404 si no se encuentra collection (según implementación actual).
6. Responde con la collection actualizada (o error si no se encontró collection).

**Logging**: Similar al de anchor_created (request completo y resultado).

---

## 8. Consultas (solo lectura)

Todos bajo prefijo `/api/v1/collections`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `merchant-txid/:merchantTxId` | Obtiene una collection por merchantTxId. |
| GET | `anchor/:anchorHandle` | Obtiene una collection por anchor handle. |
| GET | `intent/:intentHandle` | Obtiene una collection por intent handle. |
| GET | `?status=...&merchantTxId=...` | Lista collections con filtros opcionales. |

Todas leen de la base de datos local (tabla `collections`). No modifican el ledger.

---

## 9. DTOs y validación

- **AnchorCreatedEventDto**: Adaptado al payload real del ledger (`data`, `data.anchor`, `data.anchor.data`, `data.signal`, etc.) con campos opcionales para no fallar por estructura distinta.
- **RtpWebhookDto**: Campos para fulfillment (merchantTxId, trxid, paidAmount, currency, payer, etc.).
- **CollectionResponseDto**: Forma de la collection en las respuestas.
- **ValidationPipe**: global; si falla validación se loguean los errores y se devuelve formato Minka (`ApiBodyMalformed` + detalle).

---

## 10. Qué no está implementado (resumen)

- **Creación de anchors**: No es responsabilidad del bridge; la hace el Payments Hub.
- **Cancelación de anchors** (PUT anchor con status CANCELLED): No hay endpoint en el bridge para eso.
- **Schema del intent**: El ledger puede exigir un schema para intents; si falla con `record.schema-invalid`, hay que definir/registrar el schema correcto en el ledger y pasarlo en `createIntent`.
- **Notificación al merchant** cuando el intent se completa: El documento de solución lo menciona; no hay envío de webhook/email desde el bridge hoy.
- **Múltiples anchors por mismo merchantTxId**: Se soporta (se actualiza la collection con el nuevo anchorHandle); la regla “un intent por merchantTxId” se respeta.

---

## 11. Resumen en una frase

**Implementado**: recepción del evento `anchor_created` del Payments Hub, creación/reutilización de intent por merchantTxId, vinculación anchor–intent, actualización de anchor en el ledger, persistencia local en `collections`; recepción del webhook de fulfillment RTP, envío de proof al ledger y actualización de la collection a COMPLETED; consultas por merchantTxId, anchorHandle, intentHandle y listado con filtros; infraestructura (DB, logging, errores, health, Swagger, crypto-utils y LedgerService listo para anchors e intents).

**No implementado en el bridge**: creación/cancelación de anchors, definición del schema de intents en el ledger, y notificación al merchant al completar el intent.
