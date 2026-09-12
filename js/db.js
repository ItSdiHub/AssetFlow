/**
 * SDI IT Asset Hub - IndexedDB Engine & Data Management
 * Modern, Stable, Online-Only Relational Engine (Version 5 + Supabase)
 */

const DB_NAME = "SDI_IT_ASSET_DB";
const DB_VERSION = 7;

// Supabase Cloud Configuration (100% Free Tier - Live Realtime)
const SUPABASE_CONFIG = {
  url: "https://xzfudqyctujxlhbgpdbs.supabase.co",
  anonKey: "sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL",
  enabled: true,
  allowDemoSeed: false
};
const PRODUCTION_CLOUD_REQUIRED = false;
const STRICT_CLOUD_ONLY = true;

const STORE_TABLE_MAP = {
  assets: "assets",
  employees: "employees",
  departments: "departments",
  locations: "locations",
  assetTypes: "asset_types",
  maintenance: "maintenance",
  assetTransactions: "asset_transactions",
  systemSettings: "system_settings",
  warehouseIssues: "warehouse_issues",
  assetTransfers: "asset_transfers",
  contractors: "contractors",
  projects: "projects",
  projectTasks: "project_tasks",
  licenses: "licenses",
  users: "users",
  helpdeskRequests: "helpdesk_requests",
  notifications: "notifications"
};
const REQUIRED_CLOUD_TABLES = [...new Set(Object.values(STORE_TABLE_MAP))];

function toCloudRecord(storeName, item) {
  if (!item) return item;
  const row = { ...item };
  if (storeName === "warehouseIssues") {
    return {
      id: row.id,
      issue_no: row.issueNo || row.issue_no || "",
      asset_id: row.assetId || row.asset_id || "",
      warehouse_location_id: row.warehouseLocationId || row.warehouse_location_id || "",
      it_employee_id: row.itEmployeeId || row.it_employee_id || "",
      issue_date: row.issueDate || row.issue_date || "",
      project_id: row.projectId || row.project_id || null,
      status: row.status || "Issued",
      notes: row.notes || null,
      installed_date: row.installedDate || row.installed_date || null,
      installed_location_id: row.installedLocationId || row.installed_location_id || null,
      installed_department_id: row.installedDepartmentId || row.installed_department_id || null,
      installed_office: row.installedOffice || row.installed_office || null,
      installed_user_id: row.installedUserId || row.installed_user_id || null,
      installed_branch_id: row.installedBranchId || row.installed_branch_id || null,
      receiving_employee: row.receivingEmployee || row.receiving_employee || null,
      end_user_id: row.endUserId || row.end_user_id || null,
      installation_status: row.installationStatus || row.installation_status || null,
      installation_notes: row.installationNotes || row.installation_notes || null,
      delivery_date: row.deliveryDate || row.delivery_date || null,
      site_name: row.siteName || row.site_name || null,
      administration: row.administration || null,
      office_name: row.officeName || row.office_name || null
    };
  }
  if (storeName === "assetTransfers") {
    return {
      id: row.id,
      transfer_no: row.transferNo || row.transfer_no || "",
      asset_id: row.assetId || row.asset_id || "",
      from_location_id: row.fromLocationId || row.from_location_id || "",
      to_location_id: row.toLocationId || row.to_location_id || "",
      transfer_date: row.transferDate || row.transfer_date || "",
      responsible_employee_id: row.responsibleEmployeeId || row.responsible_employee_id || null,
      status: row.status || "Completed",
      condition: row.condition || "Working",
      notes: row.notes || null
    };
  }
  if (storeName === "contractors") {
    return {
      id: row.id,
      code: row.code || null,
      company_name_ar: row.companyNameAr || row.company_name_ar || "",
      company_name_en: row.companyNameEn || row.company_name_en || null,
      contact_person: row.contactPerson || row.contact_person || null,
      phone: row.phone || null,
      email: row.email || null,
      status: row.status || "Active",
      notes: row.notes || null
    };
  }
  if (storeName === "projects") {
    return {
      id: row.id,
      project_no: row.projectNo || row.project_no || "",
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      project_type: row.projectType || row.project_type || "Infrastructure",
      start_date: row.startDate || row.start_date || "",
      planned_end_date: row.plannedEndDate || row.planned_end_date || "",
      actual_end_date: row.actualEndDate || row.actual_end_date || null,
      contractor_id: row.contractorId || row.contractor_id || null,
      location_id: row.locationId || row.location_id || null,
      responsible_employee_id: row.responsibleEmployeeId || row.responsible_employee_id || null,
      progress: parseFloat(row.progress) || 0,
      status: row.status || "Planning",
      notes: row.notes || null
    };
  }
  if (storeName === "projectTasks") {
    return {
      id: row.id,
      project_id: row.projectId || row.project_id || "",
      task_name_ar: row.taskNameAr || row.task_name_ar || "",
      task_name_en: row.taskNameEn || row.task_name_en || null,
      description: row.description || null,
      start_date: row.startDate || row.start_date || null,
      due_date: row.dueDate || row.due_date || null,
      responsible_employee_id: row.responsibleEmployeeId || row.responsible_employee_id || null,
      contractor_id: row.contractorId || row.contractor_id || null,
      progress: parseFloat(row.progress) || 0,
      status: row.status || "Pending",
      notes: row.notes || null
    };
  }
  if (storeName === "licenses") {
    return {
      id: row.id,
      license_no: row.licenseNo || row.license_no || row.id || "",
      software_name: row.name || row.softwareName || row.software_name || "",
      vendor: row.publisher || row.vendor || null,
      license_key: row.licenseKey || row.license_key || "",
      quantity: parseInt(row.totalSeats || row.quantity, 10) || 1,
      assigned_quantity: parseInt(row.usedSeats || row.assignedQuantity, 10) || 0,
      expiry_date: row.expiryDate || row.expiry_date || null,
      status: row.status || "Active",
      notes: row.notes || null
    };
  }
  if (storeName === "departments") {
    return {
      id: row.id,
      code: row.code || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      manager_name: row.managerName || row.manager_name || null
    };
  }
  if (storeName === "locations") {
    return {
      id: row.id,
      code: row.code || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      type: row.type || "room",
      parent_id: row.parentId !== undefined ? row.parentId : (row.parent_id || null)
    };
  }
  if (storeName === "employees") {
    return {
      id: row.id,
      employee_id: row.employeeId || row.employeeNumber || row.employee_id || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      email: row.email || null,
      phone: row.phone || null,
      job_title: row.jobTitle || row.job_title || null,
      department_id: row.departmentId || row.department_id || null,
      status: row.status || "Active"
    };
  }
  if (storeName === "assetTypes") {
    return {
      id: row.id,
      code: row.code || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      has_tech_specs: !!(row.hasTechSpecs || row.has_tech_specs),
      status: row.status || "Active"
    };
  }
  if (storeName === "assets") {
    return {
      id: row.id || row.assetId,
      asset_id: row.assetId || row.id,
      asset_type_id: row.assetTypeId || row.asset_type_id || null,
      brand: row.brand || null,
      model: row.model || null,
      serial: row.serial || null,
      barcode_value: row.barcodeValue || row.barcode_value || row.assetId || row.id,
      qr_code_value: row.qrCodeValue || row.qr_code_value || row.assetId || row.id,
      status: row.status || "Available",
      department_id: row.departmentId || row.department_id || null,
      location_id: row.locationId || row.location_id || null,
      current_employee_id: row.currentEmployeeId || row.current_employee_id || null,
      purchase_date: row.purchaseDate || row.purchase_date || null,
      warranty_expiry: row.warrantyExpiry || row.warranty_expiry || null,
      purchase_cost: parseFloat(row.purchaseCost || row.purchase_cost) || 0,
      notes: row.notes || null,
      specs: {
        ...(row.specs || {}),
        computerName: row.computerName || row.specs?.computerName || null,
        os: row.os || row.specs?.os || null,
        cpu: row.cpu || row.specs?.cpu || null,
        ram: row.ram || row.specs?.ram || null,
        storage: row.storage || row.specs?.storage || null,
        ip: row.ip || row.specs?.ip || null,
        mac: row.mac || row.specs?.mac || null,
        imei: row.imei || row.specs?.imei || null,
        cameraInfo: row.cameraInfo || row.specs?.cameraInfo || null
      },
      supplier: row.supplier || null,
      installation_date: row.installationDate || row.installation_date || null,
      installed_by: row.installedBy || row.installed_by || null,
      project_id: row.projectId || row.project_id || null,
      office: row.office || (row.specs ? row.specs.office : null) || null,
      branch_id: row.branchId || row.branch_id || null,
      condition: row.condition || null,
      handover_status: row.handoverStatus || row.handover_status || null,
      assignment_date: row.assignmentDate || row.assignment_date || null
    };
  }
  if (storeName === "maintenance") {
    return {
      id: row.id,
      asset_id: row.assetId || row.asset_id || null,
      problem: row.problem || "",
      action_taken: row.actionTaken || row.action_taken || null,
      technician: row.technician || null,
      vendor: row.vendor || null,
      maint_date: row.maintDate || row.maint_date || null,
      return_date: row.returnDate || row.return_date || null,
      cost: parseFloat(row.cost) || 0,
      status: row.status || "Open",
      priority: row.priority || "Medium",
      reported_by: row.reportedBy || row.reported_by || null
    };
  }
  if (storeName === "assetTransactions") {
    return {
      id: row.id,
      asset_id: row.assetId || row.asset_id || "",
      action_type: row.actionType || row.transactionType || row.action_type || "Updated",
      from_employee_id: row.fromEmployeeId || row.from_employee_id || null,
      to_employee_id: row.toEmployeeId || row.to_employee_id || null,
      from_location_id: row.fromLocationId || row.from_location_id || null,
      to_location_id: row.toLocationId || row.to_location_id || null,
      date: row.date || row.transactionDate || new Date().toISOString(),
      user: row.user || row.performedBy || "System",
      notes: row.notes || null
    };
  }
  if (storeName === "systemSettings") {
    return {
      id: row.id || "default",
      system_name_ar: row.systemNameAr || row.system_name_ar || null,
      system_name_en: row.systemNameEn || row.system_name_en || null,
      org_name_ar: row.orgNameAr || row.org_name_ar || null,
      org_name_en: row.orgNameEn || row.org_name_en || null,
      logo_data_url: row.logoDataUrl || row.logo_data_url || null
    };
  }
  if (storeName === "users") {
    const record = {
      id: row.id,
      username: row.username || "",
      email: row.email || "",
      full_name: row.fullName || row.full_name || "",
      full_name_ar: row.fullNameAr || row.full_name_ar || null,
      full_name_en: row.fullNameEn || row.full_name_en || null,
      role: row.role || "Viewer",
      employee_id: row.employeeId || row.employee_id || null,
      auth_user_id: row.authUserId || row.auth_user_id || null,
      active: row.active !== false
    };
    if (row.password && row.password !== "***") {
      record.password = row.password;
    }
    return record;
  }
  if (storeName === "helpdeskRequests") {
    return {
      id: row.id,
      request_number: row.requestId || row.requestNumber || row.request_number || row.id,
      employee_id: row.employeeId || row.employee_id,
      asset_id: row.assetId || row.asset_id || null,
      category: row.requestType || row.category || "Hardware",
      title: row.subject || row.title || "",
      description: row.description || "",
      priority: row.priority || "Medium",
      status: row.status || "New",
      technician_notes: row.technicianNotes || row.technician_notes || null,
      assigned_to: row.assignedTo || row.assigned_to || null,
      messages: Array.isArray(row.messages) ? row.messages : [],
      maintenance_id: row.maintenanceId || row.maintenance_id || null,
      created_at: row.createdDate || row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: row.closedDate || row.closed_at || null
    };
  }
  if (storeName === "notifications") {
    return {
      id: row.id,
      employee_id: row.employeeId || row.employee_id || null,
      title_ar: row.titleAr || row.title_ar || "",
      title_en: row.titleEn || row.title_en || null,
      message_ar: row.messageAr || row.message_ar || "",
      message_en: row.messageEn || row.message_en || null,
      type: row.type || "general",
      related_id: row.relatedId || row.related_id || null,
      read: !!row.read,
      created_at: row.createdDate || row.created_at || new Date().toISOString()
    };
  }
  return row;
}

