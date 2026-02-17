# Payment Intent Documentation

# Documentación API Minka - Métodos de Pago

**Especificación:** EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025

**Fecha:** 29/12/2025

---

---

## Tabla de Contenidos

1. [Introducción](about:blank#introducci%C3%B3n)
2. [Tipos de Métodos de Pago](about:blank#tipos-de-m%C3%A9todos-de-pago)
   - [Estados de un Anchor](about:blank#estados-de-un-anchor)
3. [Códigos QR](about:blank#c%C3%B3digos-qr)
   - [Descripción General](about:blank#descripci%C3%B3n-general)
   - [Especificación Técnica](about:blank#especificaci%C3%B3n-t%C3%A9cnica)
   - [QR Code](about:blank#qr-code)
   - [Configuración y Esquemas](about:blank#configuraci%C3%B3n-y-esquemas)
   - [Ejemplo Completo de Request](about:blank#ejemplo-completo-de-request)
   - [Mapeo de Campos a Tags EMVco](about:blank#mapeo-de-campos-a-tags-emvco)
   - [Tags de Seguridad (Tag 63 y Tag 91)](about:blank#tags-de-seguridad-tag-63-y-tag-91)
4. [Llaves Dinámicas](about:blank#llaves-din%C3%A1micas)
   - [Descripción General](about:blank#descripci%C3%B3n-general-1)
   - [Formato del Handle](about:blank#formato-del-handle)
   - [Configuración y Esquemas](about:blank#configuraci%C3%B3n-y-esquemas-1)
   - [Ejemplos Completos](about:blank#ejemplos-completos)
5. [Endpoints de la API](about:blank#endpoints-de-la-api)
   - [Crear Método de Pago](about:blank#crear-m%C3%A9todo-de-pago)
   - [Obtener Método de Pago](about:blank#obtener-m%C3%A9todo-de-pago)
   - [Deshabilitar Método de Pago](about:blank#deshabilitar-m%C3%A9todo-de-pago)
   - [Referencia de errores para anchors](about:blank#referencia-de-errores-para-anchors)
6. [Solución de Problemas](about:blank#soluci%C3%B3n-de-problemas)
7. [Intent de seguimiento al método de pago](about:blank#intent-de-seguimiento-al-m%C3%A9todo-de-pago)
   - [Intent generado automáticamente](about:blank#intent-generado-autom%C3%A1ticamente)
   - [Consultar un Intent](about:blank#consultar-un-intent)
   - [Estados del Intent](about:blank#estados-del-intent)
   - [Efecto de actualización de estado del Intent](about:blank#efecto-de-actualizaci%C3%B3n-de-estado-del-intent)
8. [Autenticación del Bridge](about:blank#autenticaci%C3%B3n-del-bridge)
   - [Múltiples reglas de seguridad](about:blank#m%C3%BAltiples-reglas-de-seguridad)
   - [Autenticación por cabeceras HTTP](about:blank#autenticaci%C3%B3n-por-cabeceras-http)
   - [OAuth2](about:blank#oauth2)
   - [OAuth2 y autenticación por cabecera juntas](about:blank#oauth2-y-autenticaci%C3%B3n-por-cabecera-juntas)

## Introducción

La **API de Métodos de Pago Minka** es un servicio que permite crear y gestionar métodos de pago en el Ledger de Minka. El sistema soporta dos tipos principales de métodos de pago:

- **Códigos QR**: Generación automática de códigos QR compatibles con EMVco para pagos presenciales y en línea
- **Llaves Dinámicas**: Generación automática de llaves de pago dinámicas para pagos recurrentes o de un solo uso

Esta API está diseñada para integrarse con el **Minka Ledger SDK** y permite a los desarrolladores crear métodos de pago de forma sencilla y segura.

### Conexión a Minka Ledger

Para utilizar esta API, es necesario establecer una conexión segura con el Minka Ledger. El Payments Hub está construido sobre un Minka Ledger, que actúa como el sistema de registro central para balances, movimientos y anchors.

Todas las operaciones de pago expuestas por Payments Hub se traducen en interacciones autenticadas con el Minka Ledger subyacente.

**Documentación Completa:** Para obtener información detallada sobre cómo conectarse al Minka Ledger, incluyendo autenticación mediante firmas digitales y tokens bearer (JWT), consulte la [guía oficial de conexión a Payments Hub](https://minka.gitbook.io/payments-hub/security/how-to-connect-to-payments-hub).

La guía incluye:

- **Método 1: LedgerSDK** (recomendado para simplicidad y consistencia)
- **Método 2: Llamadas Directas a la API** (para casos de uso avanzados y control de bajo nivel)
- Ejemplos completos de código en TypeScript/JavaScript
- Información sobre creación de signers y gestión de claves Ed25519
- Detalles sobre generación de hashes, firmas y tokens JWT

### Características Principales

✅ **Generación Automática de QR Codes**: Códigos QR compatibles con la especificación **EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025** del Banco de la República de Colombia

✅ **Llaves Dinámicas**: Llaves de pago generadas automáticamente con formato estándar

✅ **Integración con Minka Ledger**: Forwarding automático desde el Ledger

✅ **Validación Completa**: Validación de esquemas y campos según especificaciones EASPBV v1.4

✅ **Seguridad**: Autenticación JWT, validación de requests y tags de seguridad (Tag 63 y Tag 91)

**📋 Especificación de Referencia:** Esta implementación cumple con la especificación **EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025** emitida por el Banco de la República de Colombia (BanRep), que define los campos obligatorios y opcionales para códigos QR de pago en el mercado colombiano.

---

## Tipos de Métodos de Pago

### Comparación General

| Característica           | QR Codes                  | Llaves Dinámicas               |
| ------------------------ | ------------------------- | ------------------------------ |
| **Formato Handle**       | `QR-{timestamp}-{random}` | `@MERCHCODE + DDMM + SEQUENCE` |
| **Genera QR Code**       | ✅ Sí (imagen PNG base64) | ❌ No                          |
| **Búsqueda por Payload** | ✅ Sí (EMVco payload)     | ❌ No                          |
| **Búsqueda por Handle**  | ✅ Sí                     | ✅ Sí                          |
| **Expiración**           | Opcional (si es DINAMIC)  | Requerida (duration)           |

### Estados de un Método de Pago

Tanto los **Códigos QR** como las **Llaves Dinámicas** se registran en el Ledger como _anchors_. Un anchor puede encontrarse en uno de los siguientes estados:

| Estado        | Descripción                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **ACTIVE**    | El método de pago fue creado y está listo para ser usado en una transacción.                                                          |
| **CANCELLED** | El solicitante canceló manualmente el método de pago (código QR o llave dinámica).                                                    |
| **INACTIVE**  | Estado que envía el bridge cuando el método de pago ha expirado.                                                                      |
| **COMPLETED** | Estado que envía el bridge cuando una transacción fue verificada y completada correctamente usando el método de pago correspondiente. |

Flujo típico:

- **Creación** → el anchor queda en **ACTIVE**.
- **Uso exitoso** → el bridge, al procesar exitosamente una transacción, referenciada por el método de pago, envía la prueba de estado **COMPLETED** al Ledger.
- **Expiración** → el bridge envía **INACTIVE** al Ledger al expirar su tiempo de vida.
- **Cancelación por el usuario** → el método de pago pasa a **CANCELLED**.

---

## Códigos QR

### Descripción General

Los **Códigos QR** son códigos de barras bidimensionales que contienen información de pago en formato EMVco. Cuando se escanea con un lector de QR, se obtiene un payload EMVco que puede ser procesado por aplicaciones de pago.

Esta implementación cumple con la especificación **EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025** del Banco de la República de Colombia, que establece los estándares para códigos QR de pago en el mercado colombiano.

### Especificación Técnica

El sistema genera códigos QR siguiendo la especificación **EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025**, que define:

- **Campos Obligatorios**: Campos que deben estar presentes en todos los QR codes
- **Campos Opcionales**: Campos que pueden incluirse según el caso de uso
- **Tags de Seguridad**: Tag 63 (CRC) y Tag 91 (Hash de seguridad) para verificar la integridad del QR
- **Red del Adquirente**: Configuración de la red adquiriente (ACH, Servibanca, RBM, CRB, etc.)

Los códigos QR generados son compatibles con aplicaciones de pago que implementen la especificación EASPBV v1.4, incluyendo nodos como Servibanca, ACH y otros participantes del ecosistema de pagos en Colombia.

### QR Code

El schema `qr-code` es el schema unificado para todos los tipos de códigos QR. El sistema determina automáticamente el tipo de QR basándose en los campos proporcionados.

### Configuración y Esquemas

**📝 Normalización Automática de Caracteres:** Todos los campos de texto que se incluyen en el payload EMVco se normalizan automáticamente a ASCII, eliminando tildes, acentos y otros diacríticos. Esto asegura un cálculo consistente del CRC y compatibilidad con diferentes lectores de QR que pueden normalizar caracteres de manera diferente. Por ejemplo: “Medellín” → “Medellin”, “Pérez” → “Perez”, “Bogotá” → “Bogota”.

### Estructura del Anchor para QR Codes

```tsx
{
  data: {
    handle: string,
    schema: "qr-code",
	amount: number,
    symbol: { handle: "cop" },
    target:
      handle: string,
      custom: {...}
    },
    source?: {
      handle?: string,
      custom?: {...}
    },
    custom: {...}
  },
  meta: {
    labels: [],
    proofs: []
  }
}
```

### Campos de Nivel Raíz - `data`

| Campo    | Tipo    | Obligatorio      | Descripción                                                                                            | Tag EMVco |
| -------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| `handle` | string  | ✅ Sí            | Identificador único del Anchor                                                                         | -         |
| `amount` | integer | ✅ Sí (dinámico) | Monto en base 100 (ej: 100000 = 1000.00). Requerido si entityType = DYNAMIC.                           | Tag 54    |
| `symbol` | object  | ✅ Sí (dinámico) | Código de moneda. Usar `symbol.handle` (ej: `{ "handle": "cop" }`). Requerido si entityType = DYNAMIC. | Tag 53    |

### Campos del Target (Destinatario) - `target.custom`

| Campo                    | Tipo           | Obligatorio | Descripción                                                                                                                  | Tag EMVco                       |
| ------------------------ | -------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `aliasType`              | string (enum)  | ✅ Sí       | Tipo de identificador. Valores: MERCHANTID, MERCHANT_ID, IDENTIFICACION, NIT, ACCOUNT_NUMBER, CELULAR, EMAIL, ALPHANUM, TEXT | Tag 26                          |
| `aliasValue`             | string (min 1) | ✅ Sí       | Valor del identificador (teléfono, email, NIT, etc.)                                                                         | Tag 26-01 a 26-05               |
| `merchantCode`           | string (min 1) | ✅ Sí       | Código del comercio                                                                                                          | Tag 26-05, Tag 50               |
| `categoryCode`           | string (min 1) | ✅ Sí       | Código de categoría (MCC). Ej.: “5411” supermercados, “0000” individuos                                                      | Tag 52                          |
| `countryCode`            | string (min 1) | ✅ Sí       | Código de país (ISO 3166-1 alpha-2). Ej.: “CO”                                                                               | Tag 58                          |
| `name`                   | string (min 1) | ✅ Sí       | Nombre del destinatario/comercio (Tag 64-01)                                                                                 | Tag 59, Tag 64-01               |
| `city`                   | string (min 1) | ✅ Sí       | Ciudad del comercio (Tag 64-02)                                                                                              | Tag 60, Tag 64-02               |
| `postalCode`             | string (min 1) | ✅ Sí       | Código postal (se normaliza a 10 caracteres)                                                                                 | Tag 61                          |
| `documentType`           | string         | ✅ Sí       | Tipo de documento (CC, NIT, etc.)                                                                                            | Tag 62-09                       |
| `documentNumber`         | string (min 1) | ✅ Sí       | Número de documento                                                                                                          | Tag 26-01, Tag 62-09, Tag 62-10 |
| `merchantAggregatorCode` | string         | ❌ No       | Código del comercio agregador                                                                                                | Tag 51-01                       |
| `merchantLabel`          | string         | ❌ No       | Etiqueta de la tienda/sucursal                                                                                               | Tag 62-03                       |
| `accountNumber`          | string         | ❌ No       | Número de cuenta destino                                                                                                     | Tag 96                          |
| `accountType`            | string         | ❌ No       | Tipo de cuenta                                                                                                               | Tag 96                          |

### Campos del Source (Remitente) - `source.custom` (Opcional)

| Campo            | Tipo                | Obligatorio | Descripción                                                                 | Tag EMVco |
| ---------------- | ------------------- | ----------- | --------------------------------------------------------------------------- | --------- |
| `name`           | string (1-25 chars) | ❌ No       | Nombre del remitente (también usado en Tag 62-06 como Customer)             | Tag 62-06 |
| `documentNumber` | string (1-25 chars) | ❌ No       | Número de documento                                                         | -         |
| `documentType`   | string              | ❌ No       | Tipo de documento (CC, NIT, etc.)                                           | -         |
| `city`           | string              | ❌ No       | Ciudad                                                                      | -         |
| `countryCode`    | string              | ❌ No       | Código de país                                                              | -         |
| `postalCode`     | string              | ❌ No       | Código postal                                                               | -         |
| `accountNumber`  | string              | ❌ No       | Número de cuenta origen (se extrae de `source.handle` si no se proporciona) | Tag 95    |
| `accountType`    | string              | ❌ No       | Tipo de cuenta Minka (se extrae de `source.handle` si no se proporciona)    | Tag 95    |
| `loyaltyNumber`  | string              | ❌ No       | Número de lealtad                                                           | Tag 62-04 |

### Campos de Custom - `data.custom`

| Campo                     | Tipo    | Obligatorio      | Descripción                                                                          | Tag EMVco |
| ------------------------- | ------- | ---------------- | ------------------------------------------------------------------------------------ | --------- |
| `entityType`              | string  | ✅ Sí            | “DYNAMIC” o “STATIC”                                                                 | Tag 01    |
| `terminal`                | string  | ✅ Sí            | Identificador de terminal                                                            | Tag 62-07 |
| `paymentReferencePurpose` | string  | ✅ Sí            | Propósito: COMPRAS, ANULACIONES, TRANSFERENCIAS, RETIRO, RECAUDO, RECARGAS, DEPOSITO | Tag 62-08 |
| `channel`                 | string  | ✅ Sí            | Canal de pago. Valores: IM, POS, APP, ECOMM, MPOS, ATM, CB, OFC                      | Tag 80-01 |
| `channelOrigin`           | string  | ✅ Sí            | Canal origen (0-7)                                                                   | Tag 62-11 |
| `vatCondition`            | string  | ✅ Sí            | Condición IVA: “01” (exento), “02” (calculado), “03” (no aplica)                     | Tag 81-01 |
| `vat`                     | string  | ✅ Sí            | Valor IVA en base 100                                                                | Tag 82-01 |
| `vatBase`                 | string  | ✅ Sí            | Base IVA en base 100                                                                 | Tag 83-01 |
| `incCondition`            | string  | ✅ Sí            | Condición INC: “01” (billetera), “02” (comercio), “03” (%)                           | Tag 84-01 |
| `inc`                     | string  | ✅ Sí            | Valor o porcentaje INC en base 100                                                   | Tag 85-01 |
| `paymentReferenceNumber`  | string  | ✅ Sí            | Número de factura/referencia                                                         | Tag 62-01 |
| `reference`               | string  | ❌ No            | Referencia adicional                                                                 | Tag 62-05 |
| `tipIndicator`            | string  | ❌ No            | Indicador de propina: “01”, “02”, “03”                                               | Tag 55    |
| `tipValue`                | string  | ❌ No            | Valor de propina (solo si tipIndicator = “02”)                                       | Tag 56    |
| `tipPercentage`           | string  | ❌ No            | Porcentaje de propina (solo si tipIndicator = “03”)                                  | Tag 57    |
| `referenceOrCellphone`    | string  | ❌ No            | Referencia o celular (reutiliza target.custom.aliasValue si aliasType = “CELULAR”)   | Tag 93    |
| `productType`             | string  | ❌ No            | Tipo de producto                                                                     | Tag 94    |
| `additionalReference`     | string  | ❌ No            | Referencia adicional                                                                 | Tag 97    |
| `discountIndicator`       | string  | ❌ No            | Indicador de descuento (obligatorio si Tag 99 está presente)                         | Tag 99-01 |
| `discountAmount`          | string  | ❌ No            | Monto descuento (solo si discountIndicator = “01”)                                   | Tag 99-02 |
| `discountTaxAmount`       | string  | ❌ No            | IVA monto descuento (solo si discountIndicator = “01”)                               | Tag 99-03 |
| `discountPercentage`      | string  | ❌ No            | Porcentaje descuento (solo si discountIndicator = “01”)                              | Tag 99-04 |
| `discountValue`           | string  | ❌ No            | Valor descuento (solo si discountIndicator = “01”)                                   | Tag 99-05 |
| `discountQuery`           | string  | ❌ No            | Consulta descuento (obligatorio si Tag 99 está presente)                             | Tag 99-06 |
| `expiresIn`               | integer | ✅ Sí (dinámico) | Validez en segundos. \*Requerido y mín. 300 si entityType = DYNAMIC                  | -         |

### Ejemplo Mínimo de Request

A continuación se presenta un ejemplo funcional de request para crear un código QR dinámico con los campos mínimos necesarios:

```json
{
  "data": {
    "handle": "QR-1770165971295-69io7s",
    "schema": "qr-code",
    "amount": 10000,
    "symbol": { "handle": "cop" },
    "target": {
      "handle": "<account-type>:<account-number>@<bank-domain>",
      "custom": {
        "aliasType": "MERCHANTID",
        "aliasValue": "<alias-value>",
        "merchantCode": "<merchant-code>",
        "categoryCode": "<category-code>",
        "countryCode": "CO",
        "name": "<merchant-name>",
        "city": "<city>",
        "postalCode": "<postal-code>",
        "documentType": "<document-type>",
        "documentNumber": "<document-number>",
        "paymentReferenceNumber": "<payment-reference-number>"
      }
    },
    "custom": {
      "entityType": "DYNAMIC",
      "terminal": "<terminal-id>",
      "paymentReferencePurpose": "COMPRAS",
      "channel": "APP",
      "channelOrigin": "<channel-origin>",
      "vatCondition": "02",
      "vat": "0",
      "vatBase": "0",
      "incCondition": "02",
      "inc": "0",
      "expiresIn": 3600
    }
  }
}
```

**Nota importante**: El campo `symbol` debe ser un objeto con `handle` (ej: `{ handle: "cop" }`). El bridge mapea automáticamente `symbol.handle` a su equivalente ISO 4217 numérico.

### Mapeo de Campos a Tags EMVco

La siguiente tabla muestra el mapeo completo de todos los campos del request a los tags EMVco según la especificación **EASPBV-Campos-QRCode-EMVCo-Industria-v1.4-2025**. Esta información es útil para entender qué datos del request se incluyen en cada tag del payload EMVco generado.

**Nota:** Los campos marcados como “Calculado automáticamente” son generados internamente por el sistema y no deben enviarse en el request.

### Campos Base EMVco (Obligatorios)

| Tag    | Campo                      | Obligatorio | Ubicación en Request      | Ejemplo                  | Notas                                                     |
| ------ | -------------------------- | ----------- | ------------------------- | ------------------------ | --------------------------------------------------------- |
| **00** | Payload Format Indicator   | ✅ Sí       | Calculado automáticamente | `01`                     | Valor fijo, siempre `01`                                  |
| **01** | Point of Initiation Method | ✅ Sí       | `custom.entityType`       | `"DYNAMIC"` o `"STATIC"` | `"DYNAMIC"` → `12`, `"STATIC"` → `11`                     |
| **63** | CRC                        | ✅ Sí       | Calculado automáticamente | `"A1B2"`                 | Calculado automáticamente (ver sección Tags de Seguridad) |

### Información del Comercio

| Tag       | Campo                                | Obligatorio | Ubicación en Request                                        | Ejemplo                  | Notas                                                                                                                              |
| --------- | ------------------------------------ | ----------- | ----------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **26**    | Multillave Pagos Inmediatos          | ❌ No       | `target.custom`                                             | Ver abajo                | Template con subtags. **NOTA**: Merchant ID (26-05) coexiste con Tag 50. Si hay Tag 26-05, se usa como llave; si no, se usa Tag 50 |
| **26-00** | GUID                                 | ❌ No       | Calculado automáticamente                                   | `"CO.COM.{RED}.LLA"`     | Basado en `acquirerNetwork` (solo si Tag 26 está presente)                                                                         |
| **26-01** | Identificación / NIT                 | ❌ No       | `target.custom.aliasValue` o `target.custom.documentNumber` | `"900123456"`            | Si `aliasType` es `IDENTIFICACION` o `NIT`                                                                                         |
| **26-02** | Número celular                       | ❌ No       | `target.custom.aliasValue`                                  | `"+573001234567"`        | Si `aliasType` es `CELULAR`                                                                                                        |
| **26-03** | Correo electrónico                   | ❌ No       | `target.custom.aliasValue`                                  | `"merchant@example.com"` | Si `aliasType` es `EMAIL`                                                                                                          |
| **26-04** | Alfanumérico / Texto                 | ❌ No       | `target.custom.aliasValue`                                  | `"@kamin01"`             | Si `aliasType` es `ALPHANUM` o `TEXT`                                                                                              |
| **26-05** | Merchant ID                          | ❌ No       | `target.custom.merchantCode`                                | `"MERCH-001"`            | Si `aliasType` es `MERCHANTID` o `MERCHANT_ID`. **NOTA**: Si está presente, se usa como llave en lugar de Tag 50                   |
| **49**    | Identificador Red del Adquirente     | ✅ Sí       | Configuración del bridge (.env)                             | `"{RED}"`                | Valores: RBM, CRB, ACH, BRC, MCCA, SVB, VCSS, VISI                                                                                 |
| **49-00** | GUID                                 | ✅ Sí       | Calculado automáticamente                                   | `"CO.COM.{RED}.RED"`     | Basado en `acquirerNetwork` (configuración del bridge)                                                                             |
| **49-01** | Identificador de red                 | ✅ Sí       | Configuración del bridge (.env)                             | `"{RED}"`                | Código de la red adquiriente                                                                                                       |
| **50**    | Código del Comercio                  | ❌ No       | `target.custom.merchantCode`                                | `"MERCH-001"`            | Código único del comercio. **NOTA**: Se usa si Tag 26-05 no está presente                                                          |
| **50-00** | GUID                                 | ❌ No       | Calculado automáticamente                                   | `"CO.COM.{RED}.CU"`      | Basado en `acquirerNetwork` (solo si Tag 50 está presente)                                                                         |
| **50-01** | Código comercio                      | ❌ No       | `target.custom.merchantCode`                                | `"MERCH-001"`            | Valor del código (solo si Tag 50 está presente)                                                                                    |
| **51**    | Código Comercio Agregador            | ❌ No       | `target.custom.merchantAggregatorCode`                      | `"AGG-12345"`            | Opcional                                                                                                                           |
| **51-00** | GUID                                 | ❌ No       | Calculado automáticamente                                   | `"CO.COM.{RED}.CA"`      | Si `merchantAggregatorCode` está presente                                                                                          |
| **51-01** | Identificador del comercio agrupador | ❌ No       | `target.custom.merchantAggregatorCode`                      | `"AGG-12345"`            | Si está presente                                                                                                                   |

### Información Adicional del Comercio (Obligatorios)

| Tag    | Campo         | Obligatorio | Ubicación en Request         | Ejemplo                       | Notas              |
| ------ | ------------- | ----------- | ---------------------------- | ----------------------------- | ------------------ |
| **52** | MCC           | ✅ Sí       | `target.custom.categoryCode` | `"5411"`                      | 4 dígitos          |
| **58** | Country Code  | ✅ Sí       | `target.custom.countryCode`  | `"CO"`                        | ISO 3166-1 alpha-2 |
| **59** | Merchant Name | ✅ Sí       | `target.custom.name`         | `"Supermercado La Esperanza"` | Máx 25 caracteres  |
| **60** | Merchant City | ✅ Sí       | `target.custom.city`         | `"Bogota"`                    | Máx 15 caracteres  |
| **61** | Postal Code   | ✅ Sí       | `target.custom.postalCode`   | `"110111"`                    | Máx 10 caracteres  |

### Detalle de la Transacción (Obligatorios para QR Dinámico)

| Tag    | Campo              | Obligatorio | Ubicación en Request   | Ejemplo  | Notas                                                                                                                                                                                                                                                                                         |
| ------ | ------------------ | ----------- | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **53** | Currency Code      | ✅ Sí\*     | `symbol` (object)      | `"170"`  | ISO 4217 numérico (170 = COP). \*Solo para QR dinámico. Se mapea desde `symbol.handle` (ej: “cop” → “170”, “usd” → “840”). Longitud: 3 caracteres                                                                                                                                             |
| **54** | Transaction Amount | ✅ Sí\*     | `amount` (integer)     | `100000` | En base 100 (100000 = 1000.00). \*Solo para QR dinámico **si el campo `amount` está presente**. Si no se proporciona `amount`, el Tag 54 no se incluye en el payload. **Valor bruto, no incluye impuestos, propina, etc.**                                                                    |
| **55** | Tip Indicator      | ❌ No       | `custom.tipIndicator`  | `"01"`   | Longitud: 2 caracteres. Valores: `01` (Billetera debe solicitar el valor de propina, no se llenan tags 56 y 57), `02` (Indica que el tag 56 está lleno, excluyendo el tag 57), `03` (Indica que el tag 57 está lleno, excluyendo el tag 56). **NOTA**: Si no viene el campo, no tiene propina |
| **56** | Tip Value          | ❌ No       | `custom.tipValue`      | `"5000"` | Longitud: 13 caracteres. En base 100. **Excluyente del tag 57**. Se llena solo si tag 55 tiene valor `"02"`                                                                                                                                                                                   |
| **57** | Tip Percentage     | ❌ No       | `custom.tipPercentage` | `"5"`    | Longitud: 5 caracteres. **Excluyente del tag 56**. Se llena solo si tag 55 tiene valor `"03"`                                                                                                                                                                                                 |

### Campos Adicionales del Comercio (Obligatorios)

| Tag       | Campo | Obligatorio | Ubicación en Request      | Ejemplo                | Notas                                                           |
| --------- | ----- | ----------- | ------------------------- | ---------------------- | --------------------------------------------------------------- |
| **80**    | Canal | ✅ Sí       | `custom.channel`          | `"POS"`                | Valores: IM, POS, APP, ECOMM, MPOS, ATM, CB, OFC. Default: “IM” |
| **80-00** | GUID  | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.CANAL"` | Basado en `acquirerNetwork`                                     |
| **80-01** | Canal | ✅ Sí       | `custom.channel`          | `"POS"`                | Valor del canal                                                 |

### Impuestos (Obligatorios)

| Tag       | Campo         | Obligatorio | Ubicación en Request      | Ejemplo               | Notas                                                        |
| --------- | ------------- | ----------- | ------------------------- | --------------------- | ------------------------------------------------------------ |
| **81**    | Condición IVA | ✅ Sí       | `custom.vatCondition`     | `"02"`                | 01 (exento), 02 (calculado), 03 (no aplica). Default: `"02"` |
| **81-00** | GUID          | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.CIVA"` | Basado en `acquirerNetwork`                                  |
| **81-01** | Condición     | ✅ Sí       | `custom.vatCondition`     | `"02"`                | Valor de la condición                                        |
| **82**    | IVA           | ✅ Sí       | `custom.vat`              | `"19000"`             | En base 100 (19000 = 190.00)                                 |
| **82-00** | GUID          | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.IVA"`  | Basado en `acquirerNetwork`                                  |
| **82-01** | IVA           | ✅ Sí       | `custom.vat`              | `"19000"`             | Valor del IVA                                                |
| **83**    | Base IVA      | ✅ Sí       | `custom.vatBase`          | `"100000"`            | En base 100                                                  |
| **83-00** | GUID          | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.BASE"` | Basado en `acquirerNetwork`                                  |
| **83-01** | Base IVA      | ✅ Sí       | `custom.vatBase`          | `"100000"`            | Valor de la base                                             |
| **84**    | Condición INC | ✅ Sí       | `custom.incCondition`     | `"02"`                | 01 (billetera), 02 (comercio), 03 (%). Default: `"02"`       |
| **84-00** | GUID          | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.CINC"` | Basado en `acquirerNetwork`                                  |
| **84-01** | Condición     | ✅ Sí       | `custom.incCondition`     | `"02"`                | Valor de la condición                                        |
| **85**    | INC           | ✅ Sí       | `custom.inc`              | `"0"`                 | En base 100                                                  |
| **85-00** | GUID          | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.INC"`  | Basado en `acquirerNetwork`                                  |
| **85-01** | INC           | ✅ Sí       | `custom.inc`              | `"0"`                 | Valor del INC                                                |

### Tag 90 - Consecutivo de Transacción (Calculado automáticamente)

| Tag       | Campo          | Obligatorio | Ubicación en Request      | Ejemplo                           | Notas                                                                 |
| --------- | -------------- | ----------- | ------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| **90**    | Consecutivo    | ✅ Sí       | Calculado automáticamente | Template con subtags              | Generado por el bridge (GUID + ID transacción). No enviar en request. |
| **90-00** | GUID           | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.TRXID"`            | Basado en `acquirerNetwork`                                           |
| **90-01** | Transaction ID | ✅ Sí       | Calculado automáticamente | `"2500112345678901234"` (máx. 19) | QR estático: `"000000"`. QR dinámico: YYDDD+HHMMSS+MMM+RRRR           |

### Tag 91 - Hash de Seguridad (Calculado automáticamente)

| Tag       | Campo | Obligatorio | Ubicación en Request      | Ejemplo              | Notas                                                              |
| --------- | ----- | ----------- | ------------------------- | -------------------- | ------------------------------------------------------------------ |
| **91**    | Hash  | ✅ Sí       | Calculado automáticamente | Template con subtags | SHA-256 del payload (excl. Tag 63 y Tag 91). No enviar en request. |
| **91-00** | GUID  | ✅ Sí       | Calculado automáticamente | `"CO.COM.{RED}.SEC"` | Basado en `acquirerNetwork`                                        |
| **91-01** | Hash  | ✅ Sí       | Calculado automáticamente | 64 caracteres hex    | Hash SHA-256 (ver sección Tags de Seguridad)                       |

### Tag 62 - Datos Adicionales (Additional Data Field Template)

| Tag       | Campo               | Obligatorio | Ubicación en Request                   | Ejemplo             | Notas                                                           |
| --------- | ------------------- | ----------- | -------------------------------------- | ------------------- | --------------------------------------------------------------- |
| **62-01** | Número factura      | ❌ No       | `custom.paymentReferenceNumber`        | `"FACT-2024-001"`   | Número de factura o referencia de pago                          |
| **62-02** | Número celular      | ❌ No       | `target.custom.aliasValue`             | 10 dígitos          | Solo si `aliasType` es `CELULAR` (celular a 10 dígitos)         |
| **62-03** | Store label         | ❌ No       | `target.custom.merchantLabel`          | `"Sucursal Centro"` | Etiqueta de tienda/sucursal                                     |
| **62-04** | Loyalty number      | ❌ No       | `source.custom.loyaltyNumber`          | `"LOY-001"`         | Número de lealtad del pagador                                   |
| **62-05** | Referencia          | ❌ No       | `custom.reference`                     | `"REF-001"`         | Referencia adicional                                            |
| **62-06** | Customer            | ❌ No       | `source.custom.name`                   | `"Cliente Demo"`    | Nombre del pagador (remitente)                                  |
| **62-07** | Terminal            | ✅ Sí       | `custom.terminal`                      | `"000"`             | Identificador de terminal (obligatorio según EASPBV)            |
| **62-08** | Propósito           | ✅ Sí       | `custom.paymentReferencePurpose`       | `"00"` (COMPRAS)    | Código de propósito: COMPRAS, ANULACIONES, TRANSFERENCIAS, etc. |
| **62-09** | Datos consumidor    | ❌ No       | `custom.additionalConsumerDataRequest` | `"A"`, `"M"`, `"E"` | Solicitud de datos adicionales (válidos: A, M, E)               |
| **62-10** | NIT comercio        | ❌ No       | `target.custom.documentNumber`         | NIT                 | Solo si `target.custom.documentType` es `NIT`                   |
| **62-11** | Canal origen / idQr | ❌ No       | `custom.channelOrigin`                 | 3 dígitos           | Canal origen; o identificador QR si aplica                      |

### Tag 64 - Idioma / Nombre y ciudad (Opcional)

| Tag       | Campo           | Obligatorio | Ubicación en Request | Ejemplo   | Notas                                              |
| --------- | --------------- | ----------- | -------------------- | --------- | -------------------------------------------------- |
| **64-00** | Idioma          | ❌ No       | Calculado / config   | `"es"`    | Código ISO 639-1 (ej. `es` para español)           |
| **64-01** | Nombre comercio | ❌ No       | `target.custom.name` | `"Kamin"` | Mismo valor que Tag 59 (nombre en contexto idioma) |
| **64-02** | Ciudad comercio | ❌ No       | `target.custom.city` | `"11001"` | Mismo valor que Tag 60 (ciudad en contexto idioma) |

### Tags 93, 94, 97, 99 - Plantillas opcionales (Schema → Tag)

| Tag       | Campo                | Obligatorio | Ubicación en Request          | Ejemplo         | Notas                                                                      |
| --------- | -------------------- | ----------- | ----------------------------- | --------------- | -------------------------------------------------------------------------- |
| **93**    | Referencia / Celular | ❌ No       | `custom.referenceOrCellphone` | Celular o ref.  | Si no se envía, se usa `target.custom.aliasValue` cuando aliasType=CELULAR |
| **94**    | Tipo producto        | ❌ No       | `custom.productType`          | `"PROD-001"`    | Tipo de producto                                                           |
| **97**    | Referencia adicional | ❌ No       | `custom.additionalReference`  | `"REF-ADIC"`    | Referencia adicional                                                       |
| **99**    | Descuentos           | ❌ No       | Ver subtags abajo             | Template        | Template: 00 GUID, 01-06 (indicador, montos, consulta)                     |
| **99-01** | Indicador descuento  | ❌ No       | `custom.discountIndicator`    | `"01"`          | Obligatorio si Tag 99 está presente                                        |
| **99-02** | Monto descuento      | ❌ No       | `custom.discountAmount`       | base 100        | Solo si 99-01 = “01”                                                       |
| **99-03** | IVA monto descuento  | ❌ No       | `custom.discountTaxAmount`    | base 100        | Solo si 99-01 = “01”                                                       |
| **99-04** | Porcentaje descuento | ❌ No       | `custom.discountPercentage`   |                 | Solo si 99-01 = “01”                                                       |
| **99-05** | Valor descuento      | ❌ No       | `custom.discountValue`        | base 100        | Solo si 99-01 = “01”                                                       |
| **99-06** | Consulta descuento   | ❌ No       | `custom.discountQuery`        | `"01"` o `"02"` | Obligatorio si Tag 99 está presente                                        |

### Campos Calculados Automáticamente (NO enviar en request)

Los siguientes campos son generados automáticamente por el sistema y **NO deben enviarse** en el request:

- **Tag 00**: Payload Format Indicator (siempre `01`)
- **Tag 63**: CRC (calculado automáticamente)
- **Tag 91**: Hash de Seguridad (SHA-256, calculado automáticamente)
- Todos los GUIDs (Tag XX-00) de los templates
- **Tag 90**: Consecutivo de Transacción (generado automáticamente por el bridge)
  - **Tag 90-00**: GUID = `CO.COM.{RED}.TRXID` (basado en `acquirerNetwork` del bridge)
  - **Tag 90-01**: Transaction ID (máximo 19 caracteres, siempre auto-generado)
    - Para QR estático: `"000000"`
    - Para QR dinámico: Se genera automáticamente con formato `YYDDD + HHMMSS + MMM + RRRR` (18 caracteres)
      - YY: 2 dígitos del año (ej: `25` para 2025)
      - DDD: 3 dígitos del día juliano (001-366)
      - HHMMSS: 6 dígitos (hora, minuto, segundo)
      - MMM: 3 dígitos (milisegundos, primeros 3)
      - RRRR: 4 dígitos (aleatorio o parte del handle para unicidad)

### Notas Importantes

- **Campos Obligatorios**: Todos los campos marcados con ✅ Sí deben estar presentes en el request o ser generados automáticamente.
- **Tag 62-07 (Terminal)**: Es **OBLIGATORIO** según la especificación. Si no se proporciona, el sistema genera un valor automáticamente basado en el handle del anchor.
- **Tag 62-08 (Propósito)**: Es **OBLIGATORIO** según la especificación. Para anulaciones debe incluir RRN y No. de Aprobación.
- **Tag 26 vs Tag 50**:
  - Tag 26-05 (Merchant ID) coexiste con Tag 50
  - Si Tag 26-05 está presente, se usa como llave de transferencias inmediatas
  - Si Tag 26-05 no está presente, se usa Tag 50
  - Primero se lee Tag 26-05, si encuentra información aquí, lo reconoce como llave; si no, procede con Tag 50
- **Tags 92-98**: Según la especificación, estos tags **NO tienen subtags**. Son campos simples sin estructura de template.
- **Tag 99 (Descuentos)**: Tiene estructura de template con subtags:
  - 00: GUID (obligatorio si Tag 99 está presente)
  - 01: Indicador Descuento (obligatorio)
  - 02: Monto Descuento (opcional, solo si 01 = “01”)
  - 03: IVA Monto Descuento (opcional, solo si 01 = “01”)
  - 04: Porcentaje Descuento (opcional, solo si 01 = “01”)
  - 05: Valor Descuento (opcional, solo si 01 = “01”)
  - 06: Consulta Descuento (obligatorio): “01” (Leer subtags 02 al 05) o “02” (Consultar descuento al comercio)
- **Valores por Defecto**:
  - `ivaCondition`: `"02"` (IVA calculado por el comercio)
  - `incCondition`: `"02"` (INC calculado por el comercio)
  - `channel`: `"IM"` (si no se especifica)
  - `postalCode`: `"000000"` (si no se especifica)
- **Formato de Montos**: Todos los montos deben estar en base 100 (ej: 100000 = 1000.00)
- **QR Dinámico vs Estático**:
  - **Estático** (`entityType: "STATIC"`): No requiere Tags 53, 54. El Tag 53 siempre se incluye, pero el Tag 54 solo se incluye si el campo `amount` está presente.
  - **Dinámico** (`entityType: "DYNAMIC"`): Requiere Tag 53. El Tag 54 solo se incluye si el campo `amount` está presente en el request.
- **Tag 90 (Consecutivo de Transacción)**:
  - **Siempre auto-generado por el bridge**: El Tag 90 es siempre generado automáticamente por el bridge basándose en la configuración de la red adquiriente (archivo `.env`), siguiendo los criterios definidos según EASPBV v1.4-2025
  - **Para QR Dinámico**:
    - Se genera automáticamente con formato `YYDDD + HHMMSS + MMM + RRRR` (18 caracteres)
    - **Formato de auto-generación**:
      - YY: 2 dígitos del año (ej: `25` para 2025)
      - DDD: 3 dígitos del día juliano (001-366)
      - HHMMSS: 6 dígitos (hora, minuto, segundo en formato 24 horas)
      - MMM: 3 dígitos (milisegundos, primeros 3 dígitos)
      - RRRR: 4 dígitos (aleatorio o parte del handle para garantizar unicidad)
    - **Ejemplo**: `2500112345678901234` (25 = año 2025, 001 = 1 de enero, 123456 = 12:34:56, 789 = milisegundos, 0123 = aleatorio/handle)
  - **Para QR Estático**: Siempre `"000000"`
  - **GUID (Tag 90-00)**: Siempre `CO.COM.{RED}.TRXID` (no depende de la red adquiriente)
  - **Longitud máxima**: 19 caracteres según EASPBV v1.4-2025
- **GUIDs según Red Adquiriente**: Los GUIDs se generan automáticamente basados en la configuración del bridge (archivo `.env`, variable `ACQUIRER_NETWORK`), no desde los datos del anchor:
  - RBM: `CO.COM.RBM.*`
  - CRB: `CO.COM.CRB.*`
  - ACH: `CO.COM.ACH.*`
  - SVB: `CO.COM.SVB.*`
  - etc.

### Tags de Seguridad (Tag 63 y Tag 91)

Los códigos QR generados incluyen dos tags de seguridad que garantizan la integridad de los datos: el **Tag 63 (CRC)** y el **Tag 91 (Hash de Seguridad)**. Estos tags permiten verificar que el QR no ha sido modificado o corrompido.

### Tag 63 - CRC (Cyclic Redundancy Check)

### ¿Qué es?

El **Tag 63** contiene un código de verificación CRC16-CCITT que se calcula según la especificación EMVCo. Este código permite detectar errores de transmisión o alteraciones accidentales en los datos.

### ¿Cómo se crea?

Según la especificación **EMV® QR Code Specification**, el cálculo del CRC sigue estas reglas:

- **Algoritmo**: CRC-16/CCITT-FALSE
- **Polinomio**: 0x1021
- **Valor inicial**: 0xFFFF
- **Sin XOR final**

El proceso de cálculo es el siguiente:

1. **Se construye el payload base**: Se concatenan todos los tags EMVco desde el Tag 00 hasta el Tag 62, **incluyendo el Tag 91 si está presente**.
2. **Se agrega el literal “6304”**: Se agrega el tag y su longitud (`6304`) al payload base. Este literal **SÍ debe incluirse** en el cálculo del CRC.
3. **Se calcula el CRC**: Se aplica el algoritmo CRC-16/CCITT-FALSE sobre el payload completo (incluyendo Tag 91 y el literal “6304”).
4. **Se formatea el resultado**: El CRC calculado (16 bits) se convierte a hexadecimal y se formatea a 4 caracteres (ej: `9BE6`).
5. **Se agrega al payload**: Se agrega como `6304<CRC>` donde `04` es la longitud (4 caracteres) y `<CRC>` es el valor calculado.

### ¿Cómo se verifica?

Cuando se lee un QR code:

1. **Se extrae el CRC del payload**: Se lee el valor del Tag 63 (últimos 6 caracteres del payload: `6304<CRC>`).
2. **Se reconstruye el payload base**: Se toma todo el payload excepto el Tag 63 completo (pero **incluyendo el Tag 91 si está presente**).
3. **Se agrega el literal “6304”**: Se agrega el tag y su longitud al payload reconstruido.
4. **Se recalcula el CRC**: Se aplica el mismo algoritmo CRC-16/CCITT-FALSE al payload reconstruido (incluyendo Tag 91 y “6304”).
5. **Se compara**: Si el CRC calculado coincide con el CRC extraído, el payload es válido. Si no coinciden, los datos fueron alterados o corrompidos.

### Tag 91 - Hash de Seguridad (SHA-256)

### ¿Qué es?

El **Tag 91** contiene un hash de seguridad calculado usando **SHA-256** sobre el payload EMVco (excluyendo Tag 63 y Tag 91). Este hash permite verificar la integridad de los datos: cualquier modificación del payload dará un hash distinto. No se utiliza llave secreta; el algoritmo es SHA-256 puro (no HMAC).

### ¿Cómo se crea?

1. **Se construye el payload base**: Se concatenan todos los tags EMVco desde el Tag 00 hasta el Tag 62 (excluyendo Tag 63 y Tag 91).
2. **Se calcula el SHA-256**: Se aplica el algoritmo SHA-256 al payload base (sin llave; hash criptográfico estándar).
3. **Se formatea el resultado**: El hash calculado se convierte a hexadecimal (64 caracteres).
4. **Se construye el Tag 91**: Se crea un template con subtags:
   - **Subtag 00 (GUID)**: Identificador único global generado automáticamente basado en la configuración del bridge (archivo `.env`, variable `ACQUIRER_NETWORK`) (ej: `CO.COM.{RED}.SEC`)
   - **Subtag 01 (Hash)**: El hash SHA-256 calculado (64 caracteres hex)
5. **Se agrega al payload**: Se agrega el Tag 91 antes del Tag 63.

### ¿Cómo se verifica?

Cuando se lee un QR code:

1. **Se extrae el Tag 91 del payload**: Se parsea el Tag 91 y se extraen:
   - GUID (subtag 00)
   - Hash (subtag 01)
2. **Se reconstruye el payload base**: Se toma todo el payload excepto el Tag 63 y el Tag 91.
3. **Se recalcula el hash**: Se aplica SHA-256 al payload reconstruido (mismo algoritmo, sin llave).
4. **Se compara**: Si el hash calculado coincide con el hash del Tag 91, los datos son íntegros. Si no coinciden, el payload fue alterado.

### Importancia para la Seguridad

El Tag 91 proporciona una capa adicional de seguridad porque:

- **Integridad**: Cualquier modificación del QR resultará en un hash diferente, por lo que se puede detectar si los datos fueron alterados.

---

## Llaves Dinámicas

### Descripción General

Las **Llaves Dinámicas** son identificadores de pago generados automáticamente que se utilizan para pagos recurrentes o de un solo uso. A diferencia de los QR codes, las llaves dinámicas **no generan imágenes QR**, sino que proporcionan un handle único que puede ser usado para procesar pagos.

### Características Principales

- **Schema**: `dynamic-keys`
- **Formato Handle**: `@MERCHCODE + DDMM + SEQUENCE`
- **No genera QR Code**: Solo genera el handle
- **Expiración Requerida**: Debe incluir `expiresIn` en `custom` (mínimo 300 segundos)

### Formato del Handle

El handle de un dynamic key sigue un formato específico:

```
@ + MERCHCODE + DDMM + SEQUENCE
```

Donde:

- `@`: Prefijo fijo
- `MERCHCODE`: Código del comercio (usado también en el campo `custom.merchantCode`)
- `DDMM`: Día y mes actuales en formato DDMM (ej: 1012 para 10 de diciembre)
- `SEQUENCE`: Número secuencial (del campo `custom.sequence` o 1 por defecto)

### Ejemplos de Handles

- `@MERCH-0011012001`: Comercio MERCH-001, creado el 10 de diciembre, secuencia 01

### Configuración y Esquemas

### Estructura del Anchor para Llaves Dinámicas

```tsx
{
  data: {
    handle: string,           // @ + MERCHCODE + DDMM + SEQUENCE
    schema: "dynamic-keys",
    wallet: string,            // Identificador de la wallet (ej: "bancorojo.com.co")
    target: string,            // Target del anchor (formato: "{accountType}:{accountNumber}@{domain}")
    amount: number,          // Monto en base 100
    symbol: { handle: string }, // Código de moneda (ej: { handle: "cop" })
    custom: {
      // Información personal del destinatario
      name: string,                     // REQUERIDO si entityType = business - Nombre
      firstName: string,                // REQUERIDO si entityType = individual - Nombre
      lastName: string,                 // REQUERIDO si entityType = individual - Apellido
      secondName?: string,              // Opcional si entityType = individual - Segundo nombre
      secondLastName?: string,          // Opcional si entityType = individual - Segundo apellido
      documentType: string,             // REQUERIDO - Tipo de documento (cc, ce, nuip, ppt, txid, pep, ccpt, nidn)
      documentNumber: string,           // REQUERIDO - Número de documento
      entityType: string,               // REQUERIDO - Tipo de entidad (individual, business)
      aliasType: string,                // REQUERIDO - Tipo de alias (tel, nidn, username, email)
      accountType: string,              // REQUERIDO - Tipo de cuenta (svgs, tras, cacc, othr, dbmo, dord, dbmi)
      accountNumber: string,            // REQUERIDO - Número de cuenta
      participantCode: string,          // REQUERIDO - Código del participante
      targetSpbviCode: string,          // REQUERIDO - Código SPBVI (valores: "SRV")
      directory: string,                // REQUERIDO - Directorio (valores: "local", "centralized")
      expiresIn: number,                // REQUERIDO - Duración en segundos (mínimo: 300)
      consent: string,                  // REQUERIDO - Consentimiento (valores: "Y", "N")
	  merchantCode: string, 			// REQUERIDO - Código del Comercio
      paymentReferenceNumber: string    // REQUERIDO - Número de referencia de la transacción
    }
  },
  meta: {
    labels: [],
    proofs: []
  }
}
```

### Campos Requeridos (Llaves Dinámicas)

Basado en la estructura del anchor para llaves dinámicas anterior:

| Campo                    | Ubicación   | Tipo               | Descripción                                                            |
| ------------------------ | ----------- | ------------------ | ---------------------------------------------------------------------- |
| `handle`                 | data        | string             | Identificador único (@MERCHCODE+DDMM+SEQUENCE). Opcional si se genera. |
| `wallet`                 | data        | string             | Identificador de la wallet                                             |
| `target`                 | data        | string             | Target del anchor: “{accountType}:{accountNumber}@domain”              |
| `amount`                 | data        | number             | Monto en base 100                                                      |
| `symbol`                 | data        | { handle: string } | Código de moneda (ej: { handle: “cop” })                               |
| `name`                   | data.custom | string             | REQUERIDO si entityType = business. Nombre del comercio.               |
| `firstName`              | data.custom | string             | REQUERIDO si entityType = individual. Nombre.                          |
| `lastName`               | data.custom | string             | REQUERIDO si entityType = individual. Apellido.                        |
| `documentType`           | data.custom | string (enum)      | Tipo de documento: cc, ce, nuip, ppt, txid, pep, ccpt, nidn            |
| `documentNumber`         | data.custom | string             | Número de documento                                                    |
| `entityType`             | data.custom | string (enum)      | Tipo de entidad: individual, business                                  |
| `aliasType`              | data.custom | string (enum)      | Tipo de alias: tel, nidn, username, email                              |
| `accountType`            | data.custom | string (enum)      | Tipo de cuenta: svgs, tras, cacc, othr, dbmo, dord, dbmi               |
| `accountNumber`          | data.custom | string             | Número de cuenta                                                       |
| `participantCode`        | data.custom | string             | Código del participante                                                |
| `targetSpbviCode`        | data.custom | string (enum)      | Código SPBVI                                                           |
| `directory`              | data.custom | string (enum)      | Directorio: “local”, “centralized”                                     |
| `expiresIn`              | data.custom | number (min 300)   | Duración en segundos (mínimo 300)                                      |
| `merchantCode`           | data.custom | string             | Código del Comercio                                                    |
| `paymentReferenceNumber` | data.custom | string             | Número de referencia de la transacción                                 |
| `consent`                | data.custom | string (Y/N)       | Consentimiento                                                         |

### Campos Opcionales (Llaves Dinámicas)

| Campo            | Ubicación   | Tipo   | Descripción                                |
| ---------------- | ----------- | ------ | ------------------------------------------ |
| `secondName`     | data.custom | string | Segundo nombre (entityType = individual)   |
| `secondLastName` | data.custom | string | Segundo apellido (entityType = individual) |

### Ejemplo de Llave Dinámica Mínima (Solo Campos Requeridos)

```json
{
  "data": {
    "handle": "@MERCH-0011012001",
    "schema": "dynamic-keys",
    "wallet": "<wallet-handle>",
    "target": "<account-type>:<account-number>@<bank-domain>",
    "amount": 50000,
    "symbol": { "handle": "cop" },
    "custom": {
      "firstName": "<first-name>",
      "lastName": "<last-name>",
      "documentType": "<document-type>",
      "documentNumber": "<document-number>",
      "entityType": "individual",
      "aliasType": "username",
      "merchantCode": "<merchant-code>",
      "accountType": "<account-type>",
      "accountNumber": "<account-number>",
      "participantCode": "<participant-code>",
      "targetSpbviCode": "<spbvi-code>",
      "directory": "centralized",
      "expiresIn": 300,
      "paymentReferenceNumber": "<payment-reference-number>"
    }
  },
  "meta": {
    "labels": [],
    "proofs": []
  }
}
```

### Respuesta del Servidor

Cuando se crea una llave dinámica exitosamente, la respuesta incluye la misma estructura del anchor para llaves dinámicas:

```json
{
  "data": {
    "handle": "@MERCH-0011012001",
    "schema": "dynamic-keys",
    "wallet": "<wallet-handle>",
    "target": "<account-type>:<account-number>@<bank-domain>",
    "amount": 50000,
    "symbol": { "handle": "cop" },
    "custom": {
      "firstName": "<first-name>",
      "lastName": "<last-name>",
      "documentType": "<document-type>",
      "documentNumber": "<document-number>",
      "entityType": "individual",
      "aliasType": "username",
      "merchantCode": "<merchant-code>",
      "accountType": "<account-type>",
      "accountNumber": "<account-number>",
      "participantCode": "<participant-code>",
      "targetSpbviCode": "<spbvi-code>",
      "directory": "centralized",
      "expiresIn": 300,
      "paymentReferenceNumber": "<payment-reference-number>"
    }
  },
  "hash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "luid": "$anc.-1R3SgQdvk1K7ec3L",
  "status": "ACTIVE",
  "meta": {
    "proofs": [
      {
        "method": "ed25519-v2",
        "public": "YiY9jEkH3wldB7YWGvc/Ht2VgsYY7JU2OSSaE7DvtYw=",
        "digest": "a582c1c9291af482a62d42968ef706ec147251c241a6038f96414b7070945211",
        "result": "qmKq/QPha6DhK09TjV/SSD93ShsZDO4f2rM0WBG553JNNRJgarQMwU8xNcsz3aR+Py6HXh1s1tPqpFfo95y8Aw==",
        "custom": {
          "status": "ACTIVE",
          "moment": "2025-12-10T15:19:42.977Z"
        }
      }
    ],
    "labels": []
  }
}
```

**Campos importantes en la respuesta:**

- `data.handle`: Handle de la llave dinámica (generado o proporcionado)
- `data.schema`: Schema del anchor (`dynamic-keys`)
- `data.wallet`, `data.target`, `data.amount`, `data.symbol`: Estructura del anchor
- `data.custom`: Datos del destinatario y configuración (firstName, lastName, expiresIn, etc.)
- `status`: Estado del anchor (ACTIVE)

---

## Endpoints de la API

### Crear Método de Pago

**Endpoint**: `POST {baseUrl}/api/v2/anchors`

**Descripción**: Crea un nuevo método de pago (QR Code o Llave Dinámica) en el Minka Ledger.

**Autenticación**: Requerida (JWT token del Ledger)

**Request Body**:

```json
{
  "data": {
    "handle": "QR-1770165971295-69io7s",
    "schema": "qr-code",
    "amount": "10000",
    "symbol": { "handle": "cop" },
    "target": {
      "handle": "<account-type>:<account-number>@<bank-domain>",
      "custom": {...}
    },
    "custom": {
      // ... configuración del método de pago
    }
  },
  "meta": {
    "labels": [],
    "proofs": []
  }
}
```

**Response**: `201 Created`

**Ejemplo de Respuesta para QR Code:**

```json
{
  "data": {
    "handle": "QR-1770165971295-69io7s",
    "schema": "qr-code",
    "amount": "10000",
    "symbol": { "handle": "cop" },
    "target": {
      "handle": "<account-type>:<account-number>@<bank-domain>",
      "custom": {
        "aliasType": "MERCHANTID",
        "aliasValue": "<alias-value>",
        "merchantCode": "<merchant-code>",
        "categoryCode": "<category-code>",
        "countryCode": "CO",
        "name": "<merchant-name>",
        "city": "<city>",
        "postalCode": "<postal-code>",
        "documentType": "<document-type>",
        "documentNumber": "<document-number>",
        "targetSpbviCode": "<spbvi-code>"
      }
    },
    "custom": {
      "entityType": "DYNAMIC",
      "terminal": "<terminal-id>",
      "paymentReferencePurpose": "COMPRAS",
      "channel": "APP",
      "channelOrigin": "<channel-origin>",
      "vatCondition": "02",
      "vat": "0",
      "vatBase": "0",
      "incCondition": "02",
      "inc": "0",
      "expiresIn": 3600,
      "payload": "00020101021226320014CO.COM....",
      "image": "iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAklEQVR4AewaftIAABt1SURBVO3B0YrkyrYgQXdR...",
      "paymentId": "CO.COM.{RED}.TRXID260201310195479309"
    }
  },
  "hash": "784283d0b4003539b35922de31dd1bce9073b730ac73eec57d2a53616316e4fb",
  "luid": "$anc.-1R3SgQdvk1K7ec3L",
  "status": "ACTIVE",
  "meta": {
    "labels": [],
    "proofs": []
  }
}
```

**Campos importantes en la respuesta:**

- `data.custom.payload`: El payload EMVco completo del QR code generado
- `data.custom.image`: La imagen del QR code en formato Base64 PNG
- `data.custom.paymentId`: El transaction ID del Tag 90 (formato: GUID + Transaction ID concatenados sin separador)

**Ejemplo de Respuesta para Dynamic Key:**

```json
{
  "data": {
    "handle": "@MERCH-0011012001",
    "target": "target:merchant-account",
    "schema": "dynamic-keys",
    "amount": "10000",
    "symbol": { "handle": "cop" },
    "custom": {
      // ... configuración del dynamic key
    }
  },
  "hash": "...",
  "luid": "...",
  "status": "ACTIVE",
  "meta": {
    "labels": [],
    "proofs": []
  }
}
```

### Obtener Método de Pago

**Endpoint**: `GET {baseUrl}/api/v2/anchors/:id`

**Descripción**: Obtiene un método de pago existente por su handle.

**Parámetros**:

- `id` (path): Handle del anchor (QR code o llave dinámica)
- header `x-schema`=`qr-code`: Exclusivo para consultar Códigos QR

**Autenticación**: Opcional (para testing)

**Ejemplos de Uso**:

1. **Por Handle de QR Code**:

   ```
   GET {baseUrl}/api/v2/anchors/QR-1770165971295-69io7s
   ```

2. **Por Handle de Llave Dinámica**:

   ```
   GET {baseUrl}/api/v2/anchors/@MERCH-0011012001
   ```

### Deshabilitar Método de Pago

**Endpoint**: `PUT {baseUrl}/api/v2/anchors/:id`

**Descripción**: Deshabilita un método de pago existente. El método de pago quedará con estado `CANCELLED` y no podrá ser usado para nuevos pagos.

**Parámetros**:

- `id` (path): Handle del anchor (QR code o llave dinámica)

**Request Body**:

```json
{
  "data": {
    "handle": "QR-1770165971295-69io7s"
    // ... resto de datos del anchor
  },
  "hash": "...",
  "luid": "...",
  "status": "ACTIVE",
  "meta": {
    "proofs": [
      {
        "method": "ed25519-v2",
        "public": "...",
        "digest": "...",
        "result": "...",
        "custom": {
          "status": "CANCELLED",
          "moment": "2025-12-10T00:49:09.707Z"
        }
      }
    ]
  }
}
```

**Importante**: El proof debe incluir `custom.status: "CANCELLED"` para deshabilitar el método de pago.

**Response**: `200 OK`

```json
{
  "data": { ... },
  "hash": "...",
  "luid": "...",
  "status": "CANCELLED",
  "meta": {
    "proofs": [ ... ]
  }
}
```

### Referencia de errores para anchors

Errores de nivel registro del Ledger aplicados a **anchors**. Se utilizan cuando hay un problema con los registros solicitados o enviados.

Estos errores ocurren durante el procesamiento de las peticiones a la API, por lo que tienen asociado un código de estado HTTP en la respuesta.

| Razón                            | Descripción                                                                                                                                                     | Código HTTP |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `anchor.not-found`               | El anchor solicitado por handle no existe en la base de datos del Ledger.                                                                                       | 404         |
| `anchor.relation-not-found`      | El registro relacionado referenciado en el anchor recibido (`anchor.data.<relación>`) no existe en la base de datos del Ledger.                                 | 422         |
| `anchor.duplicated`              | Ya existe un anchor con el mismo handle en la base de datos del Ledger.                                                                                         | 409         |
| `anchor.schema-invalid`          | El anchor recibido no cumple el schema esperado. También se usa cuando la ruta o los parámetros de consulta de la petición no coinciden con el schema esperado. | 422         |
| `anchor.invalid`                 | El schema del anchor es correcto pero el servidor no puede procesarlo.                                                                                          | 422         |
| `anchor.drop-rejected`           | La eliminación del anchor no puede ser procesada por el servidor debido a una validación interna.                                                               | 422         |
| `anchor.labels-policy-violation` | La(s) etiqueta(s) no pueden procesarse por incumplimiento de política.                                                                                          | 422         |
| `anchor.status-policy-violation` | El/los estado(s) no pueden procesarse por incumplimiento de política.                                                                                           | 422         |
| `anchor.status-quorum-not-met`   | El cambio de estado del anchor no puede realizarse porque aún no se cumple el quórum.                                                                           | N/A         |
| `anchor.update-rejected`         | La actualización del anchor no puede ser procesada por el servidor debido a una validación interna.                                                             | 422         |

## Solución de Problemas

### Error: “Invalid schema”

**Causa**: El schema proporcionado no es válido.

**Solución**: Asegúrate de usar uno de los schemas válidos:

- `qr-code`
- `dynamic-keys`

### Error: “Missing required field”

**Causa**: Faltan campos requeridos según el schema.

**Solución**: Revisa la tabla de campos requeridos en esta documentación y asegúrate de incluir todos los campos necesarios.

### Error: “Invalid amount format”

**Causa**: El monto está en formato decimal en lugar de base 100.

**Solución**: Convierte el monto a base 100 (sin decimales). Ejemplo: 50000.00 COP = 5000000.

### Error: “Llave dinámica handle generation failed”

**Causa**: No se pudo generar el handle automáticamente porque falta `merchantCode` o `aliasValue`.

**Solución**: Asegúrate de incluir `target.merchantCode` o `target.aliasValue` en el anchor.

### Error: “QR code not found”

**Causa**: Se intentó buscar un QR code por label (payload o transaction ID) pero no existe en la base de datos.

**Solución**: Verifica que el label sea correcto (formato: `payload:xxxxx` o `paymentId:xxxxx`) y que el QR code haya sido creado previamente. Asegúrate de usar el endpoint `GET /api/v2/anchors` con el parámetro `data.custom`.

---

## Intent de seguimiento al método de pago

Cuando se crea un método de pago (código QR o llave dinámica), el sistema mantiene un **Intent** en el Ledger para dar seguimiento a ese método de pago y a las transacciones asociadas. Esta sección describe cómo se genera ese intent, cómo consultarlo y cómo se reciben las actualizaciones de estado (efectos).

### Intent generado automáticamente

- **Creación**: Al generar un método de pago (QR o llave dinámica), se crea en el Ledger un **Intent** asociado.
- **Handle del Intent**: El handle del intent se construye con dos campos obligatorios tanto en códigos QR como en llaves dinámicas:
  - **merchantCode** (código del comercio)
  - **paymentReferenceNumber** (número de referencia del pago, p. ej. número de factura)
  - **Fórmula**: `handle del intent = merchantCode + paymentReferenceNumber`
- **Campo custom `paymentArtifacts`**: En el intent se agrega un campo en `custom` (por ejemplo `paymentArtifacts`) que es una **lista de handles de anchors**. Inicialmente contiene el handle del anchor del método de pago que creó el intent.
- **Idempotencia**: Si se crea **otro** método de pago del mismo comercio y con el mismo `paymentReferenceNumber`, **no** se crea un nuevo intent. En su lugar, se agrega a la lista `paymentArtifacts` el handle del nuevo anchor creado. Así un mismo intent puede agrupar varios artifacts (varios QR o llaves dinámicas) asociados a la misma referencia de pago del mismo comercio.

Ejemplo conceptual:

- Primer método de pago: comercio `MERCH001`, referencia `FACT-2024-001` → se crea intent con handle `MERCH001FACT-2024-001` y `custom.paymentArtifacts = ["QR-1770165971295-69io7s"]`.
- Segundo método de pago: mismo comercio, misma referencia → mismo intent; se actualiza `custom.paymentArtifacts = ["QR-1770165971295-69io7s", "@MERCH-0011012001"]`.

### Consultar un Intent

Para consultar un intent en el Ledger debe usarse el siguiente endpoint:

| Operación               | Descripción                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Consultar un Intent** | Obtener un intent por su `handle`. **GET** `{baseUrl}/api/v2/intents/{handle}`. |

Para **consultar el intent de seguimiento** de un método de pago basta con conocer su handle (`merchantCode + paymentReferenceNumber`) y llamar a **Consultar un Intent** con ese handle.

**Ejemplo de respuesta (simplificado)**

La respuesta incluye `data` (con `custom.paymentArtifacts` — lista de handles de los anchors asociados), `meta` (proofs, status) y `luid`. Ejemplo simplificado mostrando el listado de anchors:

```json
{
  "hash": "a1b2c3d4e5f6...",
  "luid": "$int.xxxxxxxxxxxxx",
  "data": {
    "handle": "MERCH001FACT-2024-001",
    "claims": [
		{
			"action": "transfer",
        	"amount": <amount>,
			"symbol": {
			"handle": "cop"
			},
			"source": {
				"handle": "<source-account>",
				"custom": {...}
			},
			"target": {
				"handle": "<target-account>",
				"custom": {...}
			},
		}
	],
    "custom": {
      "paymentArtifacts": [
        "QR-1770165971295-69io7s",
        "@MERCH-0011012001"
      ]
    }
  },
  "meta": {
    "proofs": [],
    "status": "created"
  }
}
```

En `data.custom.paymentArtifacts` aparecen los handles de los métodos de pago (códigos QR o llaves dinámicas) creados para ese comercio y referencia de pago.

### Estados del Intent

El intent puede encontrarse en uno de los siguientes estados (el valor aparece en `meta.status` al consultar el intent):

| Estado        | Descripción                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pending**   | El intent fue enviado pero aún está en procesamiento. Los cambios en los datos del Ledger aún no están persistidos.                               |
| **prepared**  | El intent está preparado por todos los participantes y puede procesarse.                                                                          |
| **committed** | El intent se procesó correctamente. Los cambios en los datos del Ledger están persistidos y son irreversibles. Eventualmente pasará a completado. |
| **completed** | El intent se procesó exitosamente.                                                                                                                |
| **aborted**   | El intent fue abortado mientras estaba en estado pendiente. Eventualmente será rechazado.                                                         |
| **rejected**  | El procesamiento del intent falló. Los cambios en los datos del Ledger son rechazados y no pueden persistirse.                                    |

### Efecto de actualización de estado del Intent

Cuando el Ledger agrega una prueba (proof) a un intent —por ejemplo al pasar a **prepared** o **committed**—, envía un efecto que en este documento llamamos **efecto de actualización de estado del Intent** (equivalente al _intent-proof-added_ del Ledger). El bridge recibe ese efecto y expone endpoints para procesarlo.

**Endpoints del bridge que reciben el efecto:**

- **POST** `{webhookUrl}/api/effects/intent-proof-added` — recibe todos los proof agregados al Intent, los cuales muestran los cambios de status del mismo.

**Body del request (efecto)** que envía el Ledger y recibe el bridge:

El cuerpo puede variar según la implementación del Ledger, pero el bridge interpreta las siguientes ubicaciones (en orden de uso):

| Propósito          | Ubicación en el body           |
| ------------------ | ------------------------------ |
| Handle del intent  | `data.intent`                  |
| Estatus del intent | `data.proofs[0].custom.status` |

**Ejemplo del efecto recibido:**

```json
{
  "data": {
    "handle": "<effect-handle>",
    "intent": "<intent-handle>",
    "proofs": [
      {
        "custom": {
          "moment": "2026-02-05T00:18:26.648Z",
          "status": "<status>"
        },
        "public": "<public-key>",
        "method": "ed25519-v2",
        "digest": "<hash>",
        "result": "<base64-signature>"
      }
    ],
    "signal": "intent-proofs-added"
  },
  "hash": "<hash>",
  "meta": {
    "proofs": [
      {
        "custom": { "moment": "2026-02-05T00:18:26.961Z" },
        "public": "<public-key>",
        "method": "ed25519-v2",
        "digest": "<hash>",
        "result": "<base64-signature>"
      }
    ]
  }
}
```

## Autenticación del Bridge

En esta sección se describen los tipos de autenticación configurables actualmente soportados para las peticiones desde el Ledger hacia el Bridge. Los clientes deberán definir esta autenticación en sus webhooks para recibir las actualizaciones del Intent.

### Múltiples reglas de seguridad

Los Bridges pueden tener varias reglas de seguridad configuradas en su arreglo `secure`. Estas reglas se aplican secuencialmente en el orden en que aparecen en la configuración. Cada regla establecerá una cabecera HTTP en las peticiones salientes hacia el bridge, independientemente de si sobrescribe una cabecera ya existente.

**Importante:** Si varias reglas establecen la misma cabecera (misma clave), la última regla procesada sobrescribirá cualquier valor previo para esa cabecera. Esto permite estrategias de autenticación flexibles pero requiere considerar con cuidado el orden de las reglas.

Por ejemplo, un bridge podría usar tanto autenticación por cabecera para API keys como OAuth2 para tokens de autorización:

```json
{
  "handle": "bank1",
  "config": {
    "server": "https://example.com/v2"
  },
  "secure": [
    {
      "schema": "header",
      "key": "X-API-Key",
      "value": "{{ secret.apiKey }}"
    },
    {
      "schema": "oauth2",
      "clientId": "my-client-id",
      "clientSecret": "{{ secret.clientSecret }}",
      "tokenUrl": "https://auth.example.com/token"
    }
  ]
}
```

En este ejemplo, tanto la cabecera `X-API-Key` como la cabecera `Authorization` (proveniente de OAuth2) se incluirán en las peticiones al bridge.

### Autenticación por cabeceras HTTP

La autenticación por cabeceras HTTP permite configurar cabeceras HTTP personalizadas que se incluirán en todas las peticiones desde el Ledger al Bridge. Es útil para API keys, tokens de autenticación personalizados o cualquier otro mecanismo de autenticación basado en cabeceras.

Una regla de seguridad de tipo cabecera requiere:

- **schema**: Debe ser `"header"`.
- **key**: El nombre de la cabecera HTTP (por ejemplo, `"X-API-Key"`, `"Authorization"`).
- **value**: El valor de la cabecera, que debe ser una referencia a secreto para datos sensibles.

El valor de la cabecera debe usar referencias a secretos para garantizar que la información sensible quede cifrada. El Ledger resolverá estas referencias en el momento de la petición utilizando su almacén de secretos.

**Ejemplo de configuración de autenticación por cabecera:**

```json
{
  "handle": "payment-processor",
  "config": {
    "server": "https://api.payment-processor.com/v1"
  },
  "secure": [
    {
      "schema": "header",
      "key": "X-API-Key",
      "value": "{{ secret.processorApiKey }}"
    },
    {
      "schema": "header",
      "key": "X-Client-ID",
      "value": "{{ secret.clientIdentifier }}"
    }
  ]
}
```

Esta configuración añadirá dos cabeceras a cada petición:

- `X-API-Key`: [valor resuelto del secreto processorApiKey]
- `X-Client-ID`: [valor resuelto del secreto clientIdentifier]

**Consideraciones sobre autenticación por cabecera:**

- **Sensibilidad a mayúsculas/minúsculas:** Las claves de las cabeceras distinguen entre mayúsculas y minúsculas y se envían exactamente como se configuraron.
- **Resolución de secretos:** Los valores que usan referencias a secretos (por ejemplo, `{{ secret.myKey }}`) se resuelven desde el almacén de secretos cifrado del bridge.
- **Conflictos de cabeceras:** Si varias reglas de tipo cabecera usan la misma clave, la última regla procesada sobrescribirá los valores anteriores.
- **Cabeceras estándar:** Se puede establecer casi cualquier cabecera HTTP con excepción de algunas cabeceras sensibles por seguridad. No obstante, establecer una cabecera como `Content-Type` puede romper las peticiones al bridge o ser sobrescrita por el Ledger.

### OAuth2

Como se mencionó anteriormente, OAuth2 puede configurarse en la propiedad `secure` del bridge. Una definición OAuth2 requiere un endpoint de token que devuelva un token de acceso (no de refresco), un client id y un client secret. El client secret debe ser una referencia a secreto, donde el Ledger guardará un valor cifrado en lugar del valor en claro.

La autenticación OAuth2 añadirá automáticamente una cabecera `Authorization` con el formato `Bearer [token]` a todas las peticiones.

El endpoint de token configurado debe recibir una cabecera Basic con el valor en base64 con formato `clientId:clientSecret`, y devolver en el cuerpo de la respuesta:

- **access_token**: Valor string del token que puede ser o no un JWT.
- **expires_in**: Opcional. Tiempo restante de expiración en segundos.

El bridge debe respetar el valor que devuelve para el tiempo de expiración del token. El valor se resuelve según estas prioridades (de mayor a menor):

1. Si el token es un JWT y contiene una reclamación de expiración (`exp`), se usará el valor de `exp`.
2. Si el token no es un JWT o es un JWT que no contiene `exp`, pero el cuerpo define `expires_in`, se usará la propiedad `expires_in` del cuerpo.
3. Si el token es un JWT, no tiene `exp`, y el cuerpo no define `expires_in`, se tratará como si nunca expirara.
4. Si el token no es un JWT y el cuerpo no define `expires_in`, el token se usará solo una vez y no se almacenará en caché, porque debemos asumir que podría expirar en cualquier momento.

**Nota:** Si un bridge devuelve tokens con vida útil menor a 60 segundos, no se almacenarán en caché en el Ledger y se solicitarán antes de cada petición al Bridge.

### OAuth2 y autenticación por cabecera juntas

Al usar OAuth2 y autenticación por cabecera a la vez, tenga en cuenta que:

- Si una regla de tipo cabecera establece la cabecera `Authorization`, OAuth2 la sobrescribirá, ya que las reglas OAuth2 suelen procesarse después de las reglas de cabecera.
- Para evitar conflictos, use la autenticación por cabecera para cabeceras distintas de `Authorization` cuando la combine con OAuth2.
- El orden de procesamiento sigue el orden de las reglas en el arreglo `secure`.

**Ejemplo de autenticación combinada:**

```json
{
  "handle": "bank-integration",
  "config": {
    "server": "https://bank-api.example.com/v2"
  },
  "secure": [
    {
      "schema": "header",
      "key": "X-Institution-ID",
      "value": "{{ secret.institutionId }}"
    },
    {
      "schema": "header",
      "key": "X-Request-ID",
      "value": "ledger-bridge-request"
    },
    {
      "schema": "oauth2",
      "clientId": "bank-integration-client",
      "clientSecret": "{{ secret.oauthSecret }}",
      "tokenUrl": "https://auth.bank.example.com/oauth/token"
    }
  ]
}
```

Esta configuración dará lugar a peticiones con:

- `X-Institution-ID`: [secreto institutionId resuelto]
- `X-Request-ID`: ledger-bridge-request
- `Authorization`: Bearer [token OAuth2]

---

© 2025 Minka. Todos los derechos reservados.
