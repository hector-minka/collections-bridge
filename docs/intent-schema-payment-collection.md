# Intent Schema: `payment-collection`

This document describes the structure of the `payment-collection` intent created by the Collections Bridge.

## Schema Name
```
payment-collection
```

## Structure

### Root Level

```json
{
  "data": { ... },      // REQUIRED - Intent data payload
  "meta": { ... }       // REQUIRED - Intent metadata (labels, proofs)
}
```

---

## `data` Object (REQUIRED)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `handle` | `string` | ✅ **REQUIRED** | Intent handle in format: `merchantCode:paymentReferenceNumber` (e.g., `"0076570881:FACT-2024-001246"`) |
| `schema` | `string` | ✅ **REQUIRED** | Must be exactly `"payment-collection"` |
| `claims` | `array` | ✅ **REQUIRED** | Array of claim objects (must contain exactly one transfer claim) |
| `access` | `array` | ✅ **REQUIRED** | Array of access control objects |
| `custom` | `object` | ⚪ **OPTIONAL** | Custom fields object (can contain additional fields) |

### `data.claims` Array (REQUIRED)

Must contain exactly **one** claim object with the following structure:

```json
{
  "action": "transfer",           // REQUIRED - Must be "transfer"
  "source": {                     // REQUIRED
    "handle": "string"            // REQUIRED - Source wallet/account handle (from INTENT_CLAIM_SOURCE_HANDLE config, default: "servibanca")
  },
  "target": {                     // REQUIRED
    "handle": "string"            // REQUIRED - Target handle (from anchor.data.target.handle)
  },
  "symbol": {                     // REQUIRED
    "handle": "string"            // REQUIRED - Symbol handle (e.g., "cop", from anchor.data.symbol.handle)
  },
  "amount": number                // REQUIRED - Transfer amount (from anchor.data.amount)
}
```

**Example:**
```json
{
  "claims": [
    {
      "action": "transfer",
      "source": { "handle": "servibanca" },
      "target": { "handle": "svgs:0076570880@bancoazul.com.co" },
      "symbol": { "handle": "cop" },
      "amount": 10000
    }
  ]
}
```

### `data.access` Array (REQUIRED)

Must contain at least **one** access control object:

```json
{
  "action": "any",                // REQUIRED - Must be "any"
  "signer": {                     // REQUIRED
    "public": "string"            // REQUIRED - Collections Bridge signer public key (base64 encoded)
  }
}
```

**Example:**
```json
{
  "access": [
    {
      "action": "any",
      "signer": { "public": "7OtyFry2pQCSINhaDfWNlKrPb7KNC7mhJpm6grlKowk=" }
    }
  ]
}
```

### `data.custom` Object (OPTIONAL)

Custom fields object. Can contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantTxId` | `string` | ⚪ **OPTIONAL** | Merchant transaction identifier (if provided by merchant) |
| `[additional fields]` | `any` | ⚪ **OPTIONAL** | Additional custom fields are allowed |

**Example:**
```json
{
  "custom": {
    "merchantTxId": "TX-2024-001251",
    "additionalField": "value"
  }
}
```

**Note:** If `custom` is empty or not provided, the field is omitted from the intent.

---

## `meta` Object (REQUIRED)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labels` | `array<string>` | ✅ **REQUIRED** | Array of label strings |
| `proofs` | `array` | ✅ **REQUIRED** | Array of proof objects (must contain at least one initial proof) |

### `meta.labels` Array (REQUIRED)

Array of label strings. Format: `"anchorHandle:schema"`

**Example:**
```json
{
  "labels": [
    "QR-1771373768504-371gz8:qr-code"
  ]
}
```

**Label Format:**
- Pattern: `{anchorHandle}:{anchorSchema}`
- `anchorHandle`: The anchor handle (e.g., `"QR-1771373768504-371gz8"`)
- `anchorSchema`: The anchor schema (e.g., `"qr-code"` or `"dynamic-key"`)

**Note:** Additional labels can be added later when new anchors are linked to the same intent (via `addAnchorLabelToIntent`).

### `meta.proofs` Array (REQUIRED)

Must contain at least **one** initial proof object with the following structure:

```json
{
  "method": "ed25519-v2",         // REQUIRED - Signature method
  "custom": {                     // REQUIRED
    "moment": "ISO8601 string",   // REQUIRED - Timestamp (e.g., "2024-01-15T10:30:00.000Z")
    "status": "CREATED"           // REQUIRED - Must be "CREATED" for initial proof
  },
  "digest": "string",             // REQUIRED - Hash digest of the intent data
  "public": "string",             // REQUIRED - Collections Bridge signer public key (base64 encoded)
  "result": "string"              // REQUIRED - Signature result (base64 encoded)
}
```