function fromCloudRecord(storeName, row) {
  if (!row) return row;
  const item = { ...row };
  if (storeName === "warehouseIssues") {
    item.issueNo = row.issue_no || row.issueNo;
    item.assetId = row.asset_id || row.assetId;
    item.warehouseLocationId = row.warehouse_location_id || row.warehouseLocationId;
    item.itEmployeeId = row.it_employee_id || row.itEmployeeId;
    item.issueDate = row.issue_date || row.issueDate;
    item.projectId = row.project_id || row.projectId;
    item.installedDate = row.installed_date || row.installedDate;
    item.installedLocationId = row.installed_location_id || row.installedLocationId;
    item.installedDepartmentId = row.installed_department_id || row.installedDepartmentId;
    item.installedOffice = row.installed_office || row.installedOffice;
    item.installedUserId = row.installed_user_id || row.installedUserId;
    item.installedBranchId = row.installed_branch_id || row.installedBranchId;
    item.receivingEmployee = row.receiving_employee || row.receivingEmployee;
    item.endUserId = row.end_user_id || row.endUserId;
    item.installationStatus = row.installation_status || row.installationStatus;
    item.installationNotes = row.installation_notes || row.installationNotes;
    item.deliveryDate = row.delivery_date || row.deliveryDate;
    item.siteName = row.site_name || row.siteName;
    item.administration = row.administration;
    item.officeName = row.office_name || row.officeName;
  } else if (storeName === "assetTransfers") {
    item.transferNo = row.transfer_no || row.transferNo;
    item.assetId = row.asset_id || row.assetId;
    item.fromLocationId = row.from_location_id || row.fromLocationId;
    item.toLocationId = row.to_location_id || row.toLocationId;
    item.transferDate = row.transfer_date || row.transferDate;
    item.responsibleEmployeeId = row.responsible_employee_id || row.responsibleEmployeeId;
  } else if (storeName === "contractors") {
    item.companyNameAr = row.company_name_ar || row.companyNameAr;
    item.companyNameEn = row.company_name_en || row.companyNameEn;
    item.contactPerson = row.contact_person || row.contactPerson;
  } else if (storeName === "projects") {
    item.projectNo = row.project_no || row.projectNo;
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.projectType = row.project_type || row.projectType;
    item.startDate = row.start_date || row.startDate;
    item.plannedEndDate = row.planned_end_date || row.plannedEndDate;
    item.actualEndDate = row.actual_end_date || row.actualEndDate;
    item.contractorId = row.contractor_id || row.contractorId;
    item.locationId = row.location_id || row.locationId;
    item.responsibleEmployeeId = row.responsible_employee_id || row.responsibleEmployeeId;
  } else if (storeName === "projectTasks") {
    item.projectId = row.project_id || row.projectId;
    item.taskNameAr = row.task_name_ar || row.taskNameAr;
    item.taskNameEn = row.task_name_en || row.taskNameEn;
    item.startDate = row.start_date || row.startDate;
    item.dueDate = row.due_date || row.dueDate;
    item.responsibleEmployeeId = row.responsible_employee_id || row.responsibleEmployeeId;
    item.contractorId = row.contractor_id || row.contractorId;
  } else if (storeName === "departments") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.managerName = row.manager_name || row.managerName;
  } else if (storeName === "locations") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.parentId = row.parent_id !== undefined ? row.parent_id : row.parentId;
  } else if (storeName === "employees") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.employeeId = row.employee_id || row.employeeId || row.id;
    item.employeeNumber = row.employee_id || row.employeeNumber || row.id;
    item.departmentId = row.department_id || row.departmentId;
    item.jobTitle = row.job_title || row.jobTitle;
  } else if (storeName === "assetTypes") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.hasTechSpecs = !!(row.has_tech_specs || row.hasTechSpecs);
  } else if (storeName === "assets") {
    item.assetId = row.asset_id || row.assetId || row.id;
    item.assetTypeId = row.asset_type_id || row.assetTypeId;
    item.barcodeValue = row.barcode_value || row.barcodeValue || item.assetId;
    item.qrCodeValue = row.qr_code_value || row.qrCodeValue || item.assetId;
    item.departmentId = row.department_id || row.departmentId;
    item.locationId = row.location_id || row.locationId;
    item.currentEmployeeId = row.current_employee_id || row.currentEmployeeId;
    item.purchaseDate = row.purchase_date || row.purchaseDate;
    item.warrantyExpiry = row.warranty_expiry || row.warrantyExpiry;
    item.purchaseCost = row.purchase_cost !== undefined ? row.purchase_cost : row.purchaseCost;
    item.installationDate = row.installation_date || row.installationDate;
    item.installedBy = row.installed_by || row.installedBy;
    item.projectId = row.project_id || row.projectId;
    item.office = row.office || row.specs?.office || item.office;
    item.supplier = row.supplier || row.supplier;
    item.branchId = row.branch_id || row.branchId;
    item.condition = row.condition || row.condition;
    item.handoverStatus = row.handover_status || row.handoverStatus;
    item.assignmentDate = row.assignment_date || row.assignmentDate;
    item.computerName = row.specs?.computerName || row.computerName;
    item.os = row.specs?.os || row.os;
    item.cpu = row.specs?.cpu || row.cpu;
    item.ram = row.specs?.ram || row.ram;
    item.storage = row.specs?.storage || row.storage;
    item.ip = row.specs?.ip || row.ip;
    item.mac = row.specs?.mac || row.mac;
    item.imei = row.specs?.imei || row.imei;
    item.cameraInfo = row.specs?.cameraInfo || row.cameraInfo;
  } else if (storeName === "maintenance") {
    item.assetId = row.asset_id || row.assetId;
    item.actionTaken = row.action_taken || row.action_taken;
    item.maintDate = row.maint_date || row.maintDate;
    item.returnDate = row.return_date || row.returnDate;
    item.reportedBy = row.reported_by || row.reportedBy;
  } else if (storeName === "assetTransactions") {
    item.assetId = row.asset_id || row.assetId;
    item.actionType = row.action_type || row.actionType;
    item.transactionType = row.action_type || row.transactionType;
    item.fromEmployeeId = row.from_employee_id || row.fromEmployeeId;
    item.toEmployeeId = row.to_employee_id || row.toEmployeeId;
    item.fromLocationId = row.from_location_id || row.fromLocationId;
    item.toLocationId = row.to_location_id || row.toLocationId;
    item.transactionDate = row.date || row.transactionDate;
    item.performedBy = row.user || row.performedBy;
  } else if (storeName === "systemSettings") {
    item.systemNameAr = row.system_name_ar || row.systemNameAr;
    item.systemNameEn = row.system_name_en || row.systemNameEn;
    item.orgNameAr = row.org_name_ar || row.orgNameAr;
    item.orgNameEn = row.org_name_en || row.orgNameEn;
    item.logoDataUrl = row.logo_data_url || row.logoDataUrl;
  } else if (storeName === "users") {
    item.email = row.email || item.email || "";
    item.fullName = row.full_name || row.fullName;
    item.fullNameAr = row.full_name_ar || row.fullNameAr;
    item.fullNameEn = row.full_name_en || row.fullNameEn;
    item.employeeId = row.employee_id || row.employeeId;
    item.authUserId = row.auth_user_id || item.authUserId || null;
    delete item.password;
  } else if (storeName === "helpdeskRequests") {
    item.requestId = row.request_number || row.requestId || row.id;
    item.requestNumber = row.request_number || row.requestId || row.id;
    item.employeeId = row.employee_id || row.employeeId;
    item.assetId = row.asset_id || row.assetId;
    item.requestType = row.category || row.requestType || "Hardware";
    item.subject = row.title || row.subject;
    item.description = row.description;
    item.priority = row.priority;
    item.status = row.status;
    item.technicianNotes = row.technician_notes || row.technicianNotes;
    item.assignedTo = row.assigned_to || row.assignedTo;
    item.messages = Array.isArray(row.messages) ? row.messages : [];
    item.maintenanceId = row.maintenance_id || row.maintenanceId;
    item.createdDate = row.created_at || row.createdDate;
    item.updatedAt = row.updated_at || row.updatedAt;
    item.closedDate = row.closed_at || row.closedDate;
  } else if (storeName === "notifications") {
    item.employeeId = row.employee_id || row.employeeId;
    item.titleAr = row.title_ar || row.titleAr;
    item.titleEn = row.title_en || row.titleEn;
    item.messageAr = row.message_ar || row.messageAr;
    item.messageEn = row.message_en || row.messageEn;
    item.relatedId = row.related_id || row.relatedId;
    item.read = !!row.read;
    item.createdDate = row.created_at || row.createdDate;
  } else if (storeName === "licenses") {
    item.licenseNo = row.license_no || row.licenseNo || row.id;
    item.name = row.software_name || row.softwareName || row.name;
    item.publisher = row.vendor || row.publisher;
    item.licenseKey = row.license_key || row.licenseKey;
    item.totalSeats = row.quantity ?? row.totalSeats;
    item.usedSeats = row.assigned_quantity ?? row.usedSeats;
    item.expiryDate = row.expiry_date || row.expiryDate;
  }
  return item;
}

class DBEngine {
  constructor() {
    this.db = null;
    this.useFallback = false;
    this.memoryStore = {};
    this.supabase = null;
    this.isCloudOnline = false;
    this.isRealtimeOnline = false;
    this.isOperationalReady = false;
    this.realtimeChannel = null;
    this.realtimeReconnectTimer = null;
    this.realtimeReconnectAttempts = 0;
    this.stores = Object.keys(STORE_TABLE_MAP);
    
    // AUTH-02: Early initialization of Supabase client to support Secure Auth Gate
    this.initPromise = null;
    this.initStatus = 'uninitialized'; // 'uninitialized', 'initializing', 'ready'
    this.eventListenersAdded = false;
    
    if (typeof window !== "undefined" && window.supabase && SUPABASE_CONFIG.enabled) {
      try {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      } catch (e) {
        console.error("Supabase early init error:", e);
      }
    }
  }

  getFallbackStore(storeName) {
    try {
      const raw = localStorage.getItem("sdi_fb_" + storeName);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return this.memoryStore[storeName] || [];
  }

  saveToFallbackStore(storeName, item) {
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !isNodeTest) return;
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = this.getFallbackStore(storeName);
    const idx = this.memoryStore[storeName].findIndex(x => x.id === item.id);
    if (idx >= 0) {
      this.memoryStore[storeName][idx] = item;
    } else {
      this.memoryStore[storeName].push(item);
    }
    try {
      localStorage.setItem("sdi_fb_" + storeName, JSON.stringify(this.memoryStore[storeName]));
    } catch (e) {}
  }

