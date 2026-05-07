# Print Server — GOOJPRT PT-210 ESC/POS via COM port

A tiny Express server that receives print jobs from the React frontend
and sends raw ESC/POS bytes directly to the printer over a Bluetooth
serial (COM) port — no QZ Tray, no browser print dialog.

---

## 1. Install dependencies

```bash
cd print-server
npm install
```

> **Note:** `serialport` compiles a native addon. You need:
> - Node.js 18 or 20 (LTS)
> - Windows Build Tools (or VS C++ build tools)
>   ```
>   npm install --global --production windows-build-tools
>   ```

---

## 2. Configure your COM port

Edit **`server.js`** lines 14-16, or set environment variables:

| Variable    | Default | Description                          |
|-------------|---------|--------------------------------------|
| `PORT`      | `3001`  | HTTP port the API listens on         |
| `COM_PORT`  | `COM12` | Windows COM port of your BT printer  |
| `BAUD_RATE` | `9600`  | Match your printer's baud rate       |

Example (PowerShell):
```powershell
$env:COM_PORT="COM12"; $env:BAUD_RATE="9600"; node server.js
```

---

## 3. Start the server

```bash
node server.js
# or use --watch for auto-restart during development:
node --watch server.js
```

---

## 4. API Endpoints

### `GET /health`
Returns server info and configured COM port.

### `GET /ports`
Lists all available serial ports detected on this machine.

### `POST /print`
**Body (JSON):**
```json
{
  "productName": "Mercedes Brake Pads",
  "barcodeData":  "PROD-20240415-001"
}
```

**Success response:**
```json
{ "success": true, "message": "Printed successfully." }
```

**Error response:**
```json
{ "success": false, "error": "Cannot open COM12: ..." }
```

---

## 5. React frontend usage

See `usePrint.js` for the ready-to-use hook. Basic `fetch` example:

```js
await fetch("http://localhost:3001/print", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    productName: "Mercedes Brake Pads",
    barcodeData: "PROD-20240415-001",
  }),
});
```

---

## ESC/POS label layout

```
┌──────────────────────────┐
│   Mercedes Brake Pads    │  ← bold, double-size, centered
│                          │
│  ║║║║║║║║║║║║║║║║║║║║║  │  ← CODE128 barcode, centered
│   PROD-20240415-001      │  ← HRI text below barcode
└──────────────────────────┘
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot open COM12` | Check Device Manager; printer may be on a different COM number |
| Garbled output | Verify baud rate matches printer setting (usually 9600) |
| `node-gyp` build errors | Install VS Build Tools or run `npm i --global windows-build-tools` |
| CORS blocked | Server already sets `Access-Control-Allow-Origin: *` via `cors` package |
