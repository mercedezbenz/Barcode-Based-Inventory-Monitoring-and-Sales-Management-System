/**
 * print-server/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Local Express API — sends ESC/POS bytes directly to a
 * GOOJPRT PT-210 Bluetooth thermal printer via a Windows COM port.
 *
 * No QZ Tray. No browser print dialog. Pure serial.
 *
 * Start : node server.js
 * Port  : 5000  (override with PORT env var)
 * COM   : COM10 (override with COM_PORT env var)
 *
 * Example:
 *   $env:COM_PORT="COM12"; node server.js
 */

const express    = require("express");
const cors       = require("cors");
const { SerialPort } = require("serialport");

// ─── Configuration ────────────────────────────────────────────────────────────
const PORT     = process.env.PORT      || 5000;
const COM_PORT = process.env.COM_PORT  || "COM10";
const BAUD     = Number(process.env.BAUD_RATE) || 9600;

// ─── ESC/POS constants ────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

// ─── ESC/POS label builder ────────────────────────────────────────────────────

/**
 * Build a complete print job Buffer for one label.
 *
 * Layout:
 *   [centered, bold 2× text]  Product Name
 *   [CODE128 barcode]
 *   [HRI text below barcode]
 *   [3 feed lines + partial cut]
 *
 * @param {string} productName
 * @param {string} barcodeData
 * @returns {Buffer}
 */
function buildPrintJob(productName, barcodeData) {
  const parts = [];

  // ── Init ─────────────────────────────────────────────────────────────────
  parts.push(buf([ESC, 0x40]));           // ESC @ — initialize printer

  // ── Center alignment ─────────────────────────────────────────────────────
  parts.push(buf([ESC, 0x61, 0x01]));     // ESC a 1 — center

  // ── Bold ON + double width/height ────────────────────────────────────────
  parts.push(buf([ESC, 0x45, 0x01]));     // bold on
  parts.push(buf([GS,  0x21, 0x11]));     // double width + double height

  // ── Product name ─────────────────────────────────────────────────────────
  parts.push(Buffer.from(productName, "ascii"));
  parts.push(buf([0x0a]));               // LF

  // ── Normal size + bold OFF ────────────────────────────────────────────────
  parts.push(buf([GS,  0x21, 0x00]));
  parts.push(buf([ESC, 0x45, 0x00]));

  // ── Blank line gap ───────────────────────────────────────────────────────
  parts.push(buf([0x0a]));

  // ── CODE128 barcode ──────────────────────────────────────────────────────
  parts.push(buf([GS, 0x68, 80]));        // GS h 80  — barcode height 80 dots
  parts.push(buf([GS, 0x77,  3]));        // GS w 3   — module width
  parts.push(buf([GS, 0x48, 0x02]));      // GS H 2   — HRI below barcode
  parts.push(buf([GS, 0x66, 0x00]));      // GS f 0   — HRI font A

  // GS k 73 <len> <data>  — CODE128 (length-prefixed variant)
  const barcodeBytes = Buffer.from(barcodeData, "ascii");
  parts.push(buf([GS, 0x6b, 73, barcodeBytes.length]));
  parts.push(barcodeBytes);

  // ── Feed + partial cut ───────────────────────────────────────────────────
  parts.push(buf([0x0a, 0x0a, 0x0a]));   // 3 blank lines
  parts.push(buf([GS, 0x56, 0x01]));     // GS V 1 — partial cut

  return Buffer.concat(parts);
}

/** Shorthand: number[] → Buffer */
function buf(arr) { return Buffer.from(arr); }

// ─── Serial port writer ───────────────────────────────────────────────────────

/**
 * Open the COM port, write the buffer, drain, then close.
 * Returns a Promise that resolves when the print job is fully sent.
 */
function writeToPort(data) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: COM_PORT, baudRate: BAUD, autoOpen: false });

    port.open((openErr) => {
      if (openErr) {
        return reject(new Error(
          `Cannot open ${COM_PORT}: ${openErr.message}\n` +
          `Check Device Manager to confirm the COM port number.`
        ));
      }

      port.write(data, (writeErr) => {
        if (writeErr) {
          port.close();
          return reject(new Error(`Write error: ${writeErr.message}`));
        }

        port.drain((drainErr) => {
          port.close();
          if (drainErr) return reject(new Error(`Drain error: ${drainErr.message}`));
          resolve();
        });
      });
    });

    port.on("error", (e) => reject(new Error(`SerialPort: ${e.message}`)));
  });
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());                  // allow fetch() from React (localhost:3000)
app.use(express.json());

// ── GET /health — liveness probe (React uses this to show Online/Offline) ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", comPort: COM_PORT, baudRate: BAUD, port: PORT });
});

// ── GET /ports — list all serial ports detected on this machine ─────────────
app.get("/ports", async (_req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /print ──────────────────────────────────────────────────────────────
// Body: { productName: string, barcodeData: string }
app.post("/print", async (req, res) => {
  const { productName, barcodeData } = req.body ?? {};

  if (!productName || !barcodeData) {
    return res.status(400).json({
      success: false,
      error: "Both 'productName' and 'barcodeData' are required.",
    });
  }

  try {
    const job = buildPrintJob(String(productName), String(barcodeData));
    await writeToPort(job);
    console.log(`[PRINT OK]  "${productName}"  →  ${barcodeData}`);
    res.json({ success: true, message: "Printed successfully." });
  } catch (err) {
    console.error(`[PRINT ERR] ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🖨  ESC/POS Print Server  →  http://localhost:${PORT}`);
  console.log(`   COM Port  : ${COM_PORT}`);
  console.log(`   Baud Rate : ${BAUD}`);
  console.log("   Endpoints :");
  console.log("     POST /print   — send a label to the printer");
  console.log("     GET  /health  — check if server is running");
  console.log("     GET  /ports   — list all detected COM ports");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