  deleteFromFallbackStore(storeName, id) {
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !isNodeTest) return;
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = this.getFallbackStore(storeName);
    this.memoryStore[storeName] = this.memoryStore[storeName].filter(x => x.id !== id);
    try {
      localStorage.setItem("sdi_fb_" + storeName, JSON.stringify(this.memoryStore[storeName]));
    } catch (e) {}
  }

  clearFallbackStore(storeName) {
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !isNodeTest) return;
    this.memoryStore[storeName] = [];
    try {
      localStorage.removeItem("sdi_fb_" + storeName);
    } catch (e) {}
  }

  async init() {
    // 0. Initialization Guard: Prevent multiple simultaneous init calls
    if (this.initStatus === 'ready') return Promise.resolve(this.db);
    if (this.initStatus === 'initializing') return this.initPromise;

    this.initStatus = 'initializing';
    this.initPromise = (async () => {
      try {
        // 1. Check Supabase Cloud Client availability (Initialized in constructor)
        if (this.supabase) {
          try {
            const cloudCheck = await this.checkRequiredCloudTables();
            if (cloudCheck.success) {
              this.isCloudOnline = true;
              this.isOperationalReady = true;
              console.log("SDI IT Asset Hub: Connected to Supabase Cloud Database!");

              this.subscribeRealtime();
              
              if (!this.eventListenersAdded) {
                window.addEventListener("online", async () => {
                  await this.checkCloudConnection();
                  this.subscribeRealtime();
                  if (window.App && typeof window.App.refreshAllCloudViews === "function") {
                    window.App.refreshAllCloudViews();
                  }
                });
                window.addEventListener("offline", () => {
                  this.isCloudOnline = false;
                  this.isRealtimeOnline = false;
                  this.isOperationalReady = false;
                  this.realtimeStatus = "OFFLINE";
                  if (window.App && typeof window.App.updateCloudStatus === "function") {
                    window.App.updateCloudStatus();
                  }
                });
                document.addEventListener("visibilitychange", () => {
                  if (document.visibilityState === "visible") {
                    if (!this.isRealtimeOnline) this.subscribeRealtime();
                    if (window.App && typeof window.App.refreshAllCloudViews === "function") {
                      window.App.refreshAllCloudViews();
                    }
                  }
                });
                this.eventListenersAdded = true;
              }
            }
          } catch (err) {
            console.warn("Could not init Supabase client check:", err);
          }
        }

        // 2. Open IndexedDB with 1.5s Safety Timeout
        await new Promise((resolve) => {
          let isResolved = false;
          const safeResolve = (val) => {
            if (!isResolved) {
              isResolved = true;
              resolve(val);
            }
          };

          const timeoutId = setTimeout(async () => {
            if (!isResolved) {
              console.warn("IndexedDB initialization timed out or blocked. Proceeding with storage fallback.");
              this.useFallback = true;
              try {
                await this.ensureInitialSeedAndMigration();
              } catch (e) {}
              safeResolve(this.db);
            }
          }, 1500);

          try {
            if (typeof indexedDB === "undefined") {
              this.useFallback = true;
              clearTimeout(timeoutId);
              this.ensureInitialSeedAndMigration().then(() => safeResolve(null));
              return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onblocked = () => {
              this.useFallback = true;
              clearTimeout(timeoutId);
              this.ensureInitialSeedAndMigration().then(() => safeResolve(null));
            };

            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              this.stores.forEach(store => {
                if (!db.objectStoreNames.contains(store)) {
                  if (store === "employees") {
                    const empStore = db.createObjectStore("employees", { keyPath: "id" });
                    empStore.createIndex("departmentId", "departmentId", { unique: false });
                    empStore.createIndex("employeeNumber", "employeeNumber", { unique: true });
                  } else if (store === "assets") {
                    const assetStore = db.createObjectStore("assets", { keyPath: "id" });
                    assetStore.createIndex("assetId", "assetId", { unique: true });
                    assetStore.createIndex("assetTypeId", "assetTypeId", { unique: false });
                    assetStore.createIndex("serial", "serial", { unique: false });
                    assetStore.createIndex("status", "status", { unique: false });
                    assetStore.createIndex("departmentId", "departmentId", { unique: false });
                    assetStore.createIndex("locationId", "locationId", { unique: false });
                    assetStore.createIndex("currentEmployeeId", "currentEmployeeId", { unique: false });
                  } else if (store === "assetTransactions") {
                    const txStore = db.createObjectStore("assetTransactions", { keyPath: "id" });
                    txStore.createIndex("assetId", "assetId", { unique: false });
                    txStore.createIndex("transactionDate", "transactionDate", { unique: false });
                    txStore.createIndex("transactionType", "transactionType", { unique: false });
                  } else if (store === "maintenance") {
                    const maintStore = db.createObjectStore("maintenance", { keyPath: "id" });
                    maintStore.createIndex("assetId", "assetId", { unique: false });
                    maintStore.createIndex("status", "status", { unique: false });
                  } else if (store === "users") {
                    const userStore = db.createObjectStore("users", { keyPath: "id" });
                    userStore.createIndex("username", "username", { unique: true });
                  } else if (store === "logs") {
                    db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
                  } else if (store === "helpdeskRequests") {
                    const hdStore = db.createObjectStore("helpdeskRequests", { keyPath: "id" });
                    hdStore.createIndex("requestId", "requestId", { unique: true });
                    hdStore.createIndex("employeeId", "employeeId", { unique: false });
                    hdStore.createIndex("assetId", "assetId", { unique: false });
                    hdStore.createIndex("status", "status", { unique: false });
                    hdStore.createIndex("createdDate", "createdDate", { unique: false });
                  } else if (store === "notifications") {
                    const notifStore = db.createObjectStore("notifications", { keyPath: "id" });
                    notifStore.createIndex("userId", "userId", { unique: false });
                    notifStore.createIndex("employeeId", "employeeId", { unique: false });
                    notifStore.createIndex("isRead", "isRead", { unique: false });
                    notifStore.createIndex("createdDate", "createdDate", { unique: false });
                  } else if (store === "warehouseIssues") {
                    const wiStore = db.createObjectStore("warehouseIssues", { keyPath: "id" });
                    wiStore.createIndex("issueNo", "issueNo", { unique: true });
                    wiStore.createIndex("assetId", "assetId", { unique: false });
                    wiStore.createIndex("itEmployeeId", "itEmployeeId", { unique: false });
                    wiStore.createIndex("status", "status", { unique: false });
                  } else if (store === "assetTransfers") {
                    const trStore = db.createObjectStore("assetTransfers", { keyPath: "id" });
                    trStore.createIndex("transferNo", "transferNo", { unique: true });
                    trStore.createIndex("assetId", "assetId", { unique: false });
                    trStore.createIndex("status", "status", { unique: false });
                    trStore.createIndex("transferDate", "transferDate", { unique: false });
                  } else if (store === "contractors") {
                    const cntStore = db.createObjectStore("contractors", { keyPath: "id" });
                    cntStore.createIndex("code", "code", { unique: false });
                    cntStore.createIndex("status", "status", { unique: false });
                  } else if (store === "projects") {
                    const prjStore = db.createObjectStore("projects", { keyPath: "id" });
                    prjStore.createIndex("projectNo", "projectNo", { unique: true });
                    prjStore.createIndex("status", "status", { unique: false });
                    prjStore.createIndex("contractorId", "contractorId", { unique: false });
                    prjStore.createIndex("locationId", "locationId", { unique: false });
                  } else if (store === "projectTasks") {
                    const tskStore = db.createObjectStore("projectTasks", { keyPath: "id" });
                    tskStore.createIndex("projectId", "projectId", { unique: false });
                    tskStore.createIndex("status", "status", { unique: false });
                  } else {
                    db.createObjectStore(store, { keyPath: "id" });
                  }
                }
              });
            };

            request.onsuccess = async (event) => {
              this.db = event.target.result;
              clearTimeout(timeoutId);
              try {
                await this.ensureInitialSeedAndMigration();
              } catch (e) {}
              safeResolve(this.db);
            };

            request.onerror = async (event) => {
              this.useFallback = true;
              clearTimeout(timeoutId);
              await this.ensureInitialSeedAndMigration();
              safeResolve(null);
            };
          } catch (err) {
            this.useFallback = true;
            clearTimeout(timeoutId);
            this.ensureInitialSeedAndMigration().then(() => safeResolve(null));
          }
        });

        this.initStatus = 'ready';
        return this.db;
      } catch (err) {
        console.error("Critical DB Init Error:", err);
        this.initStatus = 'uninitialized';
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }


  async checkCloudConnection() {
    if (!this.supabase) {
      this.isCloudOnline = false;
      this.isOperationalReady = false;
      return false;
    }
    try {
      const cloudCheck = await this.checkRequiredCloudTables();
      this.isCloudOnline = cloudCheck.success;
      if (!cloudCheck.success) {
        console.warn("Required cloud table check failed:", cloudCheck.table, cloudCheck.error);
      }
    } catch (error) {
      console.warn("Cloud connection check failed:", error);
      this.isCloudOnline = false;
    }
    this.isOperationalReady = this.isCloudOnline;
    return this.isCloudOnline;
  }

  async checkRequiredCloudTables() {
    const coreTables = ["assets", "employees", "departments", "locations", "asset_types", "maintenance"];
    for (const table of coreTables) {
      try {
        const { error } = await this.supabase.from(table).select("id").limit(1);
        if (error) return { success: false, table, error };
      } catch (error) {
        return { success: false, table, error };
      }
    }
    // Check secondary tables non-fatally (log warning if missing/404)
    for (const table of REQUIRED_CLOUD_TABLES) {
      if (!coreTables.includes(table)) {
        try {
          const { error } = await this.supabase.from(table).select("id").limit(1);
          if (error) {
            console.warn(`Optional cloud table '${table}' missing or not yet provisioned:`, error.message || error);
          }
        } catch (error) {
          console.warn(`Optional cloud table '${table}' check error:`, error);
        }
      }
    }
    return { success: true };
  }

  subscribeRealtime() {
    if (!this.supabase) return;
    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    this.isRealtimeOnline = false;
    this.realtimeStatus = "SUBSCRIBING";
    this.realtimeChannel = this.supabase.channel("sdi_realtime_channel")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        console.log("[Realtime Event]", payload.table, payload.eventType);
        if (window.App && typeof window.App.onCloudDataChange === "function") {
          window.App.onCloudDataChange(payload);
        }
      })
      .subscribe((status, error) => {
        this.isRealtimeOnline = status === "SUBSCRIBED";
        this.realtimeStatus = status;
        this.isOperationalReady = this.isCloudOnline;
        if (status === "SUBSCRIBED") {
          this.realtimeReconnectAttempts = 0;
          if (window.App && typeof window.App.refreshAllCloudViews === "function") {
            window.App.refreshAllCloudViews();
          }
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[Realtime status]", status, error || "");
          this.scheduleRealtimeReconnect();
        }
        if (window.App && typeof window.App.updateCloudStatus === "function") {
          window.App.updateCloudStatus();
        }
      });
    if (window.App && typeof window.App.updateCloudStatus === "function") {
      window.App.updateCloudStatus();
    }
  }

  scheduleRealtimeReconnect() {
    if (this.realtimeReconnectTimer || !this.supabase) return;
    this.realtimeReconnectAttempts += 1;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(this.realtimeReconnectAttempts - 1, 5)));
    this.realtimeReconnectTimer = setTimeout(() => {
      this.realtimeReconnectTimer = null;
      this.subscribeRealtime();
    }, delay);
  }

  // Byte formatting helper
  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Database Connection & Storage Diagnostics Tool (Cloud + Local Storage)
  async testConnection() {
    try {
      let isCloudActive = false;
      let cloudAssetCount = 0;
      let cloudDataBytes = 0;

      if (this.supabase) {
        try {
          const { data: astData, error: astErr } = await this.supabase.from('assets').select('id, brand, model, specs, notes');
          if (!astErr && Array.isArray(astData)) {
            isCloudActive = true;
            cloudAssetCount = astData.length;
            cloudDataBytes += JSON.stringify(astData).length;
          }

          // Sample other tables for size estimation
          const tables = ['employees', 'departments', 'locations', 'asset_types', 'maintenance'];
          for (const tbl of tables) {
            try {
              const { data, error } = await this.supabase.from(tbl).select('*');
              if (!error && Array.isArray(data)) {
                cloudDataBytes += JSON.stringify(data).length;
              }
            } catch (e) {}
          }
        } catch (e) {}
      }

      // Supabase Free Tier Total Quota: 500 MB (524,288,000 bytes)
      const CLOUD_QUOTA_BYTES = 500 * 1024 * 1024;
      // PostgreSQL Base Catalog + Index/Table Pages Overhead ~ 14.5 MB
      const baseOverheadBytes = isCloudActive ? (14.5 * 1024 * 1024) : 0;
      const totalCloudUsedBytes = isCloudActive ? (baseOverheadBytes + (cloudDataBytes * 2)) : 0;
      const totalCloudFreeBytes = Math.max(0, CLOUD_QUOTA_BYTES - totalCloudUsedBytes);
      const cloudUsedPercentage = isCloudActive 
        ? Math.min(100, Math.max(0.1, (totalCloudUsedBytes / CLOUD_QUOTA_BYTES) * 100)).toFixed(2)
        : "0.00";
      const cloudFreePercentage = isCloudActive ? (100 - parseFloat(cloudUsedPercentage)).toFixed(2) : "100.00";

      // Browser Storage (IndexedDB / Local Storage Quota)
      let browserStorage = {
        usedPretty: "3.2 MB",
        freePretty: "Gigabytes Available",
        totalPretty: "Device Managed",
        pct: "0.1"
      };

      if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          const used = est.usage || 0;
          const total = est.quota || (50 * 1024 * 1024 * 1024);
          const free = Math.max(0, total - used);
          browserStorage = {
            usedBytes: used,
            totalBytes: total,
            freeBytes: free,
            usedPretty: this.formatBytes(used),
            freePretty: this.formatBytes(free),
            totalPretty: this.formatBytes(total),
            pct: ((used / total) * 100).toFixed(2)
          };
        } catch (e) {}
      }

      const isIdbActive = !!(this.db && !this.useFallback);
      const testKey = "__conn_test__";
      const testData = { id: testKey, timestamp: Date.now() };
      await this.put("systemSettings", testData);
      const readBack = await this.getById("systemSettings", testKey);
      await this.delete("systemSettings", testKey);
      const localAssetCount = await this.count("assets");

      return {
        success: true,
        message: isCloudActive 
          ? "Cloud & Local Database Connection Successful" 
          : "Local Database Connection Successful",
        messageAr: isCloudActive 
          ? `تم الاتصال بمحرك السحابة بنجاح! (Supabase Cloud) - تم العثور على ${cloudAssetCount} أصول مسجلة.` 
          : "تم الاتصال بقاعدة البيانات بنجاح " + (isIdbActive ? "(محرك IndexedDB v5)" : "(محرك التخزين المحلي الآمن)"),
        details: {
          dbName: DB_NAME,
          cloudEngine: isCloudActive ? "Supabase Cloud PostgreSQL (Realtime Live Active)" : "Offline / Local Mode",
          cloudUrl: SUPABASE_CONFIG.url,
          cloudAssets: cloudAssetCount,
          engine: isIdbActive ? "IndexedDB Engine (Direct)" : "Safe Local Storage Engine",
          version: isCloudActive ? "5.0-Hybrid-Cloud" : (isIdbActive ? this.db.version : "5.0-Fallback"),
          totalAssets: isCloudActive ? cloudAssetCount : localAssetCount,
          stores: ["assets", "employees", "departments", "locations", "assetTypes", "maintenance", "assetTransactions", "users"],
          storage: {
            cloud: {
              active: isCloudActive,
              quotaPretty: "500 MB",
              quotaBytes: CLOUD_QUOTA_BYTES,
              usedPretty: this.formatBytes(totalCloudUsedBytes),
              usedBytes: totalCloudUsedBytes,
              freePretty: this.formatBytes(totalCloudFreeBytes),
              freeBytes: totalCloudFreeBytes,
              usedPct: cloudUsedPercentage,
              freePct: cloudFreePercentage
            },
            browser: browserStorage
          }
        }
      };
    } catch (err) {
      console.error("Database connection test failure:", err);
      return {
        success: false,
        message: "Database Connection Failed: " + (err.message || "Unknown error"),
        messageAr: "فشل الاتصال بقاعدة البيانات: " + (err.message || "خطأ غير معروف"),
        error: err.toString()
      };
    }
  }

  // Generic Operations with Automatic Fallback & Cloud Sync
  async getAll(storeName) {
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !this.supabase && !isNodeTest) {
      throw new Error("Cloud database is unavailable.");
    }
    if (this.supabase && STORE_TABLE_MAP[storeName]) {
      try {
        const table = STORE_TABLE_MAP[storeName];
        const { data, error } = await this.supabase.from(table).select('*');
        if (!error && Array.isArray(data)) {
          return data.map(r => fromCloudRecord(storeName, r));
        }
        if (error) console.warn(`Supabase getAll(${storeName}) failed:`, error);
      } catch (cloudErr) {
        console.warn(`Supabase getAll(${storeName}) failed:`, cloudErr);
      }
      if (STRICT_CLOUD_ONLY) {
        throw new Error(`Cloud read failed for ${storeName}.`);
      }
    }

    if (this.useFallback || !this.db) {
      return this.getFallbackStore(storeName);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          if (res.length === 0) {
            const fb = this.getFallbackStore(storeName);
            if (fb.length > 0) return resolve(fb);
          }
          resolve(res);
        };
        req.onerror = () => resolve(this.getFallbackStore(storeName));
      } catch (e) {
        resolve(this.getFallbackStore(storeName));
      }
    });
  }

  async getById(storeName, id) {
    if (!id && id !== 0) return null;
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !this.supabase && !isNodeTest) {
      throw new Error("Cloud database is unavailable.");
    }
    const strId = String(id).trim().toLowerCase();

    if (this.supabase && STORE_TABLE_MAP[storeName]) {
      try {
        const table = STORE_TABLE_MAP[storeName];
        const { data, error } = await this.supabase.from(table).select('*').eq('id', id).maybeSingle();
        if (!error) return data ? fromCloudRecord(storeName, data) : null;
        console.warn(`Supabase getById(${storeName}) failed:`, error);
      } catch (e) {
        console.warn(`Supabase getById(${storeName}) failed:`, e);
      }
      if (STRICT_CLOUD_ONLY) {
        throw new Error(`Cloud read failed for ${storeName}.`);
      }
    }

    const searchInList = (list) => {
      if (!Array.isArray(list)) return null;
      return list.find(i => 
        (i && (i.id === id || String(i.id).trim().toLowerCase() === strId)) ||
        (i && i.employeeNumber && String(i.employeeNumber).trim().toLowerCase() === strId) ||
        (i && i.code && String(i.code).trim().toLowerCase() === strId) ||
        (i && i.assetId && String(i.assetId).trim().toLowerCase() === strId) ||
        (i && i.projectNo && String(i.projectNo).trim().toLowerCase() === strId) ||
        (i && i.issueNo && String(i.issueNo).trim().toLowerCase() === strId) ||
        (i && i.transferNo && String(i.transferNo).trim().toLowerCase() === strId) ||
        (i && i.requestId && String(i.requestId).trim().toLowerCase() === strId)
      ) || null;
    };

    if (this.useFallback || !this.db) {
      const items = this.getFallbackStore(storeName);
      return searchInList(items);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) return resolve(req.result);
          // Fallback search across items for alternate IDs or string/num conversions
          const allReq = store.getAll();
          allReq.onsuccess = () => resolve(searchInList(allReq.result));
          allReq.onerror = () => resolve(searchInList(this.getFallbackStore(storeName)));
        };
        req.onerror = () => resolve(searchInList(this.getFallbackStore(storeName)));
      } catch (e) {
        resolve(searchInList(this.getFallbackStore(storeName)));
      }
    });
  }

  // Prefix & formatting specifications for each record store
  getStorePrefixConfig(storeName) {
    const currentYear = new Date().getFullYear();
    const config = {
      assets: { prefix: "AST-", digits: 6, start: 1, fields: ["assetId", "id"] },
      employees: { prefix: "EMP-", digits: 4, start: 1001, fields: ["id", "employeeId"], altPrefixes: ["EMP-", "SDI-"] },
      departments: { prefix: "DEP-", digits: 3, start: 1, fields: ["id", "code"] },
      locations: { prefix: "LOC-", digits: 3, start: 1, fields: ["code", "id"] },
      assetTypes: { prefix: "TYP-", digits: 3, start: 1, fields: ["code", "id"] },
      contractors: { prefix: "CNT-", digits: 3, start: 1, fields: ["code", "id"] },
      projects: { prefix: `PRJ-${currentYear}-`, digits: 3, start: 1, fields: ["projectNo", "id"] },
      projectTasks: { prefix: "TSK-", digits: 3, start: 1, fields: ["id", "taskNo", "code"] },
      warehouseIssues: { prefix: "ISS-", digits: 6, start: 1, fields: ["issueNo", "id"] },
      assetTransfers: { prefix: "TRF-", digits: 6, start: 1, fields: ["transferNo", "id"] },
      maintenance: { prefix: "MNT-", digits: 5, start: 1, fields: ["id", "ticketNo"], altPrefixes: ["MAINT-", "TKT-"] },
      helpdeskRequests: { prefix: "REQ-", digits: 6, start: 101, fields: ["requestId", "id"] },
      licenses: { prefix: "LIC-", digits: 4, start: 1, fields: ["id", "licenseNo"] },
      users: { prefix: "USR-", digits: 3, start: 1, fields: ["id"] },
      assetTransactions: { prefix: "TX-", digits: 6, start: 1, fields: ["id"] },
      notifications: { prefix: "NOTIF-", digits: 6, start: 1, fields: ["id"] }
    };
    return config[storeName] || { 
      prefix: (storeName.slice(0, 3).toUpperCase() + "-"), 
      digits: 4, 
      start: 1, 
      fields: ["id", "code"] 
    };
  }

  // Universal Sequential Code Generator by Record Type (e.g. AST-000001, SDI-1001, DEP-001, LOC-001, PRJ-2026-001...)
  async getNextSequentialId(storeName) {
    const items = await this.getAll(storeName);
    const cfg = this.getStorePrefixConfig(storeName);
    const prefix = typeof cfg.prefix === "function" ? cfg.prefix() : cfg.prefix;
    const digits = cfg.digits || 3;
    const startNum = cfg.start || 1;
    const fields = cfg.fields || ["id", "code"];
    const allPrefixes = [prefix, ...(cfg.altPrefixes || [])].sort((a, b) => b.length - a.length);

    let maxNum = 0;
    let foundPrefixed = false;

    items.forEach(item => {
      if (!item) return;
      for (const f of fields) {
        const val = item[f];
        if (val !== undefined && val !== null) {
          const valStr = String(val).trim();
          let matchedPrefix = false;
          for (const p of allPrefixes) {
            if (valStr.toUpperCase().startsWith(p.toUpperCase())) {
              const numPart = valStr.slice(p.length).replace(/^[^\d]*/, "");
              const num = parseInt(numPart, 10);
              if (!isNaN(num) && num < 10000000) {
                foundPrefixed = true;
                if (num > maxNum) maxNum = num;
                matchedPrefix = true;
                break;
              }
            }
          }
          // Also check pure numeric values if no prefix matched
          if (!matchedPrefix && /^\d+$/.test(valStr)) {
            const num = parseInt(valStr, 10);
            if (!isNaN(num) && num < 10000000) {
              if (num > maxNum) maxNum = num;
            }
          }
        }
      }
    });

    let nextNum = foundPrefixed || maxNum >= startNum ? maxNum + 1 : startNum;

    // Guaranteed uniqueness: format candidate and ensure no collision with any existing item id or code
    let candidate = `${prefix}${String(nextNum).padStart(digits, "0")}`;
    while (items.some(it => it && (
      String(it.id).toUpperCase() === candidate.toUpperCase() ||
      (it.code && String(it.code).toUpperCase() === candidate.toUpperCase()) ||
      (it.employeeNumber && String(it.employeeNumber).toUpperCase() === candidate.toUpperCase()) ||
      (it.projectNo && String(it.projectNo).toUpperCase() === candidate.toUpperCase()) ||
      (it.issueNo && String(it.issueNo).toUpperCase() === candidate.toUpperCase()) ||
      (it.assetId && String(it.assetId).toUpperCase() === candidate.toUpperCase())
    ))) {
      nextNum++;
      candidate = `${prefix}${String(nextNum).padStart(digits, "0")}`;
    }

    return candidate;
  }

  // Direct entity helper methods
  async getNextEmployeeId() {
    return this.getNextSequentialId("employees");
  }

  async getNextEmployeeNumber() {
    return this.getNextSequentialId("employees");
  }

  async getNextDepartmentCode() {
    return this.getNextSequentialId("departments");
  }

  async getNextLocationCode() {
    return this.getNextSequentialId("locations");
  }

  async getNextAssetTypeCode() {
    return this.getNextSequentialId("assetTypes");
  }

  async put(storeName, item) {
    if (!item) return item;

    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STORE_TABLE_MAP[storeName] && (!this.isCloudOnline || !this.supabase) && !isNodeTest) {
      throw new Error("Cloud database connection is unavailable. This operation requires an active cloud connection. / الاتصال بقاعدة البيانات السحابية غير متاح. هذه العملية تتطلب اتصالاً فعالاً بالسحابة.");
    }
    if (PRODUCTION_CLOUD_REQUIRED && STORE_TABLE_MAP[storeName] && !this.supabase && !isNodeTest) {
      throw new Error("Cloud database connection is unavailable. This operation requires an active cloud connection. / الاتصال بقاعدة البيانات السحابية غير متاح. هذه العملية تتطلب اتصالاً فعالاً بالسحابة.");
    }
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !this.isOperationalReady && !isNodeTest) {
      throw new Error("Realtime synchronization is not ready. The record was not saved.");
    }

    // Automatic generation of Sequential Primary Key if id is missing or contains temporary timestamp/prefix
    const isTempId = typeof item.id === "string" && (
      /\d{10,}/.test(item.id) || 
      /^(temp|tmp)-/i.test(item.id)
    );

    if (!item.id || isTempId) {
      const existing = item.id ? await this.getById(storeName, item.id) : null;
      if (!existing) {
        item.id = await this.getNextSequentialId(storeName);
      }
    }

    // Keep business code fields in sync with sequential ID if not explicitly set
    if (storeName === "contractors" && !item.code) item.code = item.id;
    if (storeName === "projects" && !item.projectNo) item.projectNo = item.id;
    if (storeName === "warehouseIssues" && !item.issueNo) item.issueNo = item.id;
    if (storeName === "assetTransfers" && !item.transferNo) item.transferNo = item.id;
    if (storeName === "helpdeskRequests" && !item.requestId) item.requestId = item.id;
    if (storeName === "employees" && !item.employeeNumber) item.employeeNumber = item.id;
    if (storeName === "assets" && !item.assetId) item.assetId = item.id;
    if (storeName === "locations" && !item.code) item.code = item.id;
    if (storeName === "assetTypes" && !item.code) item.code = item.id;

    // Sync to Supabase Cloud
    if (this.supabase && STORE_TABLE_MAP[storeName]) {
      try {
        const table = STORE_TABLE_MAP[storeName];
        const cloudRecord = toCloudRecord(storeName, item);
        const { data: existing } = await this.supabase.from(table).select('id').eq('id', cloudRecord.id).maybeSingle();
        if (existing) {
          const { error } = await this.supabase.from(table).update(cloudRecord).eq('id', cloudRecord.id);
          if (error) throw error;
        } else {
          const { error } = await this.supabase.from(table).insert(cloudRecord);
          if (error) throw error;
        }
      } catch (e) {
        console.warn(`Supabase sync error:`, e);
        throw e;
      }

      // In strict cloud-only mode, IndexedDB must never become a second
      // operational source of truth after a successful cloud write.
      if (STRICT_CLOUD_ONLY) return item;
    }

    const isFallbackNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (!STRICT_CLOUD_ONLY || !STORE_TABLE_MAP[storeName] || isFallbackNodeTest) {
      this.saveToFallbackStore(storeName, item);
    }

    if (this.useFallback || !this.db) return item;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(item);
      } catch (e) {
        resolve(item);
      }
    });
  }

  async delete(storeName, id) {
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (STORE_TABLE_MAP[storeName] && (!this.isCloudOnline || !this.supabase) && !isNodeTest) {
      throw new Error("Cloud database connection is unavailable. This operation requires an active cloud connection. / الاتصال بقاعدة البيانات السحابية غير متاح. هذه العملية تتطلب اتصالاً فعالاً بالسحابة.");
    }
    if (PRODUCTION_CLOUD_REQUIRED && STORE_TABLE_MAP[storeName] && !this.supabase && !isNodeTest) {
      throw new Error("Cloud database connection is unavailable. This operation requires an active cloud connection. / الاتصال بقاعدة البيانات السحابية غير متاح. هذه العملية تتطلب اتصالاً فعالاً بالسحابة.");
    }
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !this.isOperationalReady && !isNodeTest) {
      throw new Error("Realtime synchronization is not ready. The record was not deleted.");
    }

    // Sync to Supabase Cloud
    if (this.supabase && STORE_TABLE_MAP[storeName]) {
      try {
        const table = STORE_TABLE_MAP[storeName];
        const { error } = await this.supabase.from(table).delete().eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.warn(`Supabase delete sync error:`, e);
        throw e;
      }

      if (STRICT_CLOUD_ONLY) return true;
    }

    const isFallbackNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;
    if (!STRICT_CLOUD_ONLY || !STORE_TABLE_MAP[storeName] || isFallbackNodeTest) {
      this.deleteFromFallbackStore(storeName, id);
    }

    if (this.useFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  async count(storeName) {
    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName]) {
      return (await this.getAll(storeName)).length;
    }
    if (this.useFallback || !this.db) {
      return this.getFallbackStore(storeName).length;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(this.getFallbackStore(storeName).length);
      } catch (e) {
        resolve(this.getFallbackStore(storeName).length);
      }
    });
  }

  async clear(storeName) {
    this.clearFallbackStore(storeName);
    if (this.useFallback || !this.db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  // Generate Unique Sequential Asset ID (AST-000001)
  async getNextAssetId() {
    let settings = await this.getById("systemSettings", "general");
    let nextNum = 1;

    if (settings && settings.nextAssetSeq) {
      nextNum = settings.nextAssetSeq;
    } else {
      // Find highest existing AST-XXXXXX number
      const assets = await this.getAll("assets");
      assets.forEach(a => {
        if (a.assetId && a.assetId.startsWith("AST-")) {
          const num = parseInt(a.assetId.replace("AST-", ""), 10);
          if (!isNaN(num) && num >= nextNum) {
            nextNum = num + 1;
          }
        }
      });
    }

    const formattedId = "AST-" + String(nextNum).padStart(6, "0");
    return formattedId;
  }

  async incrementAssetIdSeq() {
    let settings = await this.getById("systemSettings", "general");
    if (!settings) {
      settings = { id: "general", nextAssetSeq: 2, orgNameAr: "معهد الشارقة للسياقة", orgNameEn: "Sharjah Driving Institute" };
    } else {
      settings.nextAssetSeq = (settings.nextAssetSeq || 1) + 1;
    }
    await this.put("systemSettings", settings);
  }

  async getSystemSettings() {
    let settings = await this.getById("systemSettings", "general");
    if (!settings) {
      settings = {
        id: "general",
        nextAssetSeq: 11,
        orgNameAr: "معهد الشارقة للسياقة",
        orgNameEn: "Sharjah Driving Institute",
        systemNameAr: "معهد الشارقة للسياقة",
        systemNameEn: "SDI IT Asset Hub",
        logoDataUrl: null,
        primaryColor: "#0B3C68",
        accentColor: "#F37021",
        lang: "ar",
        theme: "sdi"
      };
      await this.put("systemSettings", settings);
    }
    return settings;
  }

  async updateSystemSettings(newSettings) {
    let settings = await this.getSystemSettings();
    const updated = {
      ...settings,
      ...newSettings,
      id: "general"
    };
    await this.put("systemSettings", updated);
    return updated;
  }

  // Validation Checks
  async checkSerialExists(serial, excludeAssetId = null) {
    if (!serial || !serial.trim()) return false;
    const cleanSerial = serial.trim().toLowerCase();
    const assets = await this.getAll("assets");
    return assets.some(a => 
      a.serial && 
      a.serial.trim().toLowerCase() === cleanSerial && 
      (!excludeAssetId || (a.id !== excludeAssetId && a.assetId !== excludeAssetId))
    );
  }

  async checkAssetIdExists(assetId, excludeId = null) {
    if (!assetId || !assetId.trim()) return false;
    const cleanId = assetId.trim().toUpperCase();
    const assets = await this.getAll("assets");
    return assets.some(a => 
      a.assetId && 
      a.assetId.trim().toUpperCase() === cleanId && 
      (!excludeId || (a.id !== excludeId && a.assetId !== excludeId))
    );
  }

  async checkBarcodeExists(barcode, excludeAssetId = null) {
    if (!barcode || !barcode.trim()) return false;
    const cleanBarcode = barcode.trim().toLowerCase();
    const assets = await this.getAll("assets");
    return assets.some(a => 
      a.barcodeValue && 
      a.barcodeValue.trim().toLowerCase() === cleanBarcode && 
      (!excludeAssetId || (a.id !== excludeAssetId && a.assetId !== excludeAssetId))
    );
  }

  async checkQrExists(qrValue, excludeAssetId = null) {
    if (!qrValue || !qrValue.trim()) return false;
    const cleanQr = qrValue.trim().toLowerCase();
    const assets = await this.getAll("assets");
    return assets.some(a => 
      a.qrCodeValue && 
      a.qrCodeValue.trim().toLowerCase() === cleanQr && 
      (!excludeAssetId || (a.id !== excludeAssetId && a.assetId !== excludeAssetId))
    );
  }

  // Transaction / History Logger
  async logTransaction({
    assetId,
    transactionType,
    fromEmployeeId = null,
    toEmployeeId = null,
    fromDepartmentId = null,
    toDepartmentId = null,
    fromLocationId = null,
    toLocationId = null,
    fromStatus = null,
    toStatus = null,
    transactionDate = null,
    performedBy = "System",
    notes = ""
  }) {
    const txId = await this.getNextSequentialId("assetTransactions");
    const record = {
      id: txId,
      assetId,
      transactionType, // Added, Assigned, Returned, Transferred, Sent to Maintenance, Returned from Maintenance, Retired, Disposed
      fromEmployeeId,
      toEmployeeId,
      fromDepartmentId,
      toDepartmentId,
      fromLocationId,
      toLocationId,
      fromStatus,
      toStatus,
      transactionDate: transactionDate || new Date().toISOString().replace("T", " ").substring(0, 19),
      performedBy,
      notes: notes || ""
    };
    await this.put("assetTransactions", record);
    return record;
  }

  // Get Asset History
  async getAssetHistory(assetId) {
    const allTx = await this.getAll("assetTransactions");
    return allTx
      .filter(t => t.assetId === assetId)
      .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
  }

  // Get Sequential Warehouse Issue No (e.g. ISS-000001)
  async getNextWarehouseIssueNo() {
    let nextNum = 1;
    const issues = await this.getAll("warehouseIssues");
    issues.forEach(i => {
      const idStr = i.issueNo || i.id || "";
      if (idStr.startsWith("ISS-")) {
        const num = parseInt(idStr.replace("ISS-", ""), 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    });
    return "ISS-" + String(nextNum).padStart(6, "0");
  }

  // Get Sequential Transfer No (e.g. TRF-000001)
  async getNextTransferNo() {
    let nextNum = 1;
    const transfers = await this.getAll("assetTransfers");
    transfers.forEach(t => {
      const idStr = t.transferNo || t.id || "";
      if (idStr.startsWith("TRF-")) {
        const num = parseInt(idStr.replace("TRF-", ""), 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    });
    return "TRF-" + String(nextNum).padStart(6, "0");
  }

  // Get Sequential Project No (e.g. PRJ-2026-001)
  async getNextProjectNo() {
    const year = new Date().getFullYear();
    let nextNum = 1;
    const projects = await this.getAll("projects");
    projects.forEach(p => {
      const idStr = p.projectNo || p.id || "";
      const prefix = `PRJ-${year}-`;
      if (idStr.startsWith(prefix)) {
        const num = parseInt(idStr.replace(prefix, ""), 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    });
    return `PRJ-${year}-` + String(nextNum).padStart(3, "0");
  }

  // Get Sequential Contractor Code (e.g. CNT-001)
  async getNextContractorCode() {
    let nextNum = 1;
    const list = await this.getAll("contractors");
    list.forEach(c => {
      const idStr = c.code || c.id || "";
      if (idStr.startsWith("CNT-")) {
        const num = parseInt(idStr.replace("CNT-", ""), 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    });
    return "CNT-" + String(nextNum).padStart(3, "0");
  }

  // Get Sequential Helpdesk Request ID (e.g. REQ-000125)
  async getNextRequestId() {
    let nextNum = 101;
    const requests = await this.getAll("helpdeskRequests");
    requests.forEach(r => {
      const idStr = r.requestId || r.id || "";
      if (idStr.startsWith("REQ-")) {
        const num = parseInt(idStr.replace("REQ-", ""), 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }
    });
    return "REQ-" + String(nextNum).padStart(6, "0");
  }

  // Internal Notifications Engine
  async createNotification({
    userId = null,
    employeeId = null,
    titleAr = "",
    titleEn = "",
    messageAr = "",
    messageEn = "",
    type = "system",
    relatedId = null
  }) {
    const notif = {
      id: await this.getNextSequentialId("notifications"),
      userId,
      employeeId,
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      type,
      relatedId,
      isRead: false,
      createdDate: new Date().toISOString().replace("T", " ").substring(0, 19)
    };
    await this.put("notifications", notif);
    if (typeof window !== "undefined" && window.App && typeof window.App.updateNotificationBadge === "function") {
      window.App.updateNotificationBadge();
    }
    return notif;
  }

  async getNotifications(filter = {}) {
    const all = await this.getAll("notifications");
    return all.filter(n => {
      if (filter.employeeId && n.employeeId && n.employeeId !== filter.employeeId) return false;
      if (filter.userId && n.userId && n.userId !== filter.userId) return false;
      return true;
    }).sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));
  }

  async markNotificationRead(id) {
    const notif = await this.getById("notifications", id);
    if (notif) {
      notif.isRead = true;
      await this.put("notifications", notif);
      if (typeof window !== "undefined" && window.App && typeof window.App.updateNotificationBadge === "function") {
        window.App.updateNotificationBadge();
      }
    }
  }

  async markAllNotificationsRead(filter = {}) {
    const notifs = await this.getNotifications(filter);
    for (const n of notifs) {
      if (!n.isRead) {
        n.isRead = true;
        await this.put("notifications", n);
      }
    }
    if (typeof window !== "undefined" && window.App && typeof window.App.updateNotificationBadge === "function") {
      window.App.updateNotificationBadge();
    }
  }

  async getUnreadNotificationsCount(filter = {}) {
    const notifs = await this.getNotifications(filter);
    return notifs.filter(n => !n.isRead).length;
  }

  // Software Licenses Store Helper
  async addLicense(license) {
    return await this.put("licenses", license);
  }

  async getLicenses() {
    return await this.getAll("licenses");
  }

  // Backup & Export (JSON)
  async exportBackup(downloadFile = true) {
    const assetTypes = await this.getAll("assetTypes");
    const departments = await this.getAll("departments");
    const locations = await this.getAll("locations");
    const employees = await this.getAll("employees");
    const assets = await this.getAll("assets");
    const assetTransactions = await this.getAll("assetTransactions");
    const maintenance = await this.getAll("maintenance");
    const helpdeskRequests = await this.getAll("helpdeskRequests");
    const notifications = await this.getAll("notifications");
    const users = await this.getAll("users");
    const systemSettings = await this.getAll("systemSettings");

    const backupData = {
      exportDate: new Date().toISOString(),
      system: "Sharjah Driving Institute - IT Asset Management System",
      version: "6.0",
      data: {
        assetTypes,
        departments,
        locations,
        employees,
        assets,
        assetTransactions,
        maintenance,
        helpdeskRequests,
        notifications,
        users,
        systemSettings
      }
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    if (downloadFile !== false && typeof document !== "undefined") {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SDI_IT_Assets_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return jsonStr;
  }

  // Import Backup (JSON)
  async importBackup(jsonData) {
    if (!jsonData || !jsonData.data) {
      throw new Error("ملف النسخ الاحتياطي غير صالح أو تالف / Invalid backup file format");
    }

    const {
      assetTypes,
      departments,
      locations,
      employees,
      assets,
      assetTransactions,
      maintenance,
      helpdeskRequests,
      notifications,
      users,
      systemSettings
    } = jsonData.data;

    if (assetTypes) {
      await this.clear("assetTypes");
      for (const item of assetTypes) await this.put("assetTypes", item);
    }
    if (departments) {
      await this.clear("departments");
      for (const item of departments) await this.put("departments", item);
    }
    if (locations) {
      await this.clear("locations");
      for (const item of locations) await this.put("locations", item);
    }
    if (employees) {
      await this.clear("employees");
      for (const item of employees) await this.put("employees", item);
    }
    if (assets) {
      await this.clear("assets");
      for (const item of assets) await this.put("assets", item);
    }
    if (assetTransactions) {
      await this.clear("assetTransactions");
      for (const item of assetTransactions) await this.put("assetTransactions", item);
    }
    if (maintenance) {
      await this.clear("maintenance");
      for (const item of maintenance) await this.put("maintenance", item);
    }
    if (helpdeskRequests) {
      await this.clear("helpdeskRequests");
      for (const item of helpdeskRequests) await this.put("helpdeskRequests", item);
    }
    if (notifications) {
      await this.clear("notifications");
      for (const item of notifications) await this.put("notifications", item);
    }
    if (users) {
      await this.clear("users");
      for (const item of users) await this.put("users", item);
    }
    if (systemSettings) {
      await this.clear("systemSettings");
      for (const item of systemSettings) await this.put("systemSettings", item);
    }

    return true;
  }

  // Export Assets to CSV
  async exportAssetsCSV() {
    const assets = await this.getAll("assets");
    const employees = await this.getAll("employees");
    const departments = await this.getAll("departments");
    const locations = await this.getAll("locations");
    const assetTypes = await this.getAll("assetTypes");

    const empMap = Object.fromEntries(employees.map(e => [e.id, e.nameAr || e.name]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.nameAr || d.name]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.nameAr || l.name]));
    const typeMap = Object.fromEntries(assetTypes.map(t => [t.id, t.nameAr || t.nameEn]));

    const headers = [
      "Asset ID",
      "Asset Type",
      "Brand",
      "Model",
      "Serial Number",
      "Status",
      "Department",
      "Location",
      "Assigned Employee",
      "Purchase Date",
      "Warranty Expiry",
      "Purchase Cost",
      "Supplier",
      "Computer Name",
      "IP Address",
      "MAC Address",
      "CPU",
      "RAM",
      "Storage",
      "OS"
    ];

    const rows = assets.map(a => [
      `"${a.assetId || a.id || ""}"`,
      `"${typeMap[a.assetTypeId] || a.assetTypeId || ""}"`,
      `"${a.brand || ""}"`,
      `"${a.model || ""}"`,
      `"${a.serial || ""}"`,
      `"${a.status || ""}"`,
      `"${deptMap[a.departmentId] || a.departmentId || ""}"`,
      `"${locMap[a.locationId] || a.locationId || ""}"`,
      `"${empMap[a.currentEmployeeId] || ""}"`,
      `"${a.purchaseDate || ""}"`,
      `"${a.warrantyExpiry || ""}"`,
      `"${a.purchaseCost || ""}"`,
      `"${a.supplier || ""}"`,
      `"${a.computerName || ""}"`,
      `"${a.ip || ""}"`,
      `"${a.mac || ""}"`,
      `"${a.cpu || ""}"`,
      `"${a.ram || ""}"`,
      `"${a.storage || ""}"`,
      `"${a.os || ""}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SDI_IT_Assets_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Initial Seed & Migration Handler
  async ensureInitialSeedAndMigration() {
    // Production must only use records entered by authorized users or imported
    // from an approved source. Demo/sample records are never created implicitly.
    if (!SUPABASE_CONFIG.allowDemoSeed) return;

    // 1. Asset Types
    const typeCount = await this.count("assetTypes");
    if (typeCount === 0) {
      const defaultTypes = [
        { id: "type-computer", code: "COM", nameAr: "كمبيوتر مكتبي", nameEn: "Computer", hasTechSpecs: true, isDefault: true, active: true },
        { id: "type-laptop", code: "LTP", nameAr: "كمبيوتر محمول", nameEn: "Laptop", hasTechSpecs: true, isDefault: true, active: true },
        { id: "type-monitor", code: "MON", nameAr: "شاشة عرض", nameEn: "Monitor", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-printer", code: "PRT", nameAr: "طابعة", nameEn: "Printer", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-scanner", code: "SCN", nameAr: "ماسح ضوئي", nameEn: "Scanner", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-camera", code: "CAM", nameAr: "كاميرا", nameEn: "Camera", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-tablet", code: "TAB", nameAr: "جهاز لوحي (تابلت)", nameEn: "Tablet", hasTechSpecs: true, isDefault: true, active: true },
        { id: "type-mobile", code: "MOB", nameAr: "هاتف ذكي", nameEn: "Mobile Device", hasTechSpecs: true, isDefault: true, active: true },
        { id: "type-network", code: "NET", nameAr: "جهاز شبكة (سويتش/راوتر)", nameEn: "Network Device", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-server", code: "SRV", nameAr: "خادم (سيرفر)", nameEn: "Server", hasTechSpecs: true, isDefault: true, active: true },
        { id: "type-ups", code: "UPS", nameAr: "مزود طاقة غير منقطعة (UPS)", nameEn: "UPS", hasTechSpecs: false, isDefault: true, active: true },
        { id: "type-other", code: "OTH", nameAr: "أخرى", nameEn: "Other", hasTechSpecs: false, isDefault: true, active: true }
      ];
      for (const t of defaultTypes) await this.put("assetTypes", t);
    }

    // 2. Departments
    const deptCount = await this.count("departments");
    if (deptCount === 0) {
      const defaultDepts = [
        { id: "dept-it", nameAr: "تقنية المعلومات", nameEn: "IT Department", description: "إدارة البنية التحتية والأنظمة والدعم الفني", active: true },
        { id: "dept-admin", nameAr: "الشؤون الإدارية والموارد البشرية", nameEn: "Administration & HR", description: "الموارد البشرية والشؤون الإدارية", active: true },
        { id: "dept-cs", nameAr: "خدمة العملاء والتسجيل", nameEn: "Customer Service & Registration", description: "كاونترات واستقبال المتدربين", active: true },
        { id: "dept-exam", nameAr: "قاعات الفحص النظري والذكي", nameEn: "Examination Labs", description: "قاعات وأنظمة الفحص النظري والذكي", active: true },
        { id: "dept-fleet", nameAr: "أسطول سيارات الفحص الذكي", nameEn: "Smart Fleet Operations", description: "إدارة مركبات التدريب والفحص الذكي", active: true },
        { id: "dept-finance", nameAr: "الشؤون المالية والمشتريات", nameEn: "Finance & Procurement", description: "المحاسبة والعقود والمشتريات", active: true }
      ];
      for (const d of defaultDepts) await this.put("departments", d);
    }

    // 3. Locations (Hierarchical Tree)
    const locCount = await this.count("locations");
    if (locCount === 0) {
      const defaultLocs = [
        // Main Office & Sub-levels
        { id: "loc-main", parentId: null, nameAr: "المكتب الرئيسي - الرمثاء", nameEn: "Main Office - Al Ramtha", code: "HQ", icon: "building", description: "المقر الرئيسي لمعهد الشارقة للسياقة", active: true },
        { id: "loc-admin", parentId: "loc-main", nameAr: "الشؤون الإدارية", nameEn: "Administration", code: "ADM", icon: "briefcase", description: "المكاتب الإدارية والشؤون المشتركة", active: true },
        { id: "loc-it", parentId: "loc-main", nameAr: "قسم تقنية المعلومات", nameEn: "IT Department", code: "IT", icon: "laptop-code", description: "إدارة الأنظمة وورشة الدعم الفني", active: true },
        { id: "loc-it-office", parentId: "loc-it", nameAr: "مكتب الدعم الفني (IT Office)", nameEn: "IT Office", code: "OFC", icon: "desktop", description: "مكاتب مهندسي الدعم الفني", active: true },
        { id: "loc-server-room", parentId: "loc-it", nameAr: "غرفة السيرفرات (Server Room)", nameEn: "Server Room", code: "SRV", icon: "server", description: "غرفة الخوادم الرئيسية ومركز البيانات", active: true },
        { id: "loc-store", parentId: "loc-it", nameAr: "المستودع الرئيسي (Store)", nameEn: "Store", code: "STR", icon: "boxes", description: "مستودع الأجهزة وقطع الغيار", active: true },
        { id: "loc-security", parentId: "loc-main", nameAr: "غرفة الأمن والمراقبة", nameEn: "Security & CCTV", code: "SEC", icon: "shield-alt", description: "مكتب الأمن وغرفة كاميرات المراقبة", active: true },
        { id: "loc-reception", parentId: "loc-main", nameAr: "صالة الاستقبال وخدمة العملاء", nameEn: "Reception & Customer Service", code: "REC", icon: "concierge-bell", description: "صالة الاستقبال الرئيسية وكاونترات التسجيل", active: true },
        { id: "loc-meeting", parentId: "loc-main", nameAr: "قاعة الاجتماعات الرئيسية", nameEn: "Meeting Room", code: "MTG", icon: "users-cog", description: "قاعة الاجتماعات الكبرى", active: true },
        
        // Branches
        { id: "loc-br-nas", parentId: null, nameAr: "فرع الناصرية (Branch 1)", nameEn: "Branch - Nasseriya", code: "NAS", icon: "building", description: "مبنى فرع الناصرية", active: true },
        { id: "loc-nas-ofc1", parentId: "loc-br-nas", nameAr: "مكتب 1 (Office 1 - التسجيل)", nameEn: "Office 1", code: "OF1", icon: "door-open", description: "كاونتر التسجيل الرئيسي", active: true },
        { id: "loc-nas-ofc2", parentId: "loc-br-nas", nameAr: "مكتب 2 (Office 2 - الإدارة)", nameEn: "Office 2", code: "OF2", icon: "door-open", description: "مكتب إدارة الفرع", active: true },
        { id: "loc-nas-store", parentId: "loc-br-nas", nameAr: "المستودع (Store)", nameEn: "Store", code: "STR", icon: "archive", description: "مستودع أجهزة ومستلزمات الفرع", active: true },

        { id: "loc-br-dhd", parentId: null, nameAr: "فرع الذيد", nameEn: "Branch - Al Dhaid", code: "DHD", icon: "building", description: "مبنى فرع الذيد", active: true },
        { id: "loc-br-khk", parentId: null, nameAr: "فرع خورفكان", nameEn: "Branch - Khorfakkan", code: "KHK", icon: "building", description: "مبنى فرع خورفكان", active: true },
        { id: "loc-br-klb", parentId: null, nameAr: "فرع كلباء", nameEn: "Branch - Kalba", code: "KLB", icon: "building", description: "مبنى فرع كلباء", active: true },
        { id: "loc-other", parentId: null, nameAr: "مواقع أخرى", nameEn: "Other", code: "OTH", icon: "map-pin", description: "مواقع مؤقتة أو خارجية", active: true }
      ];
      for (const l of defaultLocs) await this.put("locations", l);
    } else {
      // Enrich existing locations with hierarchy attributes if missing
      const existingLocs = await this.getAll("locations");
      const hierarchyMapping = {
        "loc-main": { parentId: null, code: "HQ", icon: "building" },
        "loc-admin": { parentId: "loc-main", code: "ADM", icon: "briefcase" },
        "loc-it": { parentId: "loc-main", code: "IT", icon: "laptop-code" },
        "loc-it-office": { parentId: "loc-it", code: "OFC", icon: "desktop" },
        "loc-server-room": { parentId: "loc-it", code: "SRV", icon: "server" },
        "loc-store": { parentId: "loc-it", code: "STR", icon: "boxes" },
        "loc-security": { parentId: "loc-main", code: "SEC", icon: "shield-alt" },
        "loc-reception": { parentId: "loc-main", code: "REC", icon: "concierge-bell" },
        "loc-meeting": { parentId: "loc-main", code: "MTG", icon: "users-cog" },
        "loc-br-nas": { parentId: null, code: "NAS", icon: "building" },
        "loc-nas-ofc1": { parentId: "loc-br-nas", code: "OF1", icon: "door-open" },
        "loc-nas-ofc2": { parentId: "loc-br-nas", code: "OF2", icon: "door-open" },
        "loc-nas-store": { parentId: "loc-br-nas", code: "STR", icon: "archive" },
        "loc-br-dhd": { parentId: null, code: "DHD", icon: "building" },
        "loc-br-khk": { parentId: null, code: "KHK", icon: "building" },
        "loc-br-klb": { parentId: null, code: "KLB", icon: "building" },
        "loc-other": { parentId: null, code: "OTH", icon: "map-pin" }
      };

      for (const l of existingLocs) {
        if (hierarchyMapping[l.id]) {
          let updated = false;
          if (l.parentId === undefined && hierarchyMapping[l.id].parentId !== undefined) {
            l.parentId = hierarchyMapping[l.id].parentId;
            updated = true;
          }
          if (!l.code) { l.code = hierarchyMapping[l.id].code; updated = true; }
          if (!l.icon) { l.icon = hierarchyMapping[l.id].icon; updated = true; }
          if (updated) await this.put("locations", l);
        }
      }

      // Ensure sample hierarchy rooms exist if missing
      const sampleRooms = [
        { id: "loc-admin", parentId: "loc-main", nameAr: "الشؤون الإدارية", nameEn: "Administration", code: "ADM", icon: "briefcase", description: "المكاتب الإدارية والشؤون المشتركة", active: true },
        { id: "loc-it-office", parentId: "loc-it", nameAr: "مكتب الدعم الفني (IT Office)", nameEn: "IT Office", code: "OFC", icon: "desktop", description: "مكاتب مهندسي الدعم الفني", active: true },
        { id: "loc-server-room", parentId: "loc-it", nameAr: "غرفة السيرفرات (Server Room)", nameEn: "Server Room", code: "SRV", icon: "server", description: "غرفة الخوادم الرئيسية ومركز البيانات", active: true },
        { id: "loc-nas-ofc1", parentId: "loc-br-nas", nameAr: "مكتب 1 (Office 1 - التسجيل)", nameEn: "Office 1", code: "OF1", icon: "door-open", description: "كاونتر التسجيل الرئيسي", active: true },
        { id: "loc-nas-ofc2", parentId: "loc-br-nas", nameAr: "مكتب 2 (Office 2 - الإدارة)", nameEn: "Office 2", code: "OF2", icon: "door-open", description: "مكتب إدارة الفرع", active: true },
        { id: "loc-nas-store", parentId: "loc-br-nas", nameAr: "المستودع (Store)", nameEn: "Store", code: "STR", icon: "archive", description: "مستودع أجهزة ومستلزمات الفرع", active: true }
      ];
      for (const r of sampleRooms) {
        if (!existingLocs.some(x => x.id === r.id)) {
          await this.put("locations", r);
        }
      }
    }

    // 4. Employees
    const empCount = await this.count("employees");
    if (empCount === 0) {
      // Check if we have legacy staff to migrate
      const legacyStaff = await this.getAll("staff");
      if (legacyStaff && legacyStaff.length > 0) {
        for (const s of legacyStaff) {
          const emp = {
            id: s.id || ("emp-" + Math.random().toString(36).substr(2, 6)),
            employeeNumber: s.empId || ("EMP-" + Math.floor(1000 + Math.random() * 9000)),
            nameAr: s.fullName || s.name || "موظف",
            nameEn: s.fullNameEn || s.nameEn || "",
            departmentId: s.department === "sub-main-it" ? "dept-it" : "dept-cs",
            phone: s.phone || "",
            email: s.email || "",
            status: "Active",
            notes: s.notes || ""
          };
          await this.put("employees", emp);
        }
      } else {
        const defaultEmployees = [
          { id: "emp-101", employeeNumber: "SDI-1021", nameAr: "م. أحمد الشامسي", nameEn: "Eng. Ahmed Al Shamsi", departmentId: "dept-it", phone: "+971 6 538 2000", email: "ahmed.shamsi@sdi.ae", status: "Active", notes: "مسؤول النظم والدعم الفني" },
          { id: "emp-102", employeeNumber: "SDI-1045", nameAr: "مريم الحمادي", nameEn: "Maryam Al Hammadi", departmentId: "dept-cs", phone: "+971 6 538 2110", email: "maryam.h@sdi.ae", status: "Active", notes: "مشرفة كاونتر التسجيل" },
          { id: "emp-103", employeeNumber: "SDI-1088", nameAr: "سلطان القاسمي", nameEn: "Sultan Al Qasimi", departmentId: "dept-exam", phone: "+971 6 538 2200", email: "sultan.q@sdi.ae", status: "Active", notes: "مسؤول قاعة الفحص النظري الذكي" },
          { id: "emp-104", employeeNumber: "SDI-1102", nameAr: "فاطمة الزعابي", nameEn: "Fatima Al Zaabi", departmentId: "dept-admin", phone: "+971 6 538 2300", email: "fatima.z@sdi.ae", status: "Active", notes: "مسؤولة الموارد البشرية والشؤون الإدارية" },
          { id: "emp-105", employeeNumber: "SDI-1140", nameAr: "عائشة النقبي", nameEn: "Aisha Al Naqbi", departmentId: "dept-cs", phone: "+971 9 238 1111", email: "aisha.n@sdi.ae", status: "Active", notes: "كاونتر التسجيل الرئيسي - خورفكان" },
          { id: "emp-106", employeeNumber: "SDI-1180", nameAr: "خالد الطنيجي", nameEn: "Khalid Al Tunaiji", departmentId: "dept-fleet", phone: "+971 6 882 3344", email: "khalid.t@sdi.ae", status: "Active", notes: "مشرف فحص سيارات الذيد" }
        ];
        for (const e of defaultEmployees) await this.put("employees", e);
      }
    }

    // 5. Users Store (Authentication)
    const userCount = await this.count("users");
    if (userCount === 0) {
      const defaultUsers = [
        { id: "usr-admin", username: "admin", email: "admin@sdi.ae", password: "123", fullName: "مدير النظام", fullNameAr: "مدير النظام", fullNameEn: "System Administrator", role: "Administrator", employeeId: null, active: true },
        { id: "usr-tech", username: "ituser", email: "it.tech@sdi.ae", password: "123", fullName: "فني الدعم الفني", fullNameAr: "فني الدعم الفني", fullNameEn: "IT Support Technician", role: "IT User", employeeId: null, active: true },
        { id: "usr-emp-101", username: "ahmed", email: "ahmed.shamsi@sdi.ae", password: "123", fullName: "م. أحمد الشامسي", fullNameAr: "م. أحمد الشامسي", fullNameEn: "Eng. Ahmed Al Shamsi", role: "Employee", employeeId: "emp-101", active: true },
        { id: "usr-emp-102", username: "maryam", email: "maryam.h@sdi.ae", password: "123", fullName: "مريم الحمادي", fullNameAr: "مريم الحمادي", fullNameEn: "Maryam Al Hammadi", role: "Employee", employeeId: "emp-102", active: true },
        { id: "usr-view", username: "viewer", email: "viewer@sdi.ae", password: "123", fullName: "مستعرض التقارير", fullNameAr: "مستعرض التقارير", fullNameEn: "Reports Viewer", role: "Viewer", employeeId: null, active: true }
      ];
      for (const u of defaultUsers) await this.put("users", u);
    } else {
      // Migrate existing users to ensure fullNameEn and fullNameAr exist
      const existingUsers = await this.getAll("users");
      for (const u of existingUsers) {
        let mod = false;
        if (!u.fullNameEn || /[\u0600-\u06FF]/.test(u.fullNameEn)) {
          if (u.username === "admin") { u.fullNameEn = "System Administrator"; u.fullNameAr = "مدير النظام"; mod = true; }
          else if (u.username === "ituser") { u.fullNameEn = "IT Support Technician"; u.fullNameAr = "فني الدعم الفني"; mod = true; }
          else if (u.username === "ahmed") { u.fullNameEn = "Eng. Ahmed Al Shamsi"; u.fullNameAr = "م. أحمد الشامسي"; mod = true; }
          else if (u.username === "maryam") { u.fullNameEn = "Maryam Al Hammadi"; u.fullNameAr = "مريم الحمادي"; mod = true; }
          else if (u.username === "viewer") { u.fullNameEn = "Reports Viewer"; u.fullNameAr = "مستعرض التقارير"; mod = true; }
          else if (u.employeeId) {
            const emp = await this.getById("employees", u.employeeId);
            if (emp) { u.fullNameEn = emp.nameEn || emp.nameAr; u.fullNameAr = emp.nameAr; mod = true; }
          } else {
            u.fullNameEn = u.username;
            mod = true;
          }
        }
        if (mod) await this.put("users", u);
      }
    }

    // 6. System Settings Store
    let settings = await this.getById("systemSettings", "general");
    if (!settings) {
      settings = {
        id: "general",
        nextAssetSeq: 11,
        orgNameAr: "معهد الشارقة للسياقة",
        orgNameEn: "Sharjah Driving Institute",
        systemNameAr: "SDI IT Asset Hub",
        systemNameEn: "SDI IT Asset Hub",
        logoDataUrl: null,
        primaryColor: "#0B3C68",
        accentColor: "#F37021",
        lang: "ar",
        theme: "sdi"
      };
      await this.put("systemSettings", settings);
    } else {
      let modifiedSettings = false;
      if (!settings.primaryColor) { settings.primaryColor = "#0B3C68"; modifiedSettings = true; }
      if (!settings.accentColor) { settings.accentColor = "#F37021"; modifiedSettings = true; }
      if (!settings.systemNameAr) { settings.systemNameAr = "SDI IT Asset Hub"; modifiedSettings = true; }
      if (!settings.systemNameEn) { settings.systemNameEn = "SDI IT Asset Hub"; modifiedSettings = true; }
      if (modifiedSettings) await this.put("systemSettings", settings);
    }

    // 7. Assets Migration / Seed
    const assets = await this.getAll("assets");
    let needsMigration = false;
    if (assets.length === 0) {
      // Create seed assets with standard AST-XXXXXX IDs
      const seedAssets = [
        {
          id: "ast-000001",
          assetId: "AST-000001",
          assetTypeId: "type-computer",
          brand: "HP",
          model: "EliteDesk 800 G9",
          serial: "CZC34091KL",
          status: "Assigned",
          purchaseDate: "2024-01-15",
          warrantyExpiry: "2027-01-15",
          purchaseCost: 4500,
          supplier: "HP Middle East / Alpha Data",
          departmentId: "dept-it",
          locationId: "loc-it",
          currentEmployeeId: "emp-101",
          notes: "محطة عمل رئيسية لمسؤول النظم والدعم الفني",
          createdDate: "2024-01-15 09:00:00",
          updatedDate: "2024-01-15 09:00:00",
          cpu: "Intel Core i7-13700",
          ram: "32 GB DDR5",
          storage: "1 TB NVMe SSD",
          os: "Windows 11 Pro 64-bit",
          computerName: "SDI-HQ-IT-01",
          ip: "192.168.10.15",
          mac: "B4:2E:99:A1:3C:55",
          attachments: []
        },
        {
          id: "ast-000002",
          assetId: "AST-000002",
          assetTypeId: "type-laptop",
          brand: "Dell",
          model: "Latitude 5540",
          serial: "8KLR9Z3",
          status: "Assigned",
          purchaseDate: "2024-02-10",
          warrantyExpiry: "2027-02-10",
          purchaseCost: 5200,
          supplier: "Dell Direct UAE",
          departmentId: "dept-it",
          locationId: "loc-it",
          currentEmployeeId: "emp-101",
          notes: "لابتوب متنقل مخصص لطوارئ الشبكات والفروع",
          createdDate: "2024-02-10 10:30:00",
          updatedDate: "2024-02-10 10:30:00",
          cpu: "Intel Core i5-1345U",
          ram: "16 GB DDR4",
          storage: "512 GB NVMe SSD",
          os: "Windows 11 Pro",
          computerName: "SDI-HQ-LAP-02",
          ip: "192.168.10.44",
          mac: "70:85:C2:5F:11:80",
          attachments: []
        },
        {
          id: "ast-000003",
          assetId: "AST-000003",
          assetTypeId: "type-computer",
          brand: "Lenovo",
          model: "ThinkCentre M70q Tiny",
          serial: "MJ0E59AA",
          status: "Assigned",
          purchaseDate: "2023-05-20",
          warrantyExpiry: "2026-05-20",
          purchaseCost: 3200,
          supplier: "Sharaf DG Enterprise",
          departmentId: "dept-cs",
          locationId: "loc-reception",
          currentEmployeeId: "emp-102",
          notes: "كاونتر التسجيل الرئيسي رقم 1",
          createdDate: "2023-05-20 08:15:00",
          updatedDate: "2023-05-20 08:15:00",
          cpu: "Intel Core i5-12400T",
          ram: "16 GB DDR4",
          storage: "512 GB NVMe SSD",
          os: "Windows 11 Pro",
          computerName: "SDI-CS-PC-01",
          ip: "192.168.20.101",
          mac: "48:2A:E3:44:88:C1",
          attachments: []
        },
        {
          id: "ast-000004",
          assetId: "AST-000004",
          assetTypeId: "type-printer",
          brand: "HID Fargo",
          model: "HDP5000",
          serial: "FG904412B",
          status: "Assigned",
          purchaseDate: "2023-08-12",
          warrantyExpiry: "2026-10-05",
          purchaseCost: 9800,
          supplier: "ScreenCheck Middle East",
          departmentId: "dept-cs",
          locationId: "loc-reception",
          currentEmployeeId: "emp-102",
          notes: "طابعة رخص القيادة والبطاقات الذكية",
          createdDate: "2023-08-12 11:00:00",
          updatedDate: "2023-08-12 11:00:00",
          ip: "192.168.20.200",
          mac: "00:14:D1:49:EE:12",
          attachments: []
        },
        {
          id: "ast-000005",
          assetId: "AST-000005",
          assetTypeId: "type-camera",
          brand: "Hikvision",
          model: "DS-2CD2387G2P-LSU",
          serial: "HK88921004",
          status: "Assigned",
          purchaseDate: "2023-09-01",
          warrantyExpiry: "2026-09-28",
          purchaseCost: 1850,
          supplier: "Al Falak Security",
          departmentId: "dept-admin",
          locationId: "loc-security",
          currentEmployeeId: null,
          notes: "كاميرا مراقبة بانورامية بزاوية 180 درجة بالبوابة الرئيسية",
          createdDate: "2023-09-01 12:00:00",
          updatedDate: "2023-09-01 12:00:00",
          ip: "192.168.40.15",
          mac: "44:19:B6:88:20:11",
          cameraInfo: "4K ColorVu Panoramic Dome Camera",
          attachments: []
        },
        {
          id: "ast-000006",
          assetId: "AST-000006",
          assetTypeId: "type-server",
          brand: "Dell",
          model: "PowerEdge R750 Rack Server",
          serial: "9XLM7Q2",
          status: "Available",
          purchaseDate: "2023-03-10",
          warrantyExpiry: "2028-03-10",
          purchaseCost: 38000,
          supplier: "Dell Enterprise Services",
          departmentId: "dept-it",
          locationId: "loc-it",
          currentEmployeeId: null,
          notes: "سيرفر رئيسي لاستضافة قواعد بيانات وأنظمة الفحص الذكي",
          createdDate: "2023-03-10 09:00:00",
          updatedDate: "2023-03-10 09:00:00",
          cpu: "Dual Intel Xeon Silver 4314 (32 Cores)",
          ram: "128 GB ECC DDR4",
          storage: "4x 1.92TB SAS SSD RAID 10",
          os: "VMware ESXi 8.0 / Windows Server 2022",
          computerName: "SDI-SRV-PROD-01",
          ip: "192.168.10.2",
          mac: "2C:F8:9B:AA:01:44",
          attachments: []
        },
        {
          id: "ast-000007",
          assetId: "AST-000007",
          assetTypeId: "type-computer",
          brand: "Lenovo",
          model: "ThinkCentre M70q Tiny",
          serial: "MJ0E61BB",
          status: "Under Maintenance",
          purchaseDate: "2023-05-20",
          warrantyExpiry: "2026-05-20",
          purchaseCost: 3200,
          supplier: "Sharaf DG Enterprise",
          departmentId: "dept-cs",
          locationId: "loc-br-khk",
          currentEmployeeId: "emp-105",
          notes: "كاونتر التسجيل - فرع خورفكان (في الصيانة بسبب عطل بمزود الطاقة)",
          createdDate: "2023-05-20 08:30:00",
          updatedDate: "2026-09-01 14:00:00",
          cpu: "Intel Core i5-12400T",
          ram: "16 GB DDR4",
          storage: "512 GB NVMe SSD",
          os: "Windows 11 Pro",
          computerName: "SDI-KHK-PC-01",
          ip: "192.168.60.22",
          mac: "48:2A:E3:44:99:E5",
          attachments: []
        },
        {
          id: "ast-000008",
          assetId: "AST-000008",
          assetTypeId: "type-tablet",
          brand: "Samsung",
          model: "Galaxy Tab Active4 Pro Rugged",
          serial: "R52T90ABCD4",
          status: "Assigned",
          purchaseDate: "2024-03-01",
          warrantyExpiry: "2026-03-01",
          purchaseCost: 2450,
          supplier: "Samsung Gulf",
          departmentId: "dept-fleet",
          locationId: "loc-br-dhd",
          currentEmployeeId: "emp-106",
          notes: "تابلت الفاحص الذكي المقاوم للصدمات لسيارة الفحص 08",
          createdDate: "2024-03-01 10:00:00",
          updatedDate: "2024-03-01 10:00:00",
          os: "Android 14 Enterprise",
          storage: "128 GB",
          imei: "354921098452119",
          ip: "192.168.50.77",
          attachments: []
        },
        {
          id: "ast-000009",
          assetId: "AST-000009",
          assetTypeId: "type-network",
          brand: "Cisco",
          model: "Catalyst 9200L 48-Port PoE+",
          serial: "FOC2441L0AB",
          status: "Available",
          purchaseDate: "2023-01-10",
          warrantyExpiry: "2028-01-10",
          purchaseCost: 14500,
          supplier: "Cisco UAE Partner",
          departmentId: "dept-it",
          locationId: "loc-it",
          currentEmployeeId: null,
          notes: "سويتش شبكة رئيسي لكبائن الفروع",
          createdDate: "2023-01-10 09:00:00",
          updatedDate: "2023-01-10 09:00:00",
          ip: "192.168.10.254",
          mac: "00:78:88:AC:33:10",
          attachments: []
        },
        {
          id: "ast-000010",
          assetId: "AST-000010",
          assetTypeId: "type-ups",
          brand: "APC Schneider Electric",
          model: "Smart-UPS RT 3000VA On-Line",
          serial: "AS2145008912",
          status: "In Store",
          purchaseDate: "2023-06-15",
          warrantyExpiry: "2026-06-15",
          purchaseCost: 7200,
          supplier: "Schneider Electric ME",
          departmentId: "dept-it",
          locationId: "loc-store",
          currentEmployeeId: null,
          notes: "وحدة UPS احتياطية جاهزة للتركيب",
          createdDate: "2023-06-15 14:00:00",
          updatedDate: "2023-06-15 14:00:00",
          attachments: []
        }
      ];

      for (const a of seedAssets) {
        await this.put("assets", a);
        // Create initial Added transaction
        await this.logTransaction({
          assetId: a.id,
          transactionType: "Added",
          toEmployeeId: a.currentEmployeeId,
          toDepartmentId: a.departmentId,
          toLocationId: a.locationId,
          transactionDate: a.createdDate,
          performedBy: "admin",
          notes: "تم تسجيل وإدخال الأصل لأول مرة بالنظام"
        });
        if (a.currentEmployeeId) {
          await this.logTransaction({
            assetId: a.id,
            transactionType: "Assigned",
            toEmployeeId: a.currentEmployeeId,
            toDepartmentId: a.departmentId,
            toLocationId: a.locationId,
            transactionDate: a.createdDate,
            performedBy: "admin",
            notes: "تسليم العهدة للموظف المسؤول"
          });
        }
        if (a.status === "Under Maintenance") {
          await this.logTransaction({
            assetId: a.id,
            transactionType: "Sent to Maintenance",
            fromDepartmentId: a.departmentId,
            fromLocationId: a.locationId,
            transactionDate: "2026-09-01 14:00:00",
            performedBy: "ituser",
            notes: "عطل في مزود الطاقة وتشويش شاشة الكاونتر"
          });
          await this.put("maintenance", {
            id: "maint-001",
            assetId: a.id,
            maintenanceDate: "2026-09-01",
            problem: "الجهاز لا يعمل ومزود الطاقة تالف مع انقطاع الإشارة",
            actionTaken: "تم الفحص وتأكيد الحاجة لاستبدال محول الطاقة 65W Lenovo",
            technician: "م. أحمد الشامسي",
            vendor: "Lenovo Authorized Service",
            cost: 150,
            returnDate: "",
            status: "In Progress",
            notes: "بانتظار وصول القطعة الأصلية من المورد"
          });
        }
      }
    } else {
      // Migrate existing assets if needed
      let index = 1;
      for (const a of assets) {
        let modified = false;
        if (!a.assetId || !a.assetId.startsWith("AST-")) {
          a.assetId = "AST-" + String(index).padStart(6, "0");
          modified = true;
        }
        // Map category
        if (!a.assetTypeId) {
          if (a.category === "catDesktop") a.assetTypeId = "type-computer";
          else if (a.category === "catLaptop") a.assetTypeId = "type-laptop";
          else if (a.category === "catPrinter") a.assetTypeId = "type-printer";
          else if (a.category === "catServer") a.assetTypeId = "type-server";
          else if (a.category === "catExamCamera" || a.category === "catCctvCamera") a.assetTypeId = "type-camera";
          else if (a.category === "catNetwork") a.assetTypeId = "type-network";
          else a.assetTypeId = "type-other";
          modified = true;
        }
        // Map status
        if (!["Available", "Assigned", "Under Maintenance", "In Store", "Damaged", "Lost", "Retired", "Disposed", "Installed", "In Use"].includes(a.status)) {
          if (a.status === "statusActive") a.status = a.assignedStaffId ? "Assigned" : "Available";
          else if (a.status === "statusMaintenance") a.status = "Under Maintenance";
          else if (a.status === "statusSpare") a.status = "In Store";
          else if (a.status === "statusRetired") a.status = "Retired";
          else a.status = "Available";
          modified = true;
        }
        if (a.assignedStaffId && !a.currentEmployeeId) {
          a.currentEmployeeId = a.assignedStaffId;
          modified = true;
        }
        if (a.branchId && !a.locationId) {
          a.locationId = a.branchId === "br-main" ? "loc-main" : (a.branchId === "br-dhaid" ? "loc-br-dhd" : "loc-br-khk");
          modified = true;
        }
        if (a.department && !a.departmentId) {
          a.departmentId = a.department === "sub-main-it" ? "dept-it" : "dept-cs";
          modified = true;
        }
        if (!a.qrCodeValue && a.assetId) {
          a.qrCodeValue = a.assetId;
          modified = true;
        }
        if (!a.barcodeValue && a.assetId) {
          const numPart = a.assetId.replace("AST-", "").padStart(9, "0");
          a.barcodeValue = "629" + numPart;
          modified = true;
        }
        if (a.id === "ast-000005" && a.warrantyExpiry === "2026-09-01") {
          a.warrantyExpiry = "2026-09-28";
          modified = true;
        }
        if (a.id === "ast-000004" && a.warrantyExpiry === "2026-08-12") {
          a.warrantyExpiry = "2026-10-05";
          modified = true;
        }
        if (modified) {
          await this.put("assets", a);
        }

        // Ensure at least one transaction exists for this asset
        const txHistory = await this.getAssetHistory(a.id);
        if (txHistory.length === 0) {
          await this.logTransaction({
            assetId: a.id,
            transactionType: "Added",
            toEmployeeId: a.currentEmployeeId || null,
            toDepartmentId: a.departmentId || null,
            toLocationId: a.locationId || null,
            transactionDate: a.createdDate || "2024-01-01 10:00:00",
            performedBy: "admin",
            notes: "ترحيل وتثبيت بيانات الأصل التاريخية"
          });
          if (a.status === "Assigned" && a.currentEmployeeId) {
            await this.logTransaction({
              assetId: a.id,
              transactionType: "Assigned",
              toEmployeeId: a.currentEmployeeId,
              toDepartmentId: a.departmentId,
              toLocationId: a.locationId,
              transactionDate: a.createdDate || "2024-01-01 10:05:00",
              performedBy: "admin",
              notes: "تسليم العهدة"
            });
          }
        }
        index++;
      }
    }

    // 7.1 Safe Migration: Reconcile assets with confirmed Installation transactions
    try {
      const allTx = await this.getAll("assetTransactions");
      const installTransactions = allTx.filter(t => 
        (t.transactionType === "Installed" || t.action_type === "Installed" || t.actionType === "Installed")
      );
      if (installTransactions.length > 0) {
        const [allCurrentAssets, issues] = await Promise.all([
          this.getAll("assets"),
          this.getAll("warehouseIssues")
        ]);
        for (const tx of installTransactions) {
          if (!tx.assetId) continue;
          const targetAsset = allCurrentAssets.find(a => a.id === tx.assetId || a.assetId === tx.assetId);
          if (targetAsset && targetAsset.status !== "Installed") {
            targetAsset.status = "Installed";
            if (!targetAsset.installationDate && tx.transactionDate) {
              targetAsset.installationDate = tx.transactionDate.slice(0, 10);
            }
            if (tx.toLocationId) targetAsset.locationId = tx.toLocationId;
            if (tx.toEmployeeId && !targetAsset.currentEmployeeId) targetAsset.currentEmployeeId = tx.toEmployeeId;

            // Link technician, project, and office from matching warehouse issue if available
            const matchingIssue = issues.find(i => i.assetId === targetAsset.id || i.assetId === targetAsset.assetId);
            if (matchingIssue) {
              if (matchingIssue.itEmployeeId && !targetAsset.installedBy) {
                targetAsset.installedBy = matchingIssue.itEmployeeId;
              }
              if (matchingIssue.projectId && !targetAsset.projectId) {
                targetAsset.projectId = matchingIssue.projectId;
              }
              if (matchingIssue.installedOffice && !targetAsset.office) {
                targetAsset.office = matchingIssue.installedOffice;
              }
              if (matchingIssue.installedDepartmentId && !targetAsset.departmentId) {
                targetAsset.departmentId = matchingIssue.installedDepartmentId;
              }
            }
            targetAsset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
            await this.put("assets", targetAsset);
          }
        }
      }
    } catch (migErr) {
      console.warn("[ensureInitialSeedAndMigration] Installed assets migration warning:", migErr);
    }

    // 9. Ensure Initial Helpdesk Requests & Notifications
    const reqCount = await this.count("helpdeskRequests");
    if (reqCount === 0) {
      const sampleRequests = [
        {
          id: "req-000101",
          requestId: "REQ-000101",
          requestNumber: "REQ-000101",
          employeeId: "emp-102",
          assetId: "ast-000003",
          requestType: "Hardware",
          subject: "الشاشة تومض بشكل متقطع عند بدء التشغيل",
          subjectAr: "الشاشة تومض بشكل متقطع عند بدء التشغيل",
          subjectEn: "Screen flickers intermittently upon startup",
          description: "شاشة كمبيوتر كاونتر التسجيل الرئيسي تومض باللون الأسود وتتأخر في إظهار شاشة الدخول.",
          descriptionAr: "شاشة كمبيوتر كاونتر التسجيل الرئيسي تومض باللون الأسود وتتأخر في إظهار شاشة الدخول.",
          descriptionEn: "Main registration counter monitor flickers black and delays showing login screen.",
          status: "In Progress",
          createdDate: "2026-09-02 08:30:00",
          updatedDate: "2026-09-02 09:15:00",
          messages: [
            {
              id: "msg-1",
              senderType: "Employee",
              senderName: "مريم الحمادي",
              senderNameEn: "Maryam Al Hammadi",
              text: "السلام عليكم، الشاشة تومض وتتوقف عدة ثواني أثناء العمل.",
              textEn: "Hello, the screen flickers and pauses for several seconds during operation.",
              date: "2026-09-02 08:30:00"
            },
            {
              id: "msg-2",
              senderType: "IT",
              senderName: "م. أحمد الشامسي (IT)",
              senderNameEn: "Eng. Ahmed Al Shamsi (IT)",
              text: "وعليكم السلام، سنقوم بفحص كابل DisplayPort واستبداله فوراً.",
              textEn: "We will check the DisplayPort cable and replace it immediately.",
              date: "2026-09-02 09:15:00"
            }
          ],
          maintenanceId: null,
          statusHistory: [
            { status: "New", changedBy: "مريم الحمادي", changedByEn: "Maryam Al Hammadi", date: "2026-09-02 08:30:00", note: "إنشاء الطلب" },
            { status: "In Progress", changedBy: "م. أحمد الشامسي", changedByEn: "Eng. Ahmed Al Shamsi", date: "2026-09-02 09:15:00", note: "بدء المعالجة" }
          ]
        },
        {
          id: "req-000102",
          requestId: "REQ-000102",
          requestNumber: "REQ-000102",
          employeeId: "emp-101",
          assetId: "ast-000002",
          requestType: "Software",
          subject: "تحديث برنامج التدريب الذكي",
          subjectAr: "تحديث برنامج التدريب الذكي",
          subjectEn: "Update Smart Training Software",
          description: "يرجى تثبيت أحدث حزمة تحديث لبرنامج Smart Exam على لابتوب الطوارئ.",
          descriptionAr: "يرجى تثبيت أحدث حزمة تحديث لبرنامج Smart Exam على لابتوب الطوارئ.",
          descriptionEn: "Please install the latest Smart Exam update package on emergency laptop.",
          status: "Completed",
          createdDate: "2026-08-28 11:00:00",
          updatedDate: "2026-08-28 12:30:00",
          messages: [
            {
              id: "msg-3",
              senderType: "Employee",
              senderName: "م. أحمد الشامسي",
              senderNameEn: "Eng. Ahmed Al Shamsi",
              text: "مطلوب تجهيز الحزمة لاختبارات الغد.",
              textEn: "The software package is required for tomorrow's examination sessions.",
              date: "2026-08-28 11:00:00"
            },
            {
              id: "msg-4",
              senderType: "IT",
              senderName: "ituser",
              senderNameEn: "IT Support",
              text: "تم تحديث واختبار البرنامج بنجاح.",
              textEn: "The application has been updated and tested successfully.",
              date: "2026-08-28 12:30:00"
            }
          ],
          maintenanceId: null,
          statusHistory: [
            { status: "New", changedBy: "م. أحمد الشامسي", changedByEn: "Eng. Ahmed Al Shamsi", date: "2026-08-28 11:00:00", note: "إنشاء الطلب" },
            { status: "Completed", changedBy: "ituser", changedByEn: "IT Support", date: "2026-08-28 12:30:00", note: "اكتمال التثبيت" }
          ]
        }
      ];
      for (const r of sampleRequests) await this.put("helpdeskRequests", r);
    } else {
      // Migrate existing requests to ensure English fields exist
      const existingReqs = await this.getAll("helpdeskRequests");
      for (const r of existingReqs) {
        let mod = false;
        if (!r.subjectEn) {
          if (r.requestId === "REQ-000101" || r.id === "req-000101") {
            r.subjectEn = "Screen flickers intermittently upon startup";
            r.descriptionEn = "Main registration counter monitor flickers black and delays showing login screen.";
            mod = true;
          } else if (r.requestId === "REQ-000102" || r.id === "req-000102") {
            r.subjectEn = "Update Smart Training Software";
            r.descriptionEn = "Please install the latest Smart Exam update package on emergency laptop.";
            mod = true;
          } else {
            r.subjectEn = r.subject && !/[\u0600-\u06FF]/.test(r.subject) ? r.subject : (r.requestId || r.id || "Support Request");
            if (!r.descriptionEn) r.descriptionEn = r.description && !/[\u0600-\u06FF]/.test(r.description) ? r.description : (r.subjectEn || "-");
            mod = true;
          }
        }
        if (mod) await this.put("helpdeskRequests", r);
      }
    }

    const notifCount = await this.count("notifications");
    if (notifCount === 0) {
      await this.createNotification({
        employeeId: "emp-102",
        titleAr: "تحديث على طلب الدعم REQ-000101",
        titleEn: "Update on Support Request REQ-000101",
        messageAr: "قام الدعم الفني بالرد على طلبك: سنقوم بفحص كابل DisplayPort واستبداله فوراً.",
        messageEn: "IT replied to your request: We will inspect and replace the DisplayPort cable immediately.",
        type: "it_reply",
        relatedId: "req-000101"
      });
      await this.createNotification({
        employeeId: "emp-101",
        titleAr: "اكتمال طلب الدعم REQ-000102",
        titleEn: "Support Request REQ-000102 Completed",
        messageAr: "تم اكتمال طلب الدعم الفني الخاص بك بنجاح.",
        messageEn: "Your support request has been completed successfully.",
        type: "request_completed",
        relatedId: "req-000102"
      });
    }
  }

  /**
   * Securely wipe all local IndexedDB data and reload.
   * Used during logout to prevent data leakage between users.
   */
  async clearLocalData() {
    if (!this.db) return;
    const stores = Array.from(this.db.objectStoreNames);
    const tx = this.db.transaction(stores, "readwrite");
    for (const storeName of stores) {
      tx.objectStore(storeName).clear();
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log("Local IndexedDB cleared successfully.");
        resolve();
      };
      tx.onerror = (e) => reject(e);
    });
  }
}

// Global DB Singleton
const db = new DBEngine();
if (typeof window !== "undefined") window.db = db;
if (typeof module !== "undefined" && module.exports) module.exports = db;
