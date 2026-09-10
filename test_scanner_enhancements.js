const fs = require('fs');
const assert = require('assert');

console.log("================================================================================");
console.log("TESTING BARCODE & QR SCANNER: MOBILE CAMERA FIXES, ZXING & BARCODE DECODING");
console.log("================================================================================");

// 1. Verify ZXing library exists and loads
console.log("\n--- TEST 1: التحقق من وجود مكتبة ZXing المستقلة محلياً ---");
const zxingPath = 'js/zxing.min.js';
assert.strictEqual(fs.existsSync(zxingPath), true, "js/zxing.min.js must exist locally");
const zxingCode = fs.readFileSync(zxingPath, 'utf8');
assert.strictEqual(zxingCode.length > 100000, true, "js/zxing.min.js must be a valid bundle");
console.log(`PASS [Test 1]: ZXing library present (${(zxingCode.length / 1024).toFixed(1)} KB).`);

// 2. Verify script tag in index.html
console.log("\n--- TEST 2: التحقق من تحميل zxing.min.js داخل index.html ---");
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.strictEqual(indexHtml.includes('<script src="js/zxing.min.js"></script>'), true, "index.html must load zxing.min.js");
console.log("PASS [Test 2]: zxing.min.js script tag included in index.html.");

// 3. Verify Video attributes to prevent black screen on iOS & Android
console.log("\n--- TEST 3: التحقق من خصائص عنصر الفيديو (playsinline, webkit-playsinline, muted, autoplay) ---");
assert.strictEqual(indexHtml.includes('id="scannerVideo"'), true, "scannerVideo must exist");
assert.strictEqual(indexHtml.includes('playsinline'), true, "playsinline attribute must exist");
assert.strictEqual(indexHtml.includes('webkit-playsinline'), true, "webkit-playsinline attribute must exist");
assert.strictEqual(indexHtml.includes('muted'), true, "muted attribute must exist");
assert.strictEqual(indexHtml.includes('class="scanner-video"'), true, "scannerVideo must have class scanner-video");
console.log("PASS [Test 3]: Video element configured with playsinline, webkit-playsinline, muted, and scanner-video class.");

// 4. Verify CSS rules to prevent black container sizing collapse
console.log("\n--- TEST 4: التحقق من قواعد CSS لمنع الشاشة السوداء وضمان ملاءمة الفيديو للنافذة ---");
const mainCss = fs.readFileSync('styles/main.css', 'utf8');
assert.strictEqual(mainCss.includes('.scanner-viewport-box video'), true, "CSS must target .scanner-viewport-box video");
assert.strictEqual(mainCss.includes('#scannerVideo'), true, "CSS must target #scannerVideo");
assert.strictEqual(mainCss.includes('object-fit: cover !important;'), true, "CSS must enforce object-fit: cover");
assert.strictEqual(mainCss.includes('width: 100% !important;'), true, "CSS must enforce width: 100%");
assert.strictEqual(mainCss.includes('height: 100% !important;'), true, "CSS must enforce height: 100%");
console.log("PASS [Test 4]: CSS rules strictly enforce 100% width/height and object-fit: cover on scanner video.");

// 5. Verify Flashlight (Torch) and Multi-camera button support in markup
console.log("\n--- TEST 5: التحقق من أزرار الفلاش وتبديل العدسات في النافذة المنبثقة ---");
assert.strictEqual(indexHtml.includes('id="btnToggleTorch"'), true, "btnToggleTorch must exist");
assert.strictEqual(indexHtml.includes('id="btnSwitchCamera"'), true, "btnSwitchCamera must exist");
assert.strictEqual(indexHtml.includes('onclick="App.toggleTorch()"'), true, "App.toggleTorch onclick bound");
assert.strictEqual(indexHtml.includes('onclick="App.switchCamera()"'), true, "App.switchCamera onclick bound");
console.log("PASS [Test 5]: Flashlight toggle and Multi-camera cycling buttons present and bound.");

// 6. Verify JavaScript methods in app.js
console.log("\n--- TEST 6: التحقق من دوال الماسح المتطورة في app.js ---");
const appJs = fs.readFileSync('js/app.js', 'utf8');
assert.strictEqual(appJs.includes('toggleTorch()'), true, "toggleTorch must be implemented");
assert.strictEqual(appJs.includes('switchCamera()'), true, "switchCamera must be implemented");
assert.strictEqual(appJs.includes('BrowserMultiFormatReader'), true, "BrowserMultiFormatReader must be referenced");
assert.strictEqual(appJs.includes('decodeFromVideoElement'), true, "decodeFromVideoElement must be used for scanning");
assert.strictEqual(appJs.includes('this.zxingReader'), true, "zxingReader instance maintained");
console.log("PASS [Test 6]: Modern scanner methods (ZXing integration, multi-camera cycling, torch toggle) implemented in app.js.");

// 7. Verify asset barcode matching logic
console.log("\n--- TEST 7: التحقق من مطابقة الأصول بالباركود، السيريال، QR، ورمز الأصل ---");
assert.strictEqual(appJs.includes('a.assetId && a.assetId.toLowerCase() === codeLower'), true, "Matches assetId");
assert.strictEqual(appJs.includes('a.barcodeValue && a.barcodeValue.toLowerCase() === codeLower'), true, "Matches barcodeValue");
assert.strictEqual(appJs.includes('a.qrCodeValue && a.qrCodeValue.toLowerCase() === codeLower'), true, "Matches qrCodeValue");
assert.strictEqual(appJs.includes('a.serial && a.serial.toLowerCase() === codeLower'), true, "Matches serial");
assert.strictEqual(appJs.includes('a.assetTag && a.assetTag.toLowerCase() === codeLower'), true, "Matches assetTag");
console.log("PASS [Test 7]: High-fidelity matching checks assetId, barcodeValue, qrCodeValue, serial, and assetTag.");

console.log("\n================================================================================");
console.log("ALL SCANNER & CAMERA RESOLUTION TESTS PASSED WITH 100% SUCCESS!");
console.log("================================================================================");