**Example:**
```json
{
  "proofs": [
    {
      "method": "ed25519-v2",
      "custom": {
        "moment": "2024-01-15T10:30:00.000Z",
        "status": "CREATED"
      },
      "digest": "abc123...",
      "public": "7OtyFry2pQCSINhaDfWNlKrPb7KNC7mhJpm6grlKowk=",
      "result": "xyz789..."
    }
  ]
}
```

**Note:** Additional proofs are added later:
- When Collections Bridge submits committed proof (Flow 3)
- When other signers submit proofs (if required by quorum rules)

---

## Complete Example

```json
{
  "data": {
    "handle": "0076570881:FACT-2024-001251",
    "schema": "payment-collection",
    "claims": [
      {
        "action": "transfer",
        "source": { "handle": "servibanca" },
        "target": { "handle": "svgs:0076570880@bancoazul.com.co" },
        "symbol": { "handle": "cop" },
        "amount": 10000
      }
    ],
    "access": [
      {
        "action": "any",
        "signer": { "public": "7OtyFry2pQCSINhaDfWNlKrPb7KNC7mhJpm6grlKowk=" }
      }
    ],
    "custom": {
      "merchantTxId": "TX-2024-001251"
    }
  },
  "meta": {
    "labels": [
      "QR-1771373768504-371gz8:qr-code"
    ],
    "proofs": [
      {
        "method": "ed25519-v2",
        "custom": {
          "moment": "2024-01-15T10:30:00.000Z",
          "status": "CREATED"
        },
        "digest": "abc123def456...",
        "public": "7OtyFry2pQCSINhaDfWNlKrPb7KNC7mhJpm6grlKowk=",
        "result": "xyz789uvw012..."
      }
    ]
  }
}
```

---

## Validation Rules

### Required Fields Summary

**`data` level:**
- ✅ `handle` (string)
- ✅ `schema` (must be `"payment-collection"`)
- ✅ `claims` (array with exactly one transfer claim)
- ✅ `access` (array with at least one access object)

**`data.claims[0]` level:**
- ✅ `action` (must be `"transfer"`)
- ✅ `source.handle` (string)
- ✅ `target.handle` (string)
- ✅ `symbol.handle` (string)
- ✅ `amount` (number)

**`data.access[0]` level:**
- ✅ `action` (must be `"any"`)
- ✅ `signer.public` (string)

**`meta` level:**
- ✅ `labels` (array of strings)
- ✅ `proofs` (array with at least one proof)

**`meta.proofs[0]` level:**
- ✅ `method` (must be `"ed25519-v2"`)
- ✅ `custom.moment` (ISO8601 string)
- ✅ `custom.status` (must be `"CREATED"` for initial proof)
- ✅ `digest` (string)
- ✅ `public` (string)
- ✅ `result` (string)

### Optional Fields

- ⚪ `data.custom` (object) - Can be omitted if empty
- ⚪ `data.custom.merchantTxId` (string) - Only included if provided
- ⚪ `data.custom.[additional fields]` - Additional custom fields are allowed

### Additional Constraints

1. **Handle format**: Must follow pattern `merchantCode:paymentReferenceNumber`
2. **Claims array**: Must contain exactly one claim (not zero, not multiple)
3. **Labels**: At least one label must be present (format: `anchorHandle:schema`)
4. **Proofs**: At least one proof must be present for initial creation
5. **Source handle**: Must reference an existing wallet/account in the Ledger
6. **Target handle**: Must reference an existing record in the Ledger (from anchor)
7. **Symbol handle**: Must reference an existing symbol in the Ledger (e.g., `"cop"`)

---

## Configuration Notes

- **`INTENT_CLAIM_SOURCE_HANDLE`**: Environment variable that sets the source handle for claims (default: `"servibanca"`). This wallet/account must exist in the Ledger.
- **Intent handle derivation**: Format is `{merchantCode}:{paymentReferenceNumber}` where:
  - `merchantCode`: Extracted from anchor (from `target.custom.merchantCode` for QR, or `data.custom.merchantCode` for dynamic-key)
  - `paymentReferenceNumber`: Extracted from `anchor.data.custom.paymentReferenceNumber`
- **Idempotency**: Intent creation is idempotent by handle. If an intent with the same handle already exists, a label is added instead of creating a duplicate.
