/**
 * SDI IT Asset Hub - Initial Seed to Supabase Cloud Database
 */
const https = require('https');

const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

function supabaseInsert(table, records) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(records);
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[PASS] ${table}: Inserted ${records.length} records (Status ${res.statusCode})`);
          resolve(true);
        } else {
          console.error(`[FAIL] ${table}: Status ${res.statusCode} - ${body}`);
          reject(new Error(`Supabase rejected ${table} import with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[ERROR] ${table}:`, err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function runSeed() {
  if (process.env.SDI_APPROVED_DATA_IMPORT !== "true") {
    console.error("Seed script disabled. Import only approved real records with SDI_APPROVED_DATA_IMPORT=true.");
    process.exitCode = 1;
    return;
  }
  console.log('=== Importing approved SDI data into Supabase Cloud ===');

  // 1. Departments
  const departments = [
    { id: "dept-it", code: "IT", name_ar: "تقنية المعلومات", name_en: "IT Department", manager_name: "م. أحمد الشامسي" },
    { id: "dept-admin", code: "ADM", name_ar: "الشؤون الإدارية والموارد البشرية", name_en: "Administration & HR", manager_name: "فاطمة الزعابي" },
    { id: "dept-cs", code: "CS", name_ar: "خدمة العملاء والتسجيل", name_en: "Customer Service & Registration", manager_name: "مريم الحمادي" },
    { id: "dept-exam", code: "EXM", name_ar: "قاعات الفحص النظري والذكي", name_en: "Examination Labs", manager_name: "سلطان القاسمي" },
    { id: "dept-fleet", code: "FLT", name_ar: "أسطول سيارات الفحص الذكي", name_en: "Smart Fleet Operations", manager_name: "خالد الطنيجي" },
    { id: "dept-finance", code: "FIN", name_ar: "الشؤون المالية والمشتريات", name_en: "Finance & Procurement", manager_name: "عبدالله المري" }
  ];
  await supabaseInsert('departments', departments);

  // 2. Locations
  const locations = [
    { id: "loc-main", parent_id: null, name_ar: "المكتب الرئيسي - الرمثاء", name_en: "Main Office - Al Ramtha", code: "HQ", type: "building" },
    { id: "loc-admin", parent_id: "loc-main", name_ar: "الشؤون الإدارية", name_en: "Administration", code: "ADM", type: "floor" },
    { id: "loc-it", parent_id: "loc-main", name_ar: "قسم تقنية المعلومات", name_en: "IT Department", code: "IT", type: "floor" },
    { id: "loc-it-office", parent_id: "loc-it", name_ar: "مكتب الدعم الفني (IT Office)", name_en: "IT Office", code: "OFC", type: "room" },
    { id: "loc-server-room", parent_id: "loc-it", name_ar: "غرفة السيرفرات (Server Room)", name_en: "Server Room", code: "SRV", type: "room" },
    { id: "loc-store", parent_id: "loc-it", name_ar: "المستودع الرئيسي (Store)", name_en: "Store", code: "STR", type: "room" },
    { id: "loc-security", parent_id: "loc-main", name_ar: "غرفة الأمن والمراقبة", name_en: "Security & CCTV", code: "SEC", type: "room" },
    { id: "loc-reception", parent_id: "loc-main", name_ar: "صالة الاستقبال وخدمة العملاء", name_en: "Reception & Customer Service", code: "REC", type: "room" },
    { id: "loc-meeting", parent_id: "loc-main", name_ar: "قاعة الاجتماعات الرئيسية", name_en: "Meeting Room", code: "MTG", type: "room" },
    { id: "loc-br-nas", parent_id: null, name_ar: "فرع الناصرية (Branch 1)", name_en: "Branch - Nasseriya", code: "NAS", type: "building" },
    { id: "loc-nas-ofc1", parent_id: "loc-br-nas", name_ar: "مكتب 1 (Office 1 - التسجيل)", name_en: "Office 1", code: "OF1", type: "room" },
    { id: "loc-nas-ofc2", parent_id: "loc-br-nas", name_ar: "مكتب 2 (Office 2 - الإدارة)", name_en: "Office 2", code: "OF2", type: "room" },
    { id: "loc-nas-store", parent_id: "loc-br-nas", name_ar: "المستودع (Store)", name_en: "Store", code: "STR", type: "room" },
    { id: "loc-br-dhd", parent_id: null, name_ar: "فرع الذيد", name_en: "Branch - Al Dhaid", code: "DHD", type: "building" },
    { id: "loc-br-khk", parent_id: null, name_ar: "فرع خورفكان", name_en: "Branch - Khorfakkan", code: "KHK", type: "building" },
    { id: "loc-br-klb", parent_id: null, name_ar: "فرع كلباء", name_en: "Branch - Kalba", code: "KLB", type: "building" }
  ];
  await supabaseInsert('locations', locations);

  // 3. Asset Types
  const assetTypes = [
    { id: "type-computer", code: "COM", name_ar: "كمبيوتر مكتبي", name_en: "Computer", has_tech_specs: true, status: "Active" },
    { id: "type-laptop", code: "LTP", name_ar: "كمبيوتر محمول", name_en: "Laptop", has_tech_specs: true, status: "Active" },
    { id: "type-monitor", code: "MON", name_ar: "شاشة عرض", name_en: "Monitor", has_tech_specs: false, status: "Active" },
    { id: "type-printer", code: "PRT", name_ar: "طابعة", name_en: "Printer", has_tech_specs: false, status: "Active" },
    { id: "type-scanner", code: "SCN", name_ar: "ماسح ضوئي", name_en: "Scanner", has_tech_specs: false, status: "Active" },
    { id: "type-camera", code: "CAM", name_ar: "كاميرا", name_en: "Camera", has_tech_specs: false, status: "Active" },
    { id: "type-tablet", code: "TAB", name_ar: "جهاز لوحي (تابلت)", name_en: "Tablet", has_tech_specs: true, status: "Active" },
    { id: "type-mobile", code: "MOB", name_ar: "هاتف ذكي", name_en: "Mobile Device", has_tech_specs: true, status: "Active" },
    { id: "type-network", code: "NET", name_ar: "جهاز شبكة (سويتش/راوتر)", name_en: "Network Device", has_tech_specs: false, status: "Active" },
    { id: "type-server", code: "SRV", name_ar: "خادم (سيرفر)", name_en: "Server", has_tech_specs: true, status: "Active" },
    { id: "type-ups", code: "UPS", name_ar: "مزود طاقة غير منقطعة (UPS)", name_en: "UPS", has_tech_specs: false, status: "Active" },
    { id: "type-other", code: "OTH", name_ar: "أخرى", name_en: "Other", has_tech_specs: false, status: "Active" }
  ];
  await supabaseInsert('asset_types', assetTypes);

  // 4. Employees
  const employees = [
    { id: "emp-101", employee_id: "SDI-1021", name_ar: "م. أحمد الشامسي", name_en: "Eng. Ahmed Al Shamsi", department_id: "dept-it", phone: "+971 6 538 2000", email: "ahmed.shamsi@sdi.ae", job_title: "مسؤول النظم والدعم الفني", status: "Active" },
    { id: "emp-102", employee_id: "SDI-1045", name_ar: "مريم الحمادي", name_en: "Maryam Al Hammadi", department_id: "dept-cs", phone: "+971 6 538 2110", email: "maryam.h@sdi.ae", job_title: "مشرفة كاونتر التسجيل", status: "Active" },
    { id: "emp-103", employee_id: "SDI-1088", name_ar: "سلطان القاسمي", name_en: "Sultan Al Qasimi", department_id: "dept-exam", phone: "+971 6 538 2200", email: "sultan.q@sdi.ae", job_title: "مسؤول قاعة الفحص النظري الذكي", status: "Active" },
    { id: "emp-104", employee_id: "SDI-1102", name_ar: "فاطمة الزعابي", name_en: "Fatima Al Zaabi", department_id: "dept-admin", phone: "+971 6 538 2300", email: "fatima.z@sdi.ae", job_title: "مسؤولة الموارد البشرية والشؤون الإدارية", status: "Active" },
    { id: "emp-105", employee_id: "SDI-1140", name_ar: "عائشة النقبي", name_en: "Aisha Al Naqbi", department_id: "dept-cs", phone: "+971 9 238 1111", email: "aisha.n@sdi.ae", job_title: "كاونتر التسجيل الرئيسي - خورفكان", status: "Active" },
    { id: "emp-106", employee_id: "SDI-1180", name_ar: "خالد الطنيجي", name_en: "Khalid Al Tunaiji", department_id: "dept-fleet", phone: "+971 6 882 3344", email: "khalid.t@sdi.ae", job_title: "مشرف فحص سيارات الذيد", status: "Active" }
  ];
  await supabaseInsert('employees', employees);

  // 5. Assets
  const assets = [
    {
      id: "ast-000001",
      asset_id: "AST-000001",
      asset_type_id: "type-computer",
      brand: "HP",
      model: "EliteDesk 800 G9",
      serial: "CZC34091KL",
      barcode_value: "AST-000001",
      qr_code_value: "AST-000001",
      status: "Assigned",
      department_id: "dept-it",
      location_id: "loc-it",
      current_employee_id: "emp-101",
      purchase_date: "2024-01-15",
      warranty_expiry: "2027-01-15",
      purchase_cost: 4500,
      notes: "محطة عمل رئيسية لمسؤول النظم والدعم الفني",
      specs: { cpu: "Intel Core i7-13700", ram: "32 GB", storage: "1 TB SSD", os: "Windows 11 Pro" }
    },
    {
      id: "ast-000002",
      asset_id: "AST-000002",
      asset_type_id: "type-laptop",
      brand: "Dell",
      model: "Latitude 5540",
      serial: "8KLR9Z3",
      barcode_value: "AST-000002",
      qr_code_value: "AST-000002",
      status: "Assigned",
      department_id: "dept-it",
      location_id: "loc-it",
      current_employee_id: "emp-101",
      purchase_date: "2024-02-10",
      warranty_expiry: "2027-02-10",
      purchase_cost: 5200,
      notes: "لابتوب متنقل مخصص لطوارئ الشبكات والفروع",
      specs: { cpu: "Intel Core i5-1345U", ram: "16 GB", storage: "512 GB SSD", os: "Windows 11 Pro" }
    },
    {
      id: "ast-000003",
      asset_id: "AST-000003",
      asset_type_id: "type-computer",
      brand: "Lenovo",
      model: "ThinkCentre M70q",
      serial: "MJ0E59AA",
      barcode_value: "AST-000003",
      qr_code_value: "AST-000003",
      status: "Assigned",
      department_id: "dept-cs",
      location_id: "loc-reception",
      current_employee_id: "emp-102",
      purchase_date: "2023-05-20",
      warranty_expiry: "2026-05-20",
      purchase_cost: 3200,
      notes: "كاونتر التسجيل الرئيسي رقم 1",
      specs: { cpu: "Intel Core i5-12400T", ram: "16 GB", storage: "512 GB SSD", os: "Windows 11 Pro" }
    },
    {
      id: "ast-000004",
      asset_id: "AST-000004",
      asset_type_id: "type-printer",
      brand: "HID Fargo",
      model: "HDP5000",
      serial: "FG904412B",
      barcode_value: "AST-000004",
      qr_code_value: "AST-000004",
      status: "Assigned",
      department_id: "dept-cs",
      location_id: "loc-reception",
      current_employee_id: "emp-102",
      purchase_date: "2023-08-12",
      warranty_expiry: "2026-08-12",
      purchase_cost: 9800,
      notes: "طابعة رخص القيادة والبطاقات الذكية",
      specs: {}
    },
    {
      id: "ast-000005",
      asset_id: "AST-000005",
      asset_type_id: "type-camera",
      brand: "Hikvision",
      model: "DS-2CD2387G2P-LSU",
      serial: "HK88921004",
      barcode_value: "AST-000005",
      qr_code_value: "AST-000005",
      status: "Assigned",
      department_id: "dept-admin",
      location_id: "loc-security",
      current_employee_id: "emp-104",
      purchase_date: "2023-09-01",
      warranty_expiry: "2026-09-01",
      purchase_cost: 1850,
      notes: "كاميرا المراقبة الرئيسية بالبوابة الإدارية",
      specs: {}
    },
    {
      id: "ast-000006",
      asset_id: "AST-000006",
      asset_type_id: "type-tablet",
      brand: "Samsung",
      model: "Galaxy Tab Active4 Pro",
      serial: "SM-T636B",
      barcode_value: "AST-000006",
      qr_code_value: "AST-000006",
      status: "Available",
      department_id: "dept-fleet",
      location_id: "loc-store",
      current_employee_id: null,
      purchase_date: "2024-03-01",
      warranty_expiry: "2026-03-01",
      purchase_cost: 2600,
      notes: "تابلت جاهز للاستخدام في الفحص الميداني الذكي",
      specs: { ram: "6 GB", storage: "128 GB" }
    },
    {
      id: "ast-000007",
      asset_id: "AST-000007",
      asset_type_id: "type-server",
      brand: "Dell",
      model: "PowerEdge R750",
      serial: "SERV99801X",
      barcode_value: "AST-000007",
      qr_code_value: "AST-000007",
      status: "Assigned",
      department_id: "dept-it",
      location_id: "loc-server-room",
      current_employee_id: "emp-101",
      purchase_date: "2023-01-10",
      warranty_expiry: "2028-01-10",
      purchase_cost: 38000,
      notes: "خادم قاعدة البيانات الرئيسي للمعهد",
      specs: { cpu: "Dual Xeon Gold 6330", ram: "128 GB ECC", storage: "4x 1.92TB NVMe RAID" }
    }
  ];
  await supabaseInsert('assets', assets);

  // 6. Maintenance Tickets
  const maintenance = [
    {
      id: "MNT-0001",
      asset_id: "AST-000004",
      problem: "انحشار بطاقات الطباعة الذكية وحاجة لتنظيف رؤوس الطباعة الحرارية",
      action_taken: "استبدال بكرة التغذية وتنظيف الرؤوس بمحلول كحولي معتمد",
      technician: "م. أحمد الشامسي",
      vendor: "ScreenCheck Support",
      maint_date: "2024-04-10",
      return_date: "2024-04-11",
      cost: 450,
      status: "Completed",
      priority: "High",
      reported_by: "مريم الحمادي"
    },
    {
      id: "MNT-0002",
      asset_id: "AST-000003",
      problem: "بطء شديد في نظام التشغيل وتوقف مفاجئ أثناء تسجيل المتدربين",
      action_taken: "فحص القرص وتحديث التعريفات وإعادة ضبط إعدادات المصنع",
      technician: "م. أحمد الشامسي",
      vendor: "Internal IT",
      maint_date: "2024-06-02",
      return_date: null,
      cost: 0,
      status: "In Progress",
      priority: "Medium",
      reported_by: "مريم الحمادي"
    }
  ];
  await supabaseInsert('maintenance', maintenance);

  // 7. System Settings
  const settings = [
    {
      id: "default",
      system_name_ar: "SDI IT Asset Hub",
      system_name_en: "SDI IT Asset Hub",
      org_name_ar: "معهد الشارقة للسياقة",
      org_name_en: "Sharjah Driving Institute",
      logo_data_url: null
    }
  ];
  await supabaseInsert('system_settings', settings);

  console.log('=== All tables populated successfully in Supabase! ===');
}

runSeed().catch((error) => {
  console.error("=== Approved data import failed; review the error before retrying ===", error);
  process.exitCode = 1;
});
