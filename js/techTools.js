/**
 * SDI IT Asset Hub - Advanced Technician Toolkit, SAM, IPAM, Staging & ITAD
 * 1. Live Camera QR / Barcode Scanner
 * 2. Software Asset & License Management (SAM)
 * 3. Network Switch & Port Allocation Visualizer (IPAM)
 * 4. 1-Click IT Diagnostic Commands Hub
 * 5. Interactive Subnet & IP Range Calculator
 * 6. PC Staging & Onboarding Checklist
 * 7. IT Asset Decommissioning & Data Sanitization (ITAD)
 * 8. Service Level Agreement (SLA) & Emergency Matrix
 */

class TechToolsManager {
  constructor() {
    this.videoStream = null;
    this.scanInterval = null;
    this.stagingSteps = [
      { id: "step1", textAr: "الفحص العيني للعتاد ولصق كود الجرد (Asset Tag Sticker)", textEn: "Physical QC & Apply Asset Tag Sticker" },
      { id: "step2", textAr: "تثبيت وتفعيل ويندوز 11 للمؤسسات (Windows 11 Enterprise x64)", textEn: "Install & Activate Windows 11 Enterprise" },
      { id: "step3", textAr: "الانضمام إلى نطاق دومين المعهد (Join SDI.AE Domain)", textEn: "Join Domain Controller (SDI.AE)" },
      { id: "step4", textAr: "تفعيل تشفير القرص بمفتاح BitLocker وحفظه بالدومين", textEn: "Enable BitLocker Drive Encryption & Save Recovery Key" },
      { id: "step5", textAr: "تثبيت برنامج AnyDesk وضبط كلمة المرور الدائمة للدعم الفني", textEn: "Configure AnyDesk Unattended Access for IT Support" },
      { id: "step6", textAr: "تثبيت مضاد الفيروسات المركزي (EDR / Defender for Endpoint)", textEn: "Install Antivirus & Central EDR Endpoint Agent" },
      { id: "step7", textAr: "تثبيت برامج معهد الشارقة (Office 365, Smart Exam, PDF Reader)", textEn: "Install SDI Core Software Suite (Office, Exam Client)" },
      { id: "step8", textAr: "تعيين طابعة رخص القيادة Fargo أو الطابعة المركزية الافتراضية", textEn: "Map Default Printer (Fargo ID Card or Central MFP)" },
      { id: "step9", textAr: "توقيع الموظف على محضر وسند استلام العهدة", textEn: "Employee Signs Handover Custody Voucher" }
    ];
  }

  // =========================================================================
  // 1. LIVE CAMERA QR & BARCODE SCANNER
  // =========================================================================
  async openScannerModal() {
    return App.openScannerModal();
  }

  stopScanner() {
    return App.closeScannerModal();
  }

  async handleBarcodeDetected(code) {
    if (!code) return;
    this.stopScanner();
    App.showToast(`تم مسح الكود بنجاح: ${code}`);

    const assets = await db.getAll("assets");
    const matched = assets.find(a => 
      (a.assetTag && a.assetTag.toLowerCase() === code.toLowerCase()) ||
      (a.serial && a.serial.toLowerCase() === code.toLowerCase()) ||
      (a.id === code)
    );

    if (matched) {
      AssetManager.viewAsset(matched.id);
    } else {
      alert(AppState.lang === 'ar' 
        ? `الكود المقروء (${code}) غير مسجل في قاعدة بيانات المعهد حالياً.` 
        : `Scanned code (${code}) not found in database.`);
    }
  }

  handleManualBarcodeSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("manualBarcodeInput");
    if (input && input.value.trim()) {
      this.handleBarcodeDetected(input.value.trim());
    }
  }

  // =========================================================================
  // 2. SOFTWARE ASSET & LICENSE MANAGEMENT (SAM)
  // =========================================================================
  async renderSoftware() {
    const tableBody = document.getElementById("softwareTableBody");
    if (!tableBody) return;

    const licenses = await db.getAll("licenses");
    const lang = AppState.lang;

    const countBadge = document.getElementById("softwareCountBadge");
    if (countBadge) countBadge.textContent = `${licenses.length}`;

    if (licenses.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-certificate empty-icon"></i>
              <h4>${lang === 'ar' ? 'لا توجد تراخيص برمجيات مسجلة' : 'No software licenses registered'}</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    licenses.forEach(lic => {
      const total = parseInt(lic.totalSeats) || 1;
      const used = parseInt(lic.usedSeats) || 0;
      const pct = Math.min(100, Math.round((used / total) * 100));
      const isExpiring = lic.notes && lic.notes.includes("قريباً");

      html += `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${lic.name}</div>
            <div class="text-muted" style="font-size: 11px;">${lic.notes || ''}</div>
          </td>
          <td><span class="category-pill">${lic.publisher || 'Microsoft'}</span></td>
          <td>${lic.licenseType}</td>
          <td style="min-width: 150px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span><strong>${used}</strong> / ${total} ${lang === 'ar' ? 'تفعيل' : 'Seats'}</span>
              <span><strong>${pct}%</strong></span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${pct > 90 ? 'fill-rose' : 'fill-cyan'}" style="width: ${pct}%;"></div>
            </div>
          </td>
          <td>
            <code style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-size: 12px;">${lic.licenseKey}</code>
            <button class="btn btn-xs btn-outline-info ms-1" onclick="App.copyText('${lic.licenseKey}', event)" title="نسخ المفتاح">
              <i class="fas fa-copy"></i>
            </button>
          </td>
          <td>
            <strong>${lic.expiryDate}</strong>
          </td>
          <td>
            <span class="badge ${isExpiring ? 'badge-danger' : 'badge-success'}">
              ${isExpiring ? I18N[lang].statusExpiringSoon : I18N[lang].statusValidLicense}
            </span>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  openAddLicenseModal() {
    const form = document.getElementById("licenseModalForm");
    if (form) form.reset();
    App.openModal("licenseModal");
  }

  async saveLicense(event) {
    if (event && event.preventDefault) event.preventDefault();
    const name = document.getElementById("formLicName")?.value.trim() || "";
    const publisher = document.getElementById("formLicPub")?.value.trim() || "";
    const licenseType = document.getElementById("formLicType")?.value || "Subscription";
    const totalSeats = parseInt(document.getElementById("formLicTotal")?.value) || 1;
    const usedSeats = parseInt(document.getElementById("formLicUsed")?.value) || 0;
    const licenseKey = document.getElementById("formLicKey")?.value.trim() || "";
    const expiryDate = document.getElementById("formLicExpiry")?.value || "";
    const notes = document.getElementById("formLicNotes")?.value.trim() || "";

    if (!name || !licenseKey) {
      alert(AppState.lang === "ar" ? "يرجى إدخال اسم البرنامج ومفتاح الترخيص" : "Please enter software name and license key");
      return;
    }

    const nextSeq = await db.getNextSequentialId("licenses");
    const license = {
      id: nextSeq,
      name,
      publisher: publisher || "Microsoft",
      licenseType,
      totalSeats,
      usedSeats,
      licenseKey,
      expiryDate: expiryDate || "2026-12-31",
      notes
    };

    if (typeof db.addLicense === "function") {
      await db.addLicense(license);
    } else {
      await db.put("licenses", license);
    }
    App.closeModal("licenseModal");
    App.showToast(AppState.lang === 'ar' ? "تم تسجيل ترخيص البرنامج بنجاح!" : "Software license saved successfully!");
    await this.renderSoftware();
  }

  // =========================================================================
  // 3. NETWORK SWITCH & PORTS VISUALIZER (IPAM)
  // =========================================================================
  async renderNetworkSwitches() {
    const container = document.getElementById("switchesVisualContainer");
    if (!container) return;

    const switches = await db.getAll("switches");
    const lang = AppState.lang;

    if (switches.length === 0) {
      container.innerHTML = `<div class="empty-state py-4"><p>لا توجد سويتشات مسجلة</p></div>`;
      return;
    }

    let html = "";
    switches.forEach(sw => {
      const activePortsCount = sw.ports ? sw.ports.length : 0;

      html += `
        <div class="switch-rack-chassis">
          <div class="switch-header">
            <div>
              <h3><i class="fas fa-network-wired text-primary"></i> ${sw.name}</h3>
              <div class="text-muted" style="font-size: 12px; margin-top: 3px;">
                ${lang === 'ar' ? 'الموديل:' : 'Model:'} <strong>${sw.model}</strong> &bull; 
                ${lang === 'ar' ? 'عنوان IP الإدارة:' : 'Management IP:'} <code>${sw.ip}</code>
              </div>
            </div>
            <div>
              <span class="badge badge-primary" style="font-size: 12px; padding: 6px 12px;">
                <i class="fas fa-plug me-1"></i> ${activePortsCount} / ${sw.totalPorts} Ports Active
              </span>
            </div>
          </div>

          <!-- Switch Port Grid RJ45 Simulator -->
          <div class="switch-ports-grid">
      `;

      for (let p = 1; p <= sw.totalPorts; p++) {
        const portInfo = sw.ports ? sw.ports.find(x => x.port === p) : null;
        const isUp = !!portInfo;

        const tooltip = isUp 
          ? `Port ${p}: ${portInfo.connectedAsset} (Tag: ${portInfo.tag || '-'} | VLAN: ${portInfo.vlan} | Speed: ${portInfo.speed || '1G'})`
          : `Port ${p}: ${lang === 'ar' ? 'منفذ متاح (فارغ)' : 'Empty / Available'}`;

        html += `
          <div class="rj45-port ${isUp ? 'port-up' : 'port-down'}" title="${tooltip}">
            <div class="port-led ${isUp ? 'led-green' : 'led-off'}"></div>
            <div class="rj45-jack">
              <div class="jack-pins"></div>
            </div>
            <span class="port-num">${p}</span>
          </div>
        `;
      }

      html += `
          </div>
          <div class="switch-footer-meta">
            <span><span class="led-indicator-dot led-green"></span> Link Active (1 Gbps)</span>
            <span><span class="led-indicator-dot led-off"></span> Empty Port</span>
            <span style="margin-inline-start: auto; color: var(--accent-cyan);">
              <i class="fas fa-layer-group me-1"></i> VLANs: 10 (Management), 20 (Staff), 30 (Smart Exam Fleet), 50 (CCTV)
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // =========================================================================
  // 4. TECHNICIAN DIAGNOSTIC TOOLKIT (1-CLICK SCRIPTS)
  // =========================================================================
  renderTechTools() {
    const container = document.getElementById("techToolsCommandsContainer");
    if (!container) return;

    const commands = [
      {
        id: "ping",
        title: "فحص الاتصال المستمر (Continuous Ping)",
        desc: "فحص استجابة الجهاز وتحديد ما إذا كان متصلاً بالشبكة حالياً ومراقبة فقدان الحزم",
        cmd: "ping 192.168.10.15 -t"
      },
      {
        id: "tracert",
        title: "تتبع مسار القفزات والراوتر (Traceroute)",
        desc: "تحديد نقطة الانقطاع بين الفروع وسيرفرات معهد الشارقة للسياقة الرئيسية",
        cmd: "tracert 192.168.10.2"
      },
      {
        id: "flushdns",
        title: "تفريغ الـ DNS وتجديد الـ IP (Flush DNS & Renew)",
        desc: "حل مشاكل تعليق الشبكة وعدم التعرف على أسماء الدومين وسيرفر الدخول",
        cmd: "ipconfig /flushdns && ipconfig /release && ipconfig /renew"
      },
      {
        id: "serial",
        title: "استخراج السيريال والـ BIOS عبر PowerShell",
        desc: "أمر فوري للحصول على الرقم التسلسلي لجهاز الحاسوب وطراز اللوحة الأم دون فتح الصندوق",
        cmd: "powershell \"Get-CimInstance Win32_BIOS | Select-Object SerialNumber, Manufacturer, SMBIOSBIOSVersion\""
      },
      {
        id: "rdp",
        title: "فتح جلسة ريموت RDP مباشرة (Remote Desktop)",
        desc: "الاتصال المباشر عبر Remote Desktop لسطح مكتب الجهاز المستهدف",
        cmd: "mstsc /v:192.168.10.15"
      },
      {
        id: "arp",
        title: "كشف عنوان MAC للـ IP (ARP Table Query)",
        desc: "مطابقة عنوان الـ IP مع الـ MAC Address الفعلي على كرت الشبكة لاكتشاف تضارب العناوين",
        cmd: "arp -a | findstr 192.168.10.15"
      },
      {
        id: "wol",
        title: "إرسال حزمة التشغيل عن بُعد (Wake-on-LAN)",
        desc: "تشغيل أجهزة قاعات الفحص الذكي أو المكاتب المغلقة عن بعد عبر الشبكة",
        cmd: "powershell \"[System.Net.Sockets.UdpClient]::new().Send(([byte[]](,0xFF*6 + (('00-11-22-33-44-55'.Split('-') | % { [byte]('0x' + $_) }) * 16))), 102, '255.255.255.255', 9)\""
      },
      {
        id: "gpupdate",
        title: "تحديث سياسات الدومين والأمان (Group Policy Force)",
        desc: "فرض تطبيق سياسات دومين المعهد وتحديث صلاحيات الموظف فوراً",
        cmd: "gpupdate /force"
      }
    ];

    let html = `<div class="tech-tools-grid">`;
    commands.forEach(c => {
      html += `
        <div class="tool-cmd-card">
          <div class="tool-cmd-header">
            <h4><i class="fas fa-terminal text-primary"></i> ${c.title}</h4>
          </div>
          <p class="text-muted" style="font-size: 12.5px; margin: 6px 0 10px;">${c.desc}</p>
          <div class="code-snippet-box">
            <code>${c.cmd}</code>
            <button class="btn btn-xs btn-primary" onclick="App.copyText('${c.cmd.replace(/"/g, '&quot;')}', event)">
              <i class="fas fa-copy"></i> نسخ الأمر
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;
  }

  // =========================================================================
  // 5. INTERACTIVE SUBNET & IP RANGE CALCULATOR
  // =========================================================================
  calculateSubnet() {
    const ipInput = document.getElementById("subnetCalcIp") ? document.getElementById("subnetCalcIp").value.trim() : "192.168.10.1";
    const cidr = parseInt(document.getElementById("subnetCalcCidr") ? document.getElementById("subnetCalcCidr").value : "24");

    const parts = ipInput.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      alert(AppState.lang === 'ar' ? "يرجى إدخال عنوان IP صالح (مثال: 192.168.10.0)" : "Please enter a valid IP address");
      return;
    }

    // IP to 32-bit integer
    const ipInt = ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
    const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const netInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = (netInt | ~maskInt) >>> 0;

    const intToIp = (val) => [
      (val >>> 24) & 255,
      (val >>> 16) & 255,
      (val >>> 8) & 255,
      val & 255
    ].join('.');

    const netIp = intToIp(netInt);
    const broadcastIp = intToIp(broadcastInt);
    const maskIp = intToIp(maskInt);
    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = totalHosts > 2 ? totalHosts - 2 : 0;
    const firstHost = intToIp(netInt + 1);
    const lastHost = intToIp(broadcastInt - 1);

    // Update UI elements
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal("subResNetwork", netIp);
    setVal("subResBroadcast", broadcastIp);
    setVal("subResMask", maskIp);
    setVal("subResUsableRange", usableHosts > 0 ? `${firstHost}  →  ${lastHost}` : "N/A");
    setVal("subResTotalHosts", `${usableHosts} (إجمالي الحواسب المتاحة)`);
    setVal("subResCidr", `/${cidr}`);

    // Check existing assets matching this subnet
    this.checkAssetsInSubnet(netInt, maskInt);
  }

  async checkAssetsInSubnet(netInt, maskInt) {
    const listContainer = document.getElementById("subnetMatchedAssetsList");
    if (!listContainer) return;

    const assets = await db.getAll("assets");
    const matched = [];

    assets.forEach(a => {
      if (a.ip && a.ip.includes('.')) {
        const p = a.ip.split('.').map(x => parseInt(x, 10));
        if (p.length === 4 && !p.some(x => isNaN(x))) {
          const aInt = ((p[0] << 24) >>> 0) + ((p[1] << 16) >>> 0) + ((p[2] << 8) >>> 0) + (p[3] >>> 0);
          if ((aInt & maskInt) >>> 0 === netInt) {
            matched.push(a);
          }
        }
      }
    });

    if (matched.length === 0) {
      listContainer.innerHTML = `<div class="text-muted p-2" style="font-size: 12px;">لا توجد أجهزة مسجلة في هذا النطاق حالياً</div>`;
    } else {
      let html = `<div class="p-2" style="font-size: 12px;"><strong>${matched.length} أجهزة مكتشفة في هذا النطاق:</strong><ul style="margin: 6px 0 0 16px; padding: 0;">`;
      matched.forEach(m => {
        html += `<li><code>${m.ip}</code> - <strong>${m.name}</strong> (${m.assetTag || '-'}) - ${m.department || ''}</li>`;
      });
      html += `</ul></div>`;
      listContainer.innerHTML = html;
    }
  }

  // =========================================================================
  // 6. PC STAGING & ONBOARDING CHECKLIST
  // =========================================================================
  async renderStagingWorkflow() {
    const container = document.getElementById("stagingChecklistContainer");
    if (!container) return;

    const lang = AppState.lang;
    let html = "";

    this.stagingSteps.forEach((step, idx) => {
      const text = lang === 'ar' ? step.textAr : step.textEn;
      html += `
        <div class="staging-step-item" id="staging-item-${step.id}">
          <label class="custom-checkbox-container">
            <input type="checkbox" id="chk-${step.id}" onchange="TechTools.updateStagingProgress()">
            <span class="checkmark"></span>
            <div class="staging-step-desc">
              <span class="staging-step-badge">${idx + 1}</span>
              <strong>${text}</strong>
            </div>
          </label>
        </div>
      `;
    });

    container.innerHTML = html;
    this.updateStagingProgress();

    // Populate Asset selector in Staging Form
    const select = document.getElementById("stagingAssetSelect");
    if (select) {
      const assets = await db.getAll("assets");
      let opts = `<option value="">-- ${lang === 'ar' ? 'اختر الجهاز الجاري تجهيزه' : 'Select Target Device'} --</option>`;
      assets.filter(a => a.category === 'catDesktop' || a.category === 'catLaptop').forEach(a => {
        opts += `<option value="${a.id}">[${a.assetTag}] ${a.name} - ${a.serial || ''}</option>`;
      });
      select.innerHTML = opts;
    }
  }

  updateStagingProgress() {
    let checkedCount = 0;
    this.stagingSteps.forEach(step => {
      const chk = document.getElementById(`chk-${step.id}`);
      if (chk && chk.checked) checkedCount++;
    });

    const total = this.stagingSteps.length;
    const pct = Math.round((checkedCount / total) * 100);

    const bar = document.getElementById("stagingProgressBar");
    if (bar) bar.style.width = `${pct}%`;

    const label = document.getElementById("stagingProgressText");
    if (label) label.textContent = `${checkedCount} / ${total} خطوات مكتملة (${pct}%)`;

    const signoffBtn = document.getElementById("stagingPrintBtn");
    if (signoffBtn) {
      signoffBtn.disabled = checkedCount < 5;
    }
  }

  printStagingSignoff() {
    const assetSelect = document.getElementById("stagingAssetSelect");
    const techName = document.getElementById("stagingTechName") ? document.getElementById("stagingTechName").value : "فني الحاسوب المعتمد";
    const employeeName = document.getElementById("stagingEmpName") ? document.getElementById("stagingEmpName").value : "الموظف المستلم";
    const dateStr = new Date().toLocaleDateString('ar-AE');

    let assetName = "كمبيوتر مكتبي جديد";
    let assetTag = "SDI-PC-2024-XXX";
    if (assetSelect && assetSelect.selectedOptions.length > 0 && assetSelect.value) {
      const text = assetSelect.selectedOptions[0].text;
      assetName = text;
      assetTag = text.split(']')[0].replace('[', '');
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>محضر تجهيز وتسليم جهاز حاسوب | معهد الشارقة للسياقة</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1e293b; direction: rtl; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0; font-size: 22px; color: #0891b2; }
          .header h3 { margin: 4px 0 0; font-size: 14px; color: #64748b; font-weight: normal; }
          .meta-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px; }
          .steps-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
          .steps-table th, .steps-table td { border: 1px solid #cbd5e1; padding: 8px 12px; }
          .steps-table th { background: #f1f5f9; text-align: right; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; text-align: center; font-size: 14px; }
          .sig-line { margin-top: 50px; border-top: 1px dashed #94a3b8; padding-top: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>معهد الشارقة للسياقة - إدارة تكنولوجيا المعلومات</h1>
          <h3>قسم الدعم الفني وهندسة النظم &bull; محضر فحص وتجهيز جهاز حاسوب (IT Staging Sign-off)</h3>
        </div>

        <div class="meta-box">
          <div><strong>الجهاز وكود الجرد:</strong> ${assetName}</div>
          <div><strong>تاريخ التجهيز:</strong> ${dateStr}</div>
          <div><strong>الفني المنفذ للتجهيز:</strong> ${techName}</div>
          <div><strong>الموظف المستلم للعهدة:</strong> ${employeeName}</div>
        </div>

        <table class="steps-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>خطوة الفحص والتهيئة الفنية</th>
              <th style="width: 100px; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${this.stagingSteps.map((s, i) => `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>${s.textAr}</td>
                <td style="text-align: center; color: #059669; font-weight: bold;">✔ مكتمل ومعتمد</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="font-size: 12px; color: #475569;">
          * يقر الفني المعتمد بأنه قد تم فحص وتثبيت كافة الأنظمة وتشفير القرص ومطابقة مواصفات أمان معهد الشارقة للسياقة وحكومة الشارقة الرقمية بنجاح.
        </p>

        <div class="signatures">
          <div>
            <div>توقيع فني تكنولوجيا المعلومات:</div>
            <div class="sig-line">${techName}</div>
          </div>
          <div>
            <div>توقيع الموظف المستلم للجهاز:</div>
            <div class="sig-line">${employeeName}</div>
          </div>
        </div>

        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // =========================================================================
  // 7. IT ASSET DECOMMISSIONING & DATA SANITIZATION (ITAD)
  // =========================================================================
  async renderDecommissioning() {
    const tableBody = document.getElementById("decomTableBody");
    if (!tableBody) return;

    const assets = await db.getAll("assets");
    const retired = assets.filter(a => a.status === "statusRetired");
    const lang = AppState.lang;

    if (retired.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-recycle empty-icon"></i>
              <h4>لا توجد أجهزة مكهنة أو متلفة حالياً</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    retired.forEach(a => {
      html += `
        <tr>
          <td>
            <strong>${a.assetTag}</strong>
            <div class="text-muted" style="font-size: 11px;">${a.name}</div>
          </td>
          <td>${a.serial || '-'}</td>
          <td><span class="badge badge-danger">مكهن / خارج الخدمة</span></td>
          <td>${a.notes || 'انتهاء العمر الافتراضي وتكهين رسمي'}</td>
          <td><strong>NIST SP 800-88 Compliant</strong></td>
          <td>
            <button class="btn btn-xs btn-outline-info" onclick="TechTools.printDecomCertificate('${a.id}')">
              <i class="fas fa-print me-1"></i> طباعة شهادة الإتلاف
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  async printDecomCertificate(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>شهادة تكهين وإتلاف أصل إلكتروني | معهد الشارقة للسياقة</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #0f172a; direction: rtl; line-height: 1.6; }
          .cert-border { border: 4px double #0891b2; padding: 30px; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { color: #0891b2; margin: 0; font-size: 24px; }
          .header h3 { color: #475569; margin: 5px 0 0; font-size: 14px; font-weight: normal; }
          .cert-title { text-align: center; margin: 20px 0; font-size: 18px; font-weight: 700; color: #dc2626; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
          .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
          .info-table th, .info-table td { border: 1px solid #cbd5e1; padding: 10px; }
          .info-table th { background: #f8fafc; width: 30%; text-align: right; }
          .compliance-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px; border-radius: 6px; font-size: 12px; margin: 20px 0; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; font-size: 13px; }
          .sig-line { margin-top: 40px; border-top: 1px dashed #94a3b8; padding-top: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="cert-border">
          <div class="header">
            <h1>معهد الشارقة للسياقة</h1>
            <h3>إدارة تكنولوجيا المعلومات &bull; وحدة الأصول الرقمية والأمن السيبراني</h3>
          </div>

          <div class="cert-title">شهادة رسمية لإتلاف وتكهين أصل إلكتروني وتطهير البيانات (ITAD Certificate)</div>

          <p style="font-size: 13px;">
            تشهد إدارة تكنولوجيا المعلومات بمعهد الشارقة للسياقة بأنه قد تم رسمياً سحب الجهاز الموضح أدناه من الخدمة وتكهينه، وتم إجراء عملية مسح آمن وتطهير للبيانات المخزنة بما يتوافق مع المعايير الحكومية المعتمدة:
          </p>

          <table class="info-table">
            <tr>
              <th>كود الجرد (Asset Tag)</th>
              <td><strong>${asset.assetTag}</strong></td>
            </tr>
            <tr>
              <th>اسم الجهاز والموديل</th>
              <td>${asset.name} (${asset.model || '-'})</td>
            </tr>
            <tr>
              <th>الرقم التسلسلي (Serial Number)</th>
              <td>${asset.serial || '-'}</td>
            </tr>
            <tr>
              <th>الفرع السابق</th>
              <td>${asset.branchId || 'الفرع الرئيسي'}</td>
            </tr>
            <tr>
              <th>سبب التكهين والإخراج من الخدمة</th>
              <td>${asset.notes || 'انتهاء العمر الافتراضي / تقادم تكنولوجي غير قابل للترقية'}</td>
            </tr>
            <tr>
              <th>معيار تطهير وسحق البيانات</th>
              <td><strong>NIST SP 800-88 Rev. 1 (Cryptographic Erase / Overwrite 3-Pass)</strong></td>
            </tr>
            <tr>
              <th>تاريخ التكهين والاعتماد</th>
              <td>${new Date().toLocaleDateString('ar-AE')}</td>
            </tr>
          </table>

          <div class="compliance-badge">
            ✔ تم التأكد من مسح كافة بيانات المعهد والعملاء وسجلات التدريب من القرص الصلب، والجهاز جاهز لإعادة التدوير الإلكتروني (E-Waste Recycling).
          </div>

          <div class="signatures">
            <div>
              <div>فني الدعم والمسح الأمني:</div>
              <div class="sig-line">فني تكنولوجيا المعلومات المعتمد</div>
            </div>
            <div>
              <div>اعتماد مدير تكنولوجيا المعلومات:</div>
              <div class="sig-line">رئيس قسم تكنولوجيا المعلومات - SDI</div>
            </div>
          </div>
        </div>

        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // =========================================================================
  // 8. SERVICE LEVEL AGREEMENT (SLA) & EMERGENCY ESCALATION
  // =========================================================================
  renderSlaMatrix() {
    const container = document.getElementById("slaMatrixContainer");
    if (!container) return;

    const matrix = [
      {
        level: "P1",
        nameAr: "حرج وفوري (Critical Outage)",
        time: "15 دقيقة",
        desc: "توقف سيارات الفحص الذكي في مضمار الاختبار، أو تعطل خادم نظام الفحص النظري للطلاب",
        badge: "badge-danger",
        contact: "+971 6 538 2000 (تحويلة طوارئ السيرفرات: 101)"
      },
      {
        level: "P2",
        nameAr: "عالي الأولوية (High Priority)",
        time: "ساعة واحدة",
        desc: "عطل طابعات رخص القيادة Fargo، أو توقف كاونترات خدمة المتعاملين والتسجيل",
        badge: "badge-warning",
        contact: "+971 6 538 2000 (تحويلة الفني المناوب: 105)"
      },
      {
        level: "P3",
        nameAr: "متوسط الأولوية (Medium Priority)",
        time: "4 ساعات",
        desc: "أعطال حواسيب الموظفين الإدارية، شاشات العرض الذكية في قاعات التدريس، أجهزة البصمة",
        badge: "badge-info",
        contact: "نظام تذاكر الدعم الفني الداخلي"
      },
      {
        level: "P4",
        nameAr: "منخفض / روتيني (Low Priority)",
        time: "24 ساعة",
        desc: "تثبيت برمجيات جديدة، ترقية ملحقات الحواسيب (RAM / SSD)، استبدال الأسلاك",
        badge: "badge-secondary",
        contact: "طلب دعم مجدول مسبقاً"
      }
    ];

    let html = `<div class="sla-cards-grid">`;
    matrix.forEach(m => {
      html += `
        <div class="sla-card">
          <div class="sla-card-header">
            <span class="badge ${m.badge}">${m.level}</span>
            <div class="sla-time-badge"><i class="fas fa-stopwatch me-1"></i> استجابة خلال ${m.time}</div>
          </div>
          <h4 style="margin: 10px 0 6px;">${m.nameAr}</h4>
          <p class="text-muted" style="font-size: 12.5px; line-height: 1.5;">${m.desc}</p>
          <div style="font-size: 11.5px; color: var(--accent-cyan); margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
            <i class="fas fa-phone-alt me-1"></i> ${m.contact}
          </div>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;
  }
}

// Global TechTools Instance
const TechTools = new TechToolsManager();
window.TechTools = TechTools;
window.TechToolsManager = TechTools;
window.TechToolsController = TechTools;
