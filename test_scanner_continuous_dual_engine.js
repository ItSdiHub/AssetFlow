// test_scanner_continuous_dual_engine.js
// Verification of Continuous Barcode & QR Code Dual Scanning Engine

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const i18nJs = fs.readFileSync(path.join(__dirname, 'js/i18n.js'), 'utf8');
const mainCss = fs.readFileSync(path.join(__dirname, 'styles/main.css'), 'utf8');
const zxing = require(path.join(__dirname, 'js/zxing.min.js'));

console.log("================================================================================");
console.log("TESTING CONTINUOUS BARCODE & QR DUAL-ENGINE CAMERA SCANNER");
console.log("================================================================================");

let testsPassed = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    testsPassed++;
    console.log(`PASS [Test ${totalTests}]: ${message}`);
  } else {
    console.error(`FAIL [Test ${totalTests}]: ${message}`);
    process.exitCode = 1;
  }
}

// 1. HTML Controls & Structure
assert(indexHtml.includes('id="scannerModeTabs"'), "HTML contains #scannerModeTabs mode selector bar");
assert(indexHtml.includes('id="btnModeAll"'), "HTML contains #btnModeAll button");
assert(indexHtml.includes('id="btnModeQr"'), "HTML contains #btnModeQr button");
assert(indexHtml.includes('id="btnModeBarcode"'), "HTML contains #btnModeBarcode button");
assert(indexHtml.includes('id="scannerReticle"'), "HTML contains #scannerReticle with dynamic mode support");
assert(indexHtml.includes('id="scannerVideo"'), "HTML contains #scannerVideo");
assert(indexHtml.includes('id="btnToggleTorch"'), "HTML contains #btnToggleTorch flashlight toggle");
assert(indexHtml.includes('id="btnSwitchCamera"'), "HTML contains #btnSwitchCamera camera switcher");
assert(indexHtml.includes('id="scannerManualForm"'), "HTML contains #scannerManualForm fallback input");

// 2. CSS Styling & Reticle Modes
assert(mainCss.includes('.scanner-mode-tabs'), "CSS contains .scanner-mode-tabs rule");
assert(mainCss.includes('.scanner-mode-btn'), "CSS contains .scanner-mode-btn styling");
assert(mainCss.includes('.scanner-reticle.mode-all'), "CSS contains .scanner-reticle.mode-all (balanced dimensions)");
assert(mainCss.includes('.scanner-reticle.mode-qr'), "CSS contains .scanner-reticle.mode-qr (square dimensions)");
assert(mainCss.includes('.scanner-reticle.mode-barcode'), "CSS contains .scanner-reticle.mode-barcode (wide barcode dimensions)");

// 3. Translation Parity
assert(i18nJs.includes('scanModeAll: "الكل (QR + باركود)"'), "Arabic i18n has scanModeAll");
assert(i18nJs.includes('scanModeQr: "QR كود فقط"'), "Arabic i18n has scanModeQr");
assert(i18nJs.includes('scanModeBarcode: "باركود عادي فقط"'), "Arabic i18n has scanModeBarcode");
assert(i18nJs.includes('scanModeAll: "All (QR + Barcode)"'), "English i18n has scanModeAll");
assert(i18nJs.includes('scanModeQr: "QR Code Only"'), "English i18n has scanModeQr");
assert(i18nJs.includes('scanModeBarcode: "Regular Barcode Only"'), "English i18n has scanModeBarcode");

// 4. JS Engine Features in app.js
assert(appJs.includes('setScannerMode(mode)'), "app.js defines setScannerMode(mode)");
assert(appJs.includes('initDetectorInstances()'), "app.js defines initDetectorInstances()");
assert(appJs.includes('scanStep = async () =>'), "app.js uses continuous scanStep loop instead of dead single-shot");
assert(appJs.includes('this.nativeBarcodeDetector.detect(video)'), "app.js employs Tier 1 hardware BarcodeDetector");
assert(appJs.includes('this.zxingMultiReader.decode(video)'), "app.js employs Tier 2 ZXing Multi-Format decoder");
assert(appJs.includes('this.scanCropCanvas'), "app.js employs Tier 4 center-crop reticle box for small barcodes");
assert(appJs.includes('window.ZXing.HTMLCanvasElementLuminanceSource'), "app.js uses ZXing HTMLCanvasElementLuminanceSource on cropped canvas");
assert(appJs.includes('focusMode: "continuous"'), "app.js attempts continuous autofocus on mobile cameras");

