# Collections Bridge API Endpoints

This document describes all available endpoints in the Collections Bridge API.

**Base URL**: `http://localhost:3000/api/v1` (or your configured server URL)

---

## Webhook Endpoints

### 1. Anchor Created Webhook

**Endpoint**: `POST /api/v1/collections/webhooks/anchor-created`

**Description**:
This endpoint receives events from the Payments Hub when a payment artifact anchor is created. It implements **Flow 2: Intent Generation** from the Payment Collections solution.

**When to use**:

- Configure this endpoint in your Payments Hub to receive `anchor_created` events
- The Payments Hub will call this endpoint automatically when a merchant creates a payment artifact (QR code or dynamic key)

**What it does**:

1. Receives the `anchor_created` event with anchor handle and metadata
2. Retrieves the full anchor data from the ledger
3. Extracts `merchantTxId` from the anchor metadata
4. Creates or retrieves a collection record in the local database
5. Ensures idempotent intent creation (one intent per `merchantTxId`)
6. Links the anchor to the intent by updating the anchor with `intentHandle`
7. Returns the collection record

**Request Body**:

```json
{
	"event": "anchor_created",
	"anchorHandle": "anchor:qr-1725469200123-a9f3",
	"anchorData": {
		"data": {
			"handle": "anchor:qr-1725469200123-a9f3",
			"target": "target:account:merchant-123",
			"schema": "qr-code",
			"custom": {
				"metadata": {
					"merchantTxId": "tx-123456"
				}
			}
		}
	}
}
```

**Response** (200 OK):

