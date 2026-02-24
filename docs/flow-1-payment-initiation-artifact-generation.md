# Flow 1 — Payment Initiation Artifact Generation

This diagram shows how a merchant creates a payment initiation artifact (QR code or dynamic key) through the Payments Hub, and how the Collections Bridge receives the anchor creation event.

```mermaid
sequenceDiagram
    autonumber
    actor M as Merchant
    participant H as Payments Hub<br/>(Collections)
    participant AS as Payment Initiation<br/>Artifact Solution<br/>(Nodo Generador)
    participant CB as Collections Bridge

    M->>H: POST /v2/anchors<br/>(schema=qr-code | dynamic-key)<br/>custom.metadata.merchantTxId<br/>target, symbol, amount, etc.
    
    H->>H: Validate schema + required attributes
    
    alt Invalid request
        H-->>M: 400 Bad Request<br/>(validation failed)
    else Valid request
        H->>AS: Forward artifact creation request<br/>(all received attributes)
        
        AS->>AS: Validate attributes<br/>Generate artifact fields<br/>(payload/trxid/expiry for QR,<br/>handle for dynamic-key)
        
        AS->>AS: Add generated fields to proofs/labels<br/>(no body mutation to preserve signature)
        
        AS-->>H: Success response<br/>(anchor record + proofs/labels)
        
        H->>H: Persist anchor on Payments Hub Ledger
        
        H-->>M: 200 OK<br/>(Anchor created with handle)
        
        H->>H: Emit event: anchor_created<br/>(event.data.anchor contains full anchor)
        
        H->>CB: POST /api/v1/collections/webhooks/anchor-created<br/>(webhook payload with anchor data)
        
        CB->>CB: Validate event structure<br/>(check event.data.anchor exists)
        
        alt Invalid event
            CB-->>H: 400 Bad Request<br/>(missing anchor data)
        else Valid event
            CB-->>H: 200 OK<br/>(received: true, signal: anchor-created)
            
            Note over CB: Process asynchronously<br/>(do not block webhook response)
            
            CB->>CB: Extract anchor handle<br/>Extract merchantCode + paymentReferenceNumber<br/>Derive intent handle: merchantCode:paymentReferenceNumber
        end
    end
```

## Key Points

- **Merchant** sends anchor creation request to Payments Hub with schema (`qr-code` or `dynamic-key`), `merchantTxId`, and payment details
- **Payments Hub** validates and forwards to **Artifact Solution** (Nodo Generador)
- **Artifact Solution** generates artifact-specific fields (QR payload/trxid/expiry or dynamic-key handle) and adds them via proofs/labels without mutating the original body
- **Payments Hub** persists the anchor and emits `anchor_created` event
- **Collections Bridge** receives webhook, validates, responds immediately (200 OK), then processes asynchronously
- Intent handle is derived as `merchantCode:paymentReferenceNumber` from the anchor data
