# Payment Collections Bridge - Architecture Diagrams

This directory contains sequence diagrams documenting the three main flows of the Payment Collections Bridge system.

## Diagrams

1. **[Flow 1 - Payment Initiation Artifact Generation](./flow-1-payment-initiation-artifact-generation.md)**
   - Merchant creates payment initiation artifact (QR code or dynamic key)
   - Payments Hub validates and forwards to Artifact Solution
   - Collections Bridge receives `anchor_created` webhook

2. **[Flow 2 - Intent Generation](./flow-2-intent-generation.md)**
   - Collections Bridge processes `anchor_created` event
   - Creates or updates intent idempotently (handle: `merchantCode:paymentReferenceNumber`)
   - Links anchor to intent via labels

3. **[Flow 3 - Intent Fulfillment](./flow-3-intent-fulfillment.md)**
   - RTP network sends fulfillment webhook (`intent-updated` with `status=committed`)
   - Collections Bridge finds anchor and intent
   - Submits committed proof to complete intent quorum
   - Updates anchor statuses (COMPLETED/CANCELLED)
   - Updates collection status in database

## Implementation Details

These diagrams are based on the actual implementation in the Collections Bridge codebase and reflect:

- **Idempotency**: All operations are idempotent (intent creation, proof submission, anchor updates)
- **Async processing**: Webhooks respond immediately (200 OK) and process asynchronously
- **Error handling**: Validation errors, missing data, and race conditions are handled gracefully
- **Data normalization**: `idQR` and `aliasValue` are normalized (trim quotes/whitespace) to handle RTP data quality issues
- **Race condition safety**: Anchor status updates are serialized by intent handle to prevent duplicate proofs

## Schema Documentation

- **[Intent Schema: payment-collection](./intent-schema-payment-collection.md)** - Complete structure specification for the `payment-collection` intent schema, including required/optional fields and validation rules

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture and design decisions
