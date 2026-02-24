# Flow 2 — Intent Generation (Idempotent)

This diagram shows how the Collections Bridge processes the `anchor_created` event to create or update an intent on the Payments Hub Ledger. The intent handle format is `merchantCode:paymentReferenceNumber`, making it idempotent.

```mermaid
sequenceDiagram
    autonumber
    participant H as Payments Hub<br/>(Ledger v2)
    participant CB as Collections Bridge
    participant DB as Database<br/>(PostgreSQL)

    Note over CB: Async processing after<br/>anchor_created webhook

    CB->>CB: Extract from anchor:<br/>- merchantCode (from target.custom or data.custom)<br/>- paymentReferenceNumber (from custom)<br/>- anchorHandle, schema, target, symbol, amount

    CB->>CB: Derive intent handle:<br/>intentHandle = merchantCode:paymentReferenceNumber

    CB->>DB: Check if collection exists<br/>WHERE merchantTxId = ...

    alt Collection exists
        DB-->>CB: Collection record
        CB->>DB: Update collection:<br/>anchorHandle, anchorData, schema
    else Collection does not exist
        DB-->>CB: Not found
        CB->>DB: Create collection:<br/>merchantTxId, anchorHandle,<br/>schema, status=PENDING, anchorData
    end

    CB->>H: GET /v2/intents/:intentHandle<br/>(check if intent exists)

    alt Intent exists
        H-->>CB: Intent record
        CB->>CB: Intent already exists<br/>(idempotent: same merchantCode:paymentReferenceNumber)
        
        CB->>H: Add anchor label to intent<br/>POST /v2/intents/:handle/proofs<br/>(custom.labels.$addToSet = "anchorHandle:schema")
        
        H->>H: Update intent meta.labels<br/>Add label: "anchorHandle:schema"
        H-->>CB: 200 OK (proof accepted)
    else Intent does not exist
        H-->>CB: 404 Not Found
        
        CB->>CB: Prepare intent data:<br/>- schema: "payment-collection"<br/>- claims: [transfer from source to target]<br/>- access: [Collections Bridge signer]<br/>- custom.merchantTxId<br/>- labels: ["anchorHandle:schema"]
        
        CB->>H: POST /v2/intents<br/>(intent data with initial proof)
        
        H->>H: Create intent record<br/>Set status to PENDING<br/>Store labels: ["anchorHandle:schema"]
        
        alt Intent creation succeeds
            H-->>CB: 200 OK<br/>(intentHandle)
            
            CB->>DB: Update collection:<br/>intentHandle = intentHandle
        else Duplicate intent (race condition)
            H-->>CB: 409 Conflict<br/>(intent already exists)
            
            CB->>H: GET /v2/intents/:intentHandle<br/>(retry read)
            H-->>CB: Intent record
            
            CB->>H: Add anchor label to intent<br/>POST /v2/intents/:handle/proofs<br/>(custom.labels.$addToSet)
            H-->>CB: 200 OK
        end
    end

    Note over H: Intent status: PENDING<br/>Waiting for quorum proof<br/>(Collections Bridge is required signer)

    CB->>DB: Save collection with intentHandle<br/>status = PENDING
```

## Key Points

- **Intent handle format**: `merchantCode:paymentReferenceNumber` ensures idempotency
- **Collection tracking**: Collections Bridge maintains a database record for each collection (by `merchantTxId`)
- **Intent creation**: If intent doesn't exist, create with:
  - Schema: `payment-collection`
  - Claim: transfer from `INTENT_CLAIM_SOURCE_HANDLE` (config) to anchor target
  - Access: Collections Bridge signer public key
  - Labels: `["anchorHandle:schema"]` (e.g., `["QR-xxx:qr-code"]`)
  - Custom: `merchantTxId` for indexing
- **Idempotency**: If intent already exists (same handle), add anchor label instead of creating duplicate
- **Race condition handling**: If POST returns 409 Conflict, read existing intent and add label
- **Intent status**: Created as `PENDING`, waiting for Collections Bridge to submit committed proof (Flow 3)