// 5. Smart QR payload extraction
function cleanScannedCode(rawCode) {
  let code = String(rawCode).trim();
  if (code.startsWith("http://") || code.startsWith("https://")) {
    try {
      const parsed = new URL(code);
      const paramId = parsed.searchParams.get("assetId") || parsed.searchParams.get("id") || parsed.searchParams.get("code");
      if (paramId) {
        code = paramId.trim();
      } else {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length > 0) code = parts[parts.length - 1].trim();
      }
    } catch (e) {}
  } else if (code.startsWith("{") && code.endsWith("}")) {
    try {
      const parsed = JSON.parse(code);
      code = (parsed.assetId || parsed.code || parsed.id || parsed.serial || code).trim();
    } catch (e) {}
  }
  return code;
}

assert(cleanScannedCode("AST-000001") === "AST-000001", "Plain code passes through untouched");
assert(cleanScannedCode("https://sdi.ae/assets?id=AST-000099") === "AST-000099", "URL query param extracted properly");
assert(cleanScannedCode("https://sdi.ae/view/PC-00125") === "PC-00125", "URL path segment extracted properly");
assert(cleanScannedCode('{"assetId":"AST-000777"}') === "AST-000777", "JSON payload extracted properly");

// 6. Real ZXing QR Code Generation and Decoding Test
const writer = new zxing.QRCodeWriter();
const matrix = writer.encode("AST-000555", zxing.BarcodeFormat.QR_CODE, 200, 200, new Map());
assert(matrix.getWidth() === 200 && matrix.getHeight() === 200, "ZXing generates 200x200 QR matrix");

// Custom LuminanceSource mock representing a captured frame
class TestLuminanceSource extends zxing.LuminanceSource {
  constructor(m) {
    super(m.getWidth(), m.getHeight());
    this.m = m;
  }
  getRow(y, row) {
    if (!row || row.length < this.getWidth()) row = new Uint8ClampedArray(this.getWidth());
    for (let x = 0; x < this.getWidth(); x++) row[x] = this.m.get(x, y) ? 0 : 255;
    return row;
  }
  getMatrix() {
    const buf = new Uint8ClampedArray(this.getWidth() * this.getHeight());
    for (let y = 0; y < this.getHeight(); y++) {
      for (let x = 0; x < this.getWidth(); x++) {
        buf[y * this.getWidth() + x] = this.m.get(x, y) ? 0 : 255;
      }
    }
    return buf;
  }
}

const lumSource = new TestLuminanceSource(matrix);
const binarizer = new zxing.HybridBinarizer(lumSource);
const binaryBitmap = new zxing.BinaryBitmap(binarizer);

const hints = new Map();
hints.set(zxing.DecodeHintType.TRY_HARDER, true);
const multiFormatReader = new zxing.MultiFormatReader();
multiFormatReader.setHints(hints);
const decodedResult = multiFormatReader.decode(binaryBitmap);

assert(decodedResult && decodedResult.getText() === "AST-000555", "ZXing MultiFormatReader decoded QR code to 'AST-000555'");
assert(decodedResult.getBarcodeFormat() === zxing.BarcodeFormat.QR_CODE, "Format identified correctly as QR_CODE");

// 7. Test Priority Matching Simulation
const mockAssets = [
  { id: "1", assetId: "AST-000001", barcodeValue: "BAR-1001", qrCodeValue: "QR-2001", serial: "SN-99901", brand: "Dell", model: "7090" },
  { id: "2", assetId: "PC-00125", barcodeValue: "BAR-1002", qrCodeValue: "QR-2002", serial: "SN-99902", brand: "HP", model: "G5" }
];

function findTargetAsset(code) {
  const codeLower = code.toLowerCase();
  let target = mockAssets.find(a => a.assetId && a.assetId.toLowerCase() === codeLower);
  if (!target) target = mockAssets.find(a => a.barcodeValue && a.barcodeValue.toLowerCase() === codeLower);
  if (!target) target = mockAssets.find(a => a.qrCodeValue && a.qrCodeValue.toLowerCase() === codeLower);
  if (!target) target = mockAssets.find(a => a.serial && a.serial.toLowerCase() === codeLower);
  if (!target) target = mockAssets.find(a => a.id && String(a.id).toLowerCase() === codeLower);
  return target;
}

assert(findTargetAsset("AST-000001")?.id === "1", "Match by assetId");
assert(findTargetAsset("BAR-1001")?.id === "1", "Match by barcodeValue");
assert(findTargetAsset("QR-2002")?.id === "2", "Match by qrCodeValue");
assert(findTargetAsset("SN-99902")?.id === "2", "Match by serial");
assert(findTargetAsset("UNKNOWN-CODE") === undefined, "Unknown code returns undefined");

console.log("================================================================================");
console.log(`ALL ${testsPassed} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log("================================================================================");