```json
{
	"id": "uuid-here",
	"merchantTxId": "tx-123456",
	"anchorHandle": "anchor:qr-1725469200123-a9f3",
	"intentHandle": "intent:abc-123",
	"schema": "qr-code",
	"status": "PENDING",
	"anchorData": {
		/* full anchor object */
	},
	"intentData": {
		/* full intent object */
	},
	"createdAt": "2025-01-27T10:00:00Z",
	"updatedAt": "2025-01-27T10:00:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid event data or missing `merchantTxId`
- `500 Internal Server Error`: Error processing the event

**Configuration**:
Configure this endpoint URL in your Payments Hub settings to receive anchor creation events.

---

### 2. RTP Fulfillment Webhook

**Endpoint**: `POST /api/v1/collections/webhooks/rtp-fulfillment`

**Description**:
This endpoint receives webhooks from RTP (Real-Time Payment) networks when a payment has been fulfilled. It implements **Flow 3: Asynchronous Intent Fulfillment** from the Payment Collections solution.

**When to use**:

- Configure this endpoint in your RTP network (e.g., Servibanca) to receive payment fulfillment notifications
- The RTP network will call this endpoint when a payment is successfully processed

**What it does**:

1. Receives payment fulfillment data from the RTP network
2. Searches for the corresponding intent using:
    - `merchantTxId` (if provided), or
    - `trxid` or `artifactPayload` (by searching anchor labels)
3. Submits a signed quorum proof to the Payments Hub to complete the intent
4. Updates the collection status to `COMPLETED`
5. Stores fulfillment evidence for auditability

**Request Body**:

```json
{
	"merchantTxId": "tx-123456",
	"trxid": "RTP-TRX-789",
	"rrn": "123456789012",
	"approvalCode": "APPROVED",
	"paidAmount": 10000,
	"currency": "COP",
	"payer": {
		"account": "account:payer-123",
		"name": "John Doe"
	},
	"fulfillmentTimestamp": "2025-01-27T10:05:00Z",
	"rawNetworkPayload": {
		/* optional raw RTP data */
	}
}
```

**Note**: Either `merchantTxId`, `trxid`, or `artifactPayload` must be provided to identify the collection.

**Response** (200 OK):

```json
{
	"id": "uuid-here",
	"merchantTxId": "tx-123456",
	"anchorHandle": "anchor:qr-1725469200123-a9f3",
	"intentHandle": "intent:abc-123",
	"schema": "qr-code",
	"status": "COMPLETED",
	"fulfillmentEvidence": {
		"merchantTxId": "tx-123456",
		"paidAmount": 10000,
		"currency": "COP",
		"trxid": "RTP-TRX-789",
		"rrn": "123456789012",
		"approvalCode": "APPROVED",
		"payer": {
			/* payer info */
		},
		"fulfillmentTimestamp": "2025-01-27T10:05:00Z"
	},
	"fulfilledAt": "2025-01-27T10:05:00Z",
	"createdAt": "2025-01-27T10:00:00Z",
	"updatedAt": "2025-01-27T10:05:00Z"
}
```

**Error Responses**:

- `404 Not Found`: Collection or intent not found (could not match payment to collection)
- `400 Bad Request`: Invalid webhook data
- `500 Internal Server Error`: Error processing the webhook

**Configuration**:
Configure this endpoint URL in your RTP network settings to receive payment fulfillment notifications.

---

## Query Endpoints

### 3. Get Collection by Merchant Transaction ID

**Endpoint**: `GET /api/v1/collections/merchant-txid/:merchantTxId`

**Description**:
Retrieves a collection using the merchant transaction identifier. This is the primary identifier used by merchants.

**Example**:

```
GET /api/v1/collections/merchant-txid/tx-123456
```

**Response** (200 OK):

```json
{
	"id": "uuid-here",
	"merchantTxId": "tx-123456",
	"anchorHandle": "anchor:qr-1725469200123-a9f3",
	"intentHandle": "intent:abc-123",
	"schema": "qr-code",
	"status": "PENDING",
	"anchorData": {
		/* full anchor object */
	},
	"intentData": {
		/* full intent object */
	},
	"fulfillmentEvidence": null,
	"fulfilledAt": null,
	"createdAt": "2025-01-27T10:00:00Z",
	"updatedAt": "2025-01-27T10:00:00Z"
}
```

**Error Responses**:

- `404 Not Found`: Collection not found for the given `merchantTxId`

---

### 4. Get Collection by Anchor Handle

**Endpoint**: `GET /api/v1/collections/anchor/:anchorHandle`

**Description**:
Retrieves a collection using the anchor handle from the ledger.

**Example**:

```
GET /api/v1/collections/anchor/anchor:qr-1725469200123-a9f3
```

**Response** (200 OK):
Same structure as endpoint #3.

**Error Responses**:

- `404 Not Found`: Collection not found for the given `anchorHandle`

---

### 5. Get Collection by Intent Handle

**Endpoint**: `GET /api/v1/collections/intent/:intentHandle`

**Description**:
Retrieves a collection using the intent handle from the ledger.

**Example**:

```
GET /api/v1/collections/intent/intent:abc-123
```

**Response** (200 OK):
Same structure as endpoint #3.

**Error Responses**:

- `404 Not Found`: Collection not found for the given `intentHandle`

---

### 6. List Collections

**Endpoint**: `GET /api/v1/collections`

**Description**:
Retrieves all collections with optional filters.

**Query Parameters**:

- `status` (optional): Filter by status (`PENDING`, `COMPLETED`, `CANCELLED`)
- `merchantTxId` (optional): Filter by merchant transaction ID

**Examples**:

```
GET /api/v1/collections
GET /api/v1/collections?status=PENDING
GET /api/v1/collections?status=COMPLETED
GET /api/v1/collections?merchantTxId=tx-123456
GET /api/v1/collections?status=PENDING&merchantTxId=tx-123456
```

**Response** (200 OK):

```json
[
  {
    "id": "uuid-1",
    "merchantTxId": "tx-123456",
    "status": "PENDING",
    ...
  },
  {
    "id": "uuid-2",
    "merchantTxId": "tx-789012",
    "status": "COMPLETED",
    ...
  }
]
```

**Response** (200 OK - Empty):

```json
[]
```

---

## Endpoint Summary

| Method | Endpoint                                          | Purpose                                   | Called By              |
| ------ | ------------------------------------------------- | ----------------------------------------- | ---------------------- |
| POST   | `/api/v1/collections/webhooks/anchor-created`     | Receive anchor creation events            | Payments Hub           |
| POST   | `/api/v1/collections/webhooks/rtp-fulfillment`    | Receive payment fulfillment notifications | RTP Network            |
| GET    | `/api/v1/collections/merchant-txid/:merchantTxId` | Get collection by merchant ID             | Merchants/Applications |
| GET    | `/api/v1/collections/anchor/:anchorHandle`        | Get collection by anchor handle           | Applications           |
| GET    | `/api/v1/collections/intent/:intentHandle`        | Get collection by intent handle           | Applications           |
| GET    | `/api/v1/collections`                             | List collections with filters             | Applications           |

---

## Configuration Guide

### Payments Hub Configuration

To receive `anchor_created` events, configure the webhook URL in your Payments Hub:

```
Webhook URL: https://your-bridge-domain.com/api/v1/collections/webhooks/anchor-created
Event Type: anchor_created
```

### RTP Network Configuration

To receive payment fulfillment notifications, configure the webhook URL in your RTP network:

```
Webhook URL: https://your-bridge-domain.com/api/v1/collections/webhooks/rtp-fulfillment
Event Type: payment_fulfilled
```

---

## Response Format

All successful responses return data in the `CollectionResponseDto` format:

```typescript
{
  id: string;                    // UUID
  merchantTxId: string;          // Merchant transaction identifier
  anchorHandle?: string;         // Anchor handle from ledger
  intentHandle?: string;         // Intent handle from ledger
  schema?: string;               // 'qr-code' | 'dynamic-key'
  status: string;                // 'PENDING' | 'COMPLETED' | 'CANCELLED'
  anchorData?: object;           // Full anchor object from ledger
  intentData?: object;           // Full intent object from ledger
  fulfillmentEvidence?: object; // Payment fulfillment evidence
  fulfilledAt?: Date;            // Timestamp when payment was fulfilled
  createdAt: Date;              // Record creation timestamp
  updatedAt: Date;              // Last update timestamp
}
```

---

## Error Format

All errors follow the Minka Ledger error format:

```json
{
	"reason": "ApiBodyMalformed",
	"detail": "Error message describing what went wrong",
	"custom": {
		/* Optional additional error context */
	}
}
```

Common error reasons:

- `ApiBodyMalformed`: Invalid request body
- `RecordNotFound`: Collection not found
- `ApiUnexpectedError`: Internal server error

---

## Testing

### Using Swagger UI

Once the application is running, visit:

```
http://localhost:3000/api/docs
```

You can test all endpoints directly from the Swagger UI.

### Using cURL

**Test Anchor Created Webhook**:

```bash
curl -X POST http://localhost:3000/api/v1/collections/webhooks/anchor-created \
  -H "Content-Type: application/json" \
  -d '{
    "event": "anchor_created",
    "anchorHandle": "anchor:test-123",
    "anchorData": {
      "data": {
        "handle": "anchor:test-123",
        "schema": "qr-code",
        "custom": {
          "metadata": {
            "merchantTxId": "test-tx-123"
          }
        }
      }
    }
  }'
```

**Test Get Collection**:

```bash
curl http://localhost:3000/api/v1/collections/merchant-txid/test-tx-123
```

---

## Notes

- All endpoints require proper authentication if configured
- Webhook endpoints should be secured with authentication tokens
- The bridge maintains local cache of collections for fast lookups
- The ledger remains the source of truth for anchor and intent data
- Collections are automatically created when anchor events are received
- Intent creation is idempotent (one intent per `merchantTxId`)
