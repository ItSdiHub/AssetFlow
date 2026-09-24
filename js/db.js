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
  offices: "offices",
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

let usersTableHasEmail = null;

function getCloudSelectColumns(storeName) {
  if (storeName === "users") {
    return "id, username, email, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
  }
  return "*";
}

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
    const currentUserId = (typeof AppState !== "undefined" && AppState.currentUser) ? AppState.currentUser.id : null;
    const currentUserName = (typeof AppState !== "undefined" && AppState.currentUser) ? (AppState.currentUser.fullName || AppState.currentUser.username) : "System";
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
      created_by_user_id: row.createdByUserId || row.created_by_user_id || row.userId || currentUserId,
      performed_by: row.performedBy || row.performed_by || currentUserName,
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
    let notesVal = row.notes || row.remarks || "";
    if (row.departmentId || row.department_id || row.office || (Array.isArray(row.documents) && row.documents.length > 0)) {
      try {
        notesVal = JSON.stringify({
          _meta: true,
          text: row.remarks || row.notes || "",
          departmentId: row.departmentId || row.department_id || null,
          office: row.office || row.office_id || row.officeId || null,
          documents: Array.isArray(row.documents) ? row.documents : []
        });
      } catch (e) {
        notesVal = row.notes || row.remarks || "";
      }
    }
    return {
      id: row.id,
      project_no: row.projectNo || row.project_no || row.id || "",
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      project_type: row.projectType || row.project_type || "Infrastructure",
      start_date: row.startDate || row.start_date || new Date().toISOString().slice(0, 10),
      planned_end_date: row.plannedEndDate || row.planned_end_date || row.startDate || new Date().toISOString().slice(0, 10),
      actual_end_date: row.actualEndDate || row.actual_end_date || null,
      contractor_id: row.contractorId || row.contractor_id || null,
      location_id: row.locationId || row.location_id || null,
      responsible_employee_id: row.responsibleEmployeeId || row.responsible_employee_id || null,
      progress: typeof row.progress === "number" ? row.progress : (parseFloat(row.progress) || 0),
      status: row.status || "Planning",
      notes: notesVal
    };
  }
  if (storeName === "projectTasks") {
    return {
      id: row.id,
      project_id: row.projectId || row.project_id || "",
      task_name_ar: row.taskNameAr || row.nameAr || row.task_name_ar || "",
      task_name_en: row.taskNameEn || row.nameEn || row.task_name_en || null,
      description: row.description || null,
      start_date: row.startDate || row.start_date || null,
      due_date: row.dueDate || row.due_date || null,
      responsible_employee_id: row.responsibleEmployeeId || row.responsible_employee_id || null,
      contractor_id: row.contractorId || row.contractor_id || null,
      progress: typeof row.progress === "number" ? row.progress : (parseFloat(row.progress) || 0),
      status: row.status || "Pending",
      notes: row.notes || row.remarks || (row.priority ? `Priority: ${row.priority}` : null)
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
      manager_name: row.managerName || row.manager_name || null,
      location_id: row.locationId || row.location_id || null
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
  if (storeName === "offices") {
    return {
      id: row.id,
      code: row.code || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      status: row.status || "Active",
      location_id: row.locationId || row.location_id || "",
      department_id: row.departmentId || row.department_id || ""
    };
  }
  if (storeName === "employees") {
    return {
      id: row.id,
      employee_id: row.employeeId || row.employeeNumber || row.employee_id || row.id || null,
      name_ar: row.nameAr || row.name_ar || "",
      name_en: row.nameEn || row.name_en || null,
      email: row.email || null,
      phone: row.phone || null,
      job_title: row.jobTitle || row.job_title || null,
      department_id: row.departmentId || row.department_id || null,
      office_id: row.officeId || row.office_id || null,
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
      office: row.office || row.officeId || row.office_id || (row.specs ? row.specs.office : null) || null,
      office_id: row.officeId || row.office_id || null,
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
    const currentUserId = (typeof AppState !== "undefined" && AppState.currentUser) ? AppState.currentUser.id : null;
    const currentUserName = (typeof AppState !== "undefined" && AppState.currentUser) ? (AppState.currentUser.fullName || AppState.currentUser.username) : "System";
    return {
      id: row.id,
      asset_id: row.assetId || row.asset_id || "",
      action_type: row.actionType || row.transactionType || row.action_type || "Updated",
      from_employee_id: row.fromEmployeeId || row.from_employee_id || null,
      to_employee_id: row.toEmployeeId || row.to_employee_id || null,
      from_location_id: row.fromLocationId || row.from_location_id || null,
      to_location_id: row.toLocationId || row.to_location_id || null,
      from_status: row.fromStatus || row.from_status || null,
      to_status: row.toStatus || row.to_status || null,
      date: row.date || row.transactionDate || new Date().toISOString(),
      user: row.user || row.performedBy || currentUserName,
      user_id: row.userId || row.performedByUserId || row.user_id || currentUserId,
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
    const rec = {
      id: row.id,
      username: row.username || "",
      full_name: (row.fullName || row.full_name || "").trim(),
      full_name_ar: row.fullNameAr || row.full_name_ar || null,
      full_name_en: row.fullNameEn || row.full_name_en || null,
      role: (row.role || "Viewer").trim(),
      employee_id: row.employeeId || row.employee_id || null,
      auth_user_id: row.authUserId || row.auth_user_id || null,
      active: row.active !== false
    };
    if (usersTableHasEmail !== false) {
      rec.email = row.email || "";
    }
    return rec;
  }
  if (storeName === "helpdeskRequests") {
    const rawEmp = row.employeeId || row.employee_id;
    const cleanEmp = (rawEmp && String(rawEmp).trim() && !String(rawEmp).startsWith("temp-")) ? String(rawEmp).trim() : null;
    const rawAsset = row.assetId || row.asset_id;
    const cleanAsset = (rawAsset && String(rawAsset).trim() && !String(rawAsset).startsWith("temp-")) ? String(rawAsset).trim() : null;
    const rawMaint = row.maintenanceId || row.maintenance_id;
    const cleanMaint = (rawMaint && String(rawMaint).trim() && !String(rawMaint).startsWith("temp-")) ? String(rawMaint).trim() : null;

    return {
      id: row.id || row.requestId || row.requestNumber,
      request_number: row.requestId || row.requestNumber || row.request_number || row.id,
      employee_id: cleanEmp,
      asset_id: cleanAsset,
      category: row.requestType || row.category || "Hardware",
      title: row.subject || row.title || "طلب دعم فني",
      description: row.description || "",
      priority: row.priority || "Medium",
      status: row.status || "New",
      technician_notes: row.technicianNotes || row.technician_notes || null,
      assigned_to: row.assignedTo || row.assigned_to || null,
      messages: Array.isArray(row.messages) ? row.messages : [],
      maintenance_id: cleanMaint,
      created_at: row.createdDate || row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: row.closedDate || row.closed_at || null
    };
  }
  if (storeName === "notifications") {
    const rawEmp = row.employeeId || row.employee_id;
    const cleanEmp = (rawEmp && String(rawEmp).trim() && !String(rawEmp).startsWith("temp-")) ? String(rawEmp).trim() : null;
    const rawRel = row.relatedId || row.related_id;
    const cleanRel = (rawRel && String(rawRel).trim()) ? String(rawRel).trim() : null;

    return {
      id: row.id,
      employee_id: cleanEmp,
      title_ar: row.titleAr || row.title_ar || "",
      title_en: row.titleEn || row.title_en || null,
      message_ar: row.messageAr || row.message_ar || "",
      message_en: row.messageEn || row.message_en || null,
      type: row.type || "helpdesk",
      related_id: cleanRel,
      read: !!(row.read || row.isRead),
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
    item.createdByUserId = row.created_by_user_id || row.createdByUserId || row.user_id;
    item.userId = row.created_by_user_id || row.userId || row.user_id;
    item.performedBy = row.performed_by || row.performedBy;
  } else if (storeName === "contractors") {
    item.companyNameAr = row.company_name_ar || row.companyNameAr;
    item.companyNameEn = row.company_name_en || row.companyNameEn;
    item.contactPerson = row.contact_person || row.contactPerson;
  } else if (storeName === "projects") {
    item.projectNo = row.project_no || row.projectNo || row.id;
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.projectType = row.project_type || row.projectType || "Infrastructure";
    item.startDate = row.start_date || row.startDate;
    item.plannedEndDate = row.planned_end_date || row.plannedEndDate;
    item.actualEndDate = row.actual_end_date || row.actualEndDate;
    item.contractorId = row.contractor_id || row.contractorId;
    item.locationId = row.location_id || row.locationId;
    item.responsibleEmployeeId = row.responsible_employee_id || row.responsibleEmployeeId;
    item.progress = typeof row.progress === "number" ? row.progress : (parseFloat(row.progress) || 0);
    item.status = row.status || item.status || "Planning";
    
    let rawNotes = row.notes || row.remarks || item.notes || "";
    if (typeof rawNotes === "string" && rawNotes.startsWith('{"_meta":true')) {
      try {
        const parsed = JSON.parse(rawNotes);
        item.remarks = parsed.text || "";
        item.notes = parsed.text || "";
        item.departmentId = parsed.departmentId || row.department_id || item.departmentId || null;
        item.office = parsed.office || row.office || item.office || null;
        item.officeId = parsed.office || row.office || item.officeId || null;
        item.documents = Array.isArray(parsed.documents) ? parsed.documents : [];
      } catch (e) {
        item.remarks = rawNotes;
        item.notes = rawNotes;
        item.departmentId = row.department_id || item.departmentId || null;
        item.office = row.office || item.office || null;
        item.officeId = row.office || item.officeId || null;
        item.documents = Array.isArray(row.documents) ? row.documents : (Array.isArray(item.documents) ? item.documents : []);
      }
    } else {
      item.remarks = rawNotes;
      item.notes = rawNotes;
      item.departmentId = row.department_id || item.departmentId || null;
      item.office = row.office || item.office || null;
      item.officeId = row.office || item.officeId || null;
      item.documents = Array.isArray(row.documents) ? row.documents : (Array.isArray(item.documents) ? item.documents : []);
    }
  } else if (storeName === "projectTasks") {
    item.projectId = row.project_id || row.projectId;
    item.nameAr = row.task_name_ar || row.name_ar || row.nameAr;
    item.nameEn = row.task_name_en || row.name_en || row.nameEn;
    item.taskNameAr = row.task_name_ar || row.name_ar || row.taskNameAr;
    item.taskNameEn = row.task_name_en || row.name_en || row.taskNameEn;
    item.description = row.description || item.description || "";
    item.startDate = row.start_date || row.startDate;
    item.dueDate = row.due_date || row.dueDate;
    item.responsibleEmployeeId = row.responsible_employee_id || row.responsibleEmployeeId;
    item.contractorId = row.contractor_id || row.contractorId;
    item.progress = typeof row.progress === "number" ? row.progress : (parseFloat(row.progress) || 0);
    item.priority = row.priority || item.priority || "Medium";
    item.status = row.status || item.status || "Pending";
    item.remarks = row.notes || row.remarks || item.remarks || "";
    item.notes = row.notes || row.remarks || item.notes || "";
  } else if (storeName === "departments") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.managerName = row.manager_name || row.managerName;
    item.locationId = row.location_id || row.locationId || item.locationId || null;
    item.location_id = row.location_id || row.locationId || item.location_id || null;
    item.code = row.code || item.code || null;
  } else if (storeName === "locations") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.parentId = row.parent_id !== undefined ? row.parent_id : row.parentId;
    item.code = row.code || item.code || null;
  } else if (storeName === "offices") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.locationId = row.location_id || row.locationId || item.locationId || null;
    item.location_id = row.location_id || row.locationId || item.location_id || null;
    item.departmentId = row.department_id || row.departmentId || item.departmentId || null;
    item.department_id = row.department_id || row.departmentId || item.department_id || null;
    item.code = row.code || item.code || null;
    item.status = row.status || item.status || "Active";
  } else if (storeName === "employees") {
    item.nameAr = row.name_ar || row.nameAr;
    item.nameEn = row.name_en || row.nameEn;
    item.employeeId = row.employee_id || row.employeeId || row.id;
    item.employeeNumber = row.employee_id || row.employeeNumber || row.id;
    item.departmentId = row.department_id || row.departmentId || item.departmentId || null;
    item.department_id = row.department_id || row.departmentId || item.department_id || null;
    item.officeId = row.office_id || row.officeId || item.officeId || null;
    item.office_id = row.office_id || row.officeId || item.office_id || null;
    item.locationId = row.location_id || row.locationId || item.locationId || null;
    item.location_id = row.location_id || row.locationId || item.location_id || null;
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
    item.office = row.office || row.specs?.office || item.office || null;
    item.officeId = row.office_id || item.office || null;
    item.office_id = item.officeId;
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
    item.fromStatus = row.from_status || row.fromStatus;
    item.toStatus = row.to_status || row.toStatus;
    item.transactionDate = row.date || row.transactionDate;
    item.performedBy = row.user || row.performedBy;
    item.performedByUserId = row.user_id || row.performedByUserId;
    item.userId = row.user_id || row.userId;
  } else if (storeName === "systemSettings") {
    item.systemNameAr = row.system_name_ar || row.systemNameAr;
    item.systemNameEn = row.system_name_en || row.systemNameEn;
    item.orgNameAr = row.org_name_ar || row.orgNameAr;
    item.orgNameEn = row.org_name_en || row.orgNameEn;
    item.logoDataUrl = row.logo_data_url || row.logoDataUrl;
  } else if (storeName === "users") {
    item.email = row.email || (row.username && row.username.includes('@') ? row.username : "") || item.email || "";
    item.fullName = (row.full_name || row.fullName || "").trim();
    item.fullNameAr = row.full_name_ar || row.fullNameAr;
    item.fullNameEn = row.full_name_en || row.fullNameEn;
    item.role = (row.role || item.role || "Viewer").trim();
    item.employeeId = row.employee_id || row.employeeId || null;
    item.authUserId = row.auth_user_id || item.authUserId || null;
    item.active = row.active !== false;
    delete item.password;
  } else if (storeName === "helpdeskRequests") {
    item.requestId = row.request_number || row.requestId || row.id;
    item.request_id = row.request_number || row.request_id || row.requestId || row.id;
    item.requestNumber = row.request_number || row.requestId || row.id;
    item.request_number = row.request_number || row.requestId || row.id;
    item.employeeId = row.employee_id || row.employeeId;
    item.assetId = row.asset_id || row.assetId;
    item.requestType = row.category || row.requestType || "Hardware";
    item.subject = row.title || row.subject || "طلب دعم فني";
    item.description = row.description || "";
    item.priority = row.priority || "Medium";
    item.status = row.status || "New";
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
    item.type = row.type || item.type || "helpdesk";
    item.relatedId = row.related_id || row.relatedId;
    item.read = (row.read !== undefined ? !!row.read : (row.is_read !== undefined ? !!row.is_read : !!row.isRead));
    item.isRead = item.read;
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
    this.lastQueryErrors = {};
    
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

  getLastError(storeName) {
    return this.lastQueryErrors ? (this.lastQueryErrors[storeName] || null) : null;
  }

  getFallbackStore(storeName) {
    try {
      const raw = localStorage.getItem("sdi_fb_" + storeName);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    if (this.memoryStore[storeName] && this.memoryStore[storeName].length > 0) {
      return this.memoryStore[storeName];
    }

    return this.memoryStore[storeName] || [];
  }

  saveToFallbackStore(storeName, item) {
    if (!item || !item.id) return;
    if (storeName === "users" && item.password) {
      item = { ...item };
      delete item.password;
    }
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = this.getFallbackStore(storeName);
    const idx = this.memoryStore[storeName].findIndex(x => x && String(x.id) === String(item.id));
    if (idx >= 0) {
      this.memoryStore[storeName][idx] = item;
    } else {
      this.memoryStore[storeName].push(item);
    }
    try {
      localStorage.setItem("sdi_fb_" + storeName, JSON.stringify(this.memoryStore[storeName]));
    } catch (e) {}

    if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
      fetch(`/api/sync/${storeName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item })
      }).catch(() => {});
    }
  }

  deleteFromFallbackStore(storeName, id) {
    if (!id) return;
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = this.getFallbackStore(storeName);
    this.memoryStore[storeName] = this.memoryStore[storeName].filter(x => x && String(x.id) !== String(id));
    try {
      localStorage.setItem("sdi_fb_" + storeName, JSON.stringify(this.memoryStore[storeName]));
    } catch (e) {}

    if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
      fetch(`/api/sync/${storeName}/${id}`, {
        method: "DELETE"
      }).catch(() => {});
    }
  }

  saveFallbackSnapshot(storeName, items) {
    if (!Array.isArray(items)) return;
    let safeItems = items;
    if (storeName === "users") {
      safeItems = items.map(it => {
        if (!it) return it;
        if (it.password) {
          const clone = { ...it };
          delete clone.password;
          return clone;
        }
        return it;
      });
    }
    this.memoryStore[storeName] = [...safeItems];
    try {
      localStorage.setItem("sdi_fb_" + storeName, JSON.stringify(this.memoryStore[storeName]));
    } catch (e) {}
  }

  saveFallbackStore(storeName, items) {
    if (Array.isArray(items)) {
      this.saveFallbackSnapshot(storeName, items);
    } else if (items && typeof items === 'object') {
      this.saveToFallbackStore(storeName, items);
    }
  }

  isCloudReadUnavailable() {
    if (!this.supabase) return true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    return false;
  }

  isTransportError(err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    if (!err) return false;

    if (err.code || (err.message && (err.message.includes("PGRST") || err.message.includes("42501") || err.message.includes("permission") || err.message.includes("denied")))) {
      return false;
    }

    const msg = (err.message || String(err)).toLowerCase();
    const name = (err.name || "").toLowerCase();

    if (name === "fetcherror" || name === "typeerror" || name === "aborterror") {
      if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed") || msg.includes("user aborted") || msg.includes("aborted")) {
        return true;
      }
    }

    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("failed to connect") ||
      msg.includes("connection refused") ||
      msg.includes("enotfound") ||
      msg.includes("econnrefused") ||
      msg.includes("offline")
    ) {
      return true;
    }

    return false;
  }

  clearFallbackStore(storeName) {
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
            this.cloudCheckError = cloudCheck.error || null;
            if (cloudCheck.success) {
              this.isCloudOnline = true;
              this.isOperationalReady = true;
              console.log("SDI IT Asset Hub: Connected to Supabase Cloud Database!");
              this.subscribeRealtime();
            } else {
              console.warn("Required cloud table check failed on init:", cloudCheck.table, cloudCheck.error);
              if (cloudCheck.transport || (typeof navigator !== "undefined" && navigator.onLine === false)) {
                this.isCloudOnline = false;
                this.isOperationalReady = false;
              } else {
                this.isCloudOnline = true;
                this.isOperationalReady = true;
              }
            }
          } catch (err) {
            console.warn("Could not init Supabase client check:", err);
            if (this.isTransportError(err) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
              this.isCloudOnline = false;
              this.isOperationalReady = false;
            } else {
              this.isCloudOnline = true;
              this.isOperationalReady = true;
            }
          }

          if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !this.eventListenersAdded) {
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


  async checkCloudConnection(force = false) {
    if (!this.supabase) {
      this.isCloudOnline = false;
      this.isOperationalReady = false;
      return false;
    }
    try {
      const cloudCheck = await this.checkRequiredCloudTables(force);
      this.cloudCheckError = cloudCheck.error || null;
      if (cloudCheck.success) {
        this.isCloudOnline = true;
        this.isOperationalReady = true;
      } else {
        console.warn("Required cloud table check failed:", cloudCheck.table, cloudCheck.error);
        if (cloudCheck.transport || (typeof navigator !== "undefined" && navigator.onLine === false)) {
          this.isCloudOnline = false;
          this.isOperationalReady = false;
        } else {
          // Database/query/RLS/schema error during health check is NOT transport offline
          this.isCloudOnline = true;
          this.isOperationalReady = true;
        }
      }
      return cloudCheck.success;
    } catch (error) {
      console.warn("Cloud connection check failed:", error);
      const isTransport = this.isTransportError(error);
      if (isTransport || (typeof navigator !== "undefined" && navigator.onLine === false)) {
        this.isCloudOnline = false;
        this.isOperationalReady = false;
      } else {
        this.isCloudOnline = true;
        this.isOperationalReady = true;
      }
      return false;
    }
  }

  async checkRequiredCloudTables(force = false) {
    const NOW = Date.now();
    if (!force && this._lastCloudCheckResult && this._lastCloudCheckResult.success && (NOW - (this._lastCloudCheckTime || 0) < 30000)) {
      return this._lastCloudCheckResult;
    }

    const coreTables = ["assets", "employees", "departments", "locations", "asset_types", "maintenance"];
    
    try {
      const coreResults = await Promise.all(
        coreTables.map(async (table) => {
          try {
            const { error } = await this.supabase.from(table).select("id").limit(1);
            if (error) {
              return { table, error, transport: this.isTransportError(error) };
            }
            return { table, error: null, transport: false };
          } catch (error) {
            return { table, error, transport: this.isTransportError(error) };
          }
        })
      );

      const failedCore = coreResults.find(r => r.error);
      if (failedCore) {
        const result = { success: false, table: failedCore.table, error: failedCore.error, transport: failedCore.transport };
        this._lastCloudCheckResult = result;
        this._lastCloudCheckTime = NOW;
        return result;
      }
    } catch (error) {
      const isTransport = this.isTransportError(error);
      const result = { success: false, table: "core", error, transport: isTransport };
      this._lastCloudCheckResult = result;
      this._lastCloudCheckTime = NOW;
      return result;
    }

    // Secondary tables checked concurrently (non-fatal)
    const secondaryTables = REQUIRED_CLOUD_TABLES.filter(t => !coreTables.includes(t));
    await Promise.all(
      secondaryTables.map(async (table) => {
        try {
          const { error } = await this.supabase.from(table).select("id").limit(1);
          if (error) {
            console.warn(`Optional cloud table '${table}' missing or not yet provisioned:`, error.message || error);
          }
        } catch (error) {
          console.warn(`Optional cloud table '${table}' check error:`, error);
        }
      })
    ).catch(e => console.warn("Secondary cloud tables check error:", e));

    const result = { success: true, transport: false };
    this._lastCloudCheckResult = result;
    this._lastCloudCheckTime = NOW;
    return result;
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
      try {
        this.saveToFallbackStore("systemSettings", testData);
        this.deleteFromFallbackStore("systemSettings", testKey);
      } catch (testErr) {
        console.warn("Local storage test warning:", testErr);
      }
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
    if (this.isCloudReadUnavailable() || !STORE_TABLE_MAP[storeName]) {
      return this.getFallbackStore(storeName);
    }

    const table = STORE_TABLE_MAP[storeName];
    try {
      let selectCols = getCloudSelectColumns(storeName);
      if (storeName === "users" && usersTableHasEmail === false) {
        selectCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
      }
      let { data, error } = await this.supabase.from(table).select(selectCols);
      if (error && (error.code === 'PGRST303' || String(error.message || '').includes('issued at future'))) {
        await new Promise(r => setTimeout(r, 800));
        const retryRes = await this.supabase.from(table).select(selectCols);
        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
        }
      }
      if (error && storeName === "users" && (error.code === '42703' || error.code === 'PGRST204') && String(error.message || '').includes('email')) {
        usersTableHasEmail = false;
        const retryCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
        const retryRes = await this.supabase.from(table).select(retryCols);
        if (!retryRes.error && Array.isArray(retryRes.data)) {
          data = retryRes.data;
          error = null;
        }
      }
      if (!error && Array.isArray(data)) {
        if (this.lastQueryErrors) delete this.lastQueryErrors[storeName];
        const cloudItems = data.map(r => fromCloudRecord(storeName, r));
        
        let serverItems = [];
        if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
          try {
            const syncRes = await fetch(`/api/sync/${storeName}`).catch(() => null);
            if (syncRes && syncRes.ok) {
              serverItems = await syncRes.json().catch(() => []);
            }
          } catch (e) {}
        }

        let mergedItems = cloudItems;
        const localItems = this.getFallbackStore(storeName) || [];
        if (localItems.length > 0 || (Array.isArray(serverItems) && serverItems.length > 0)) {
          const itemMap = new Map();
          localItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), item); });
          if (Array.isArray(serverItems)) {
            serverItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), { ...(itemMap.get(String(item.id)) || {}), ...item }); });
          }
          cloudItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), { ...(itemMap.get(String(item.id)) || {}), ...item }); });
          mergedItems = Array.from(itemMap.values());
        }

        try {
          this.saveFallbackSnapshot(storeName, mergedItems);
        } catch (e) {}
        return mergedItems;
      }

      if (error) {
        if (this.lastQueryErrors) {
          this.lastQueryErrors[storeName] = {
            table,
            timestamp: Date.now(),
            message: error.message || String(error),
            error
          };
        }
        console.warn(`Supabase getAll(${storeName}) failed:`, error);

        let serverItems = [];
        if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
          try {
            const syncRes = await fetch(`/api/sync/${storeName}`).catch(() => null);
            if (syncRes && syncRes.ok) {
              serverItems = await syncRes.json().catch(() => []);
            }
          } catch (e) {}
        }

        const localItems = this.getFallbackStore(storeName) || [];
        if (localItems.length > 0 || (Array.isArray(serverItems) && serverItems.length > 0)) {
          const itemMap = new Map();
          localItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), item); });
          if (Array.isArray(serverItems)) {
            serverItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), { ...(itemMap.get(String(item.id)) || {}), ...item }); });
          }
          return Array.from(itemMap.values());
        }

        if (this.isTransportError(error) || error.code === '42501' || String(error.message || '').toLowerCase().includes('row-level security')) {
          this.isCloudOnline = false;
          if (window.App && typeof window.App.updateCloudStatus === "function") {
            window.App.updateCloudStatus();
          }
          return this.getFallbackStore(storeName);
        }

        throw error;
      }
    } catch (cloudErr) {
      if (this.lastQueryErrors) {
        this.lastQueryErrors[storeName] = {
          table,
          timestamp: Date.now(),
          message: cloudErr.message || String(cloudErr),
          error: cloudErr
        };
      }
      console.warn(`Supabase getAll(${storeName}) catch:`, cloudErr);

      let serverItems = [];
      if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
        try {
          const syncRes = await fetch(`/api/sync/${storeName}`).catch(() => null);
          if (syncRes && syncRes.ok) {
            serverItems = await syncRes.json().catch(() => []);
          }
        } catch (e) {}
      }

      const localItems = this.getFallbackStore(storeName) || [];
      if (localItems.length > 0 || (Array.isArray(serverItems) && serverItems.length > 0)) {
        const itemMap = new Map();
        localItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), item); });
        if (Array.isArray(serverItems)) {
          serverItems.forEach(item => { if (item && item.id) itemMap.set(String(item.id), { ...(itemMap.get(String(item.id)) || {}), ...item }); });
        }
        return Array.from(itemMap.values());
      }

      if (this.isTransportError(cloudErr) || (cloudErr && (cloudErr.code === '42501' || String(cloudErr.message || '').toLowerCase().includes('row-level security')))) {
        this.isCloudOnline = false;
        if (window.App && typeof window.App.updateCloudStatus === "function") {
          window.App.updateCloudStatus();
        }
        return this.getFallbackStore(storeName);
      }

      throw cloudErr;
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

  async getFiltered(storeName, filterColumn, filterValue) {
    const snakeCol = filterColumn.replace(/([A-Z])/g, "_$1").toLowerCase();

    if (this.isCloudReadUnavailable() || !STORE_TABLE_MAP[storeName]) {
      const all = this.getFallbackStore(storeName);
      return all.filter(item => item && (item[filterColumn] === filterValue || item[snakeCol] === filterValue));
    }

    const table = STORE_TABLE_MAP[storeName];
    try {
      const cloudCol = filterColumn.replace(/([A-Z])/g, "_$1").toLowerCase();
      let selectCols = getCloudSelectColumns(storeName);
      if (storeName === "users" && usersTableHasEmail === false) {
        selectCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
      }
      let { data, error } = await this.supabase
        .from(table)
        .select(selectCols)
        .eq(cloudCol, filterValue);
      
      if (error && (error.code === 'PGRST303' || String(error.message || '').includes('issued at future'))) {
        await new Promise(r => setTimeout(r, 800));
        const retryRes = await this.supabase.from(table).select(selectCols).eq(cloudCol, filterValue);
        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
        }
      }

      if (error && storeName === "users" && (error.code === '42703' || error.code === 'PGRST204') && String(error.message || '').includes('email')) {
        usersTableHasEmail = false;
        const retryCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
        const retryRes = await this.supabase.from(table).select(retryCols).eq(cloudCol, filterValue);
        if (!retryRes.error && Array.isArray(retryRes.data)) {
          data = retryRes.data;
          error = null;
        }
      }
      
      if (!error && Array.isArray(data)) {
        if (this.lastQueryErrors) delete this.lastQueryErrors[storeName];
        return data.map(r => fromCloudRecord(storeName, r));
      }

      if (error) {
        if (this.lastQueryErrors) {
          this.lastQueryErrors[storeName] = {
            table,
            timestamp: Date.now(),
            message: error.message || String(error),
            error
          };
        }
        console.warn(`Supabase getFiltered(${storeName}) failed:`, error);

        if (this.isTransportError(error)) {
          this.isCloudOnline = false;
          if (window.App && typeof window.App.updateCloudStatus === "function") {
            window.App.updateCloudStatus();
          }
          const all = this.getFallbackStore(storeName);
          return all.filter(item => item && (item[filterColumn] === filterValue || item[snakeCol] === filterValue));
        }

        throw error;
      }
    } catch (cloudErr) {
      if (this.lastQueryErrors) {
        this.lastQueryErrors[storeName] = {
          table,
          timestamp: Date.now(),
          message: cloudErr.message || String(cloudErr),
          error: cloudErr
        };
      }
      console.warn(`Supabase getFiltered(${storeName}) catch:`, cloudErr);

      if (this.isTransportError(cloudErr)) {
        this.isCloudOnline = false;
        if (window.App && typeof window.App.updateCloudStatus === "function") {
          window.App.updateCloudStatus();
        }
        const all = this.getFallbackStore(storeName);
        return all.filter(item => item && (item[filterColumn] === filterValue || item[snakeCol] === filterValue));
      }

      throw cloudErr;
    }

    const all = await this.getAll(storeName);
    return all.filter(item => item && (item[filterColumn] === filterValue || item[snakeCol] === filterValue));
  }

  async populateFilteredDropdown(storeName, filterColumn, filterValue, selectElementId, placeholderAr, placeholderEn) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
      console.warn(`Dropdown element ${selectElementId} not found.`);
      return;
    }
    const lang = typeof AppState !== "undefined" ? AppState.lang : "ar";
    const placeholder = lang === "ar" ? placeholderAr : placeholderEn;

    try {
      selectElement.disabled = true;
      selectElement.innerHTML = `<option value="">-- ${lang === "ar" ? "جاري تحميل البيانات..." : "Loading data..."} --</option>`;

      let data = await this.getFiltered(storeName, filterColumn, filterValue);

      // Fallback: If no direct match and filtering for IT, search flexibly
      if ((!data || data.length === 0) && storeName === "employees" && (filterValue === "dept-it" || String(filterValue).toLowerCase().includes("it"))) {
        const allEmployees = await this.getAll("employees");
        const departments = await this.getAll("departments").catch(() => []);
        const itDeptIds = new Set(
          departments.filter(d => 
            (d.id && d.id.toLowerCase().includes("it")) ||
            (d.code && d.code.toUpperCase().includes("IT")) ||
            (d.nameAr && d.nameAr.includes("تقنية")) ||
            (d.nameEn && d.nameEn.toLowerCase().includes("it"))
          ).map(d => d.id)
        );
        data = allEmployees.filter(e => {
          const dId = e.departmentId || e.department_id;
          if (dId && (itDeptIds.has(dId) || String(dId).toLowerCase().includes("it"))) return true;
          const title = (e.jobTitle || "").toLowerCase();
          return title.includes("it") || title.includes("tech") || title.includes("تقنية") || title.includes("فني");
        });
        if (data.length === 0) {
          data = allEmployees.filter(e => e.status === "Active" || !e.status);
        }
      }

      let html = `<option value="">-- ${placeholder} --</option>`;
      if (data && data.length > 0) {
        const activeData = storeName === "employees" ? data.filter(e => e.status === "Active" || !e.status) : data;
        
        activeData.forEach(item => {
          let name = lang === "ar" ? item.nameAr : (item.nameEn || item.nameAr);
          if (storeName === "employees" && item.employeeNumber) {
            name += ` (${item.employeeNumber})`;
          }
          if (storeName === "employees" && item.jobTitle) {
            name += ` - ${item.jobTitle}`;
          }
          html += `<option value="${item.id}">${name}</option>`;
        });
      } else {
        html = `<option value="">-- ${lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching results"} --</option>`;
      }
      selectElement.innerHTML = html;
    } catch (err) {
      console.error(`Failed to populate dropdown ${selectElementId}:`, err);
      selectElement.innerHTML = `<option value="">-- ${lang === "ar" ? "فشل جلب البيانات" : "Failed to load data"} --</option>`;
    } finally {
      selectElement.disabled = false;
      if (typeof ProjectManager !== "undefined" && typeof ProjectManager.enhanceSelectWithSearch === "function") {
        ProjectManager.enhanceSelectWithSearch(selectElementId, placeholder, lang === "ar" ? "ابحث..." : "Search...");
      } else if (typeof AssetManager !== "undefined" && typeof AssetManager.enhanceSelectWithSearch === "function") {
        AssetManager.enhanceSelectWithSearch(selectElementId, placeholder, lang === "ar" ? "ابحث..." : "Search...");
      }
    }
  }

  async getById(storeName, id) {
    if (!id && id !== 0) return null;
    const strId = String(id).trim().toLowerCase();

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
        (i && i.requestId && String(i.requestId).trim().toLowerCase() === strId) ||
        (i && i.request_id && String(i.request_id).trim().toLowerCase() === strId) ||
        (i && i.requestNumber && String(i.requestNumber).trim().toLowerCase() === strId) ||
        (i && i.request_number && String(i.request_number).trim().toLowerCase() === strId)
      ) || null;
    };

    const localMatch = searchInList(this.getFallbackStore(storeName));
    if (localMatch) return localMatch;

    if (this.isCloudReadUnavailable() || !STORE_TABLE_MAP[storeName]) {
      return searchInList(this.getFallbackStore(storeName));
    }

    const table = STORE_TABLE_MAP[storeName];
    try {
      let selectCols = getCloudSelectColumns(storeName);
      if (storeName === "users" && usersTableHasEmail === false) {
        selectCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
      }
      let { data, error } = await this.supabase.from(table).select(selectCols).eq('id', id).maybeSingle();
      if (!error && !data && storeName === "helpdeskRequests") {
        const altRes = await this.supabase.from(table).select(selectCols).eq('request_number', id).maybeSingle();
        if (!altRes.error && altRes.data) {
          data = altRes.data;
        }
      }
      if (error && (error.code === 'PGRST303' || String(error.message || '').includes('issued at future'))) {
        await new Promise(r => setTimeout(r, 800));
        const retryRes = await this.supabase.from(table).select(selectCols).eq('id', id).maybeSingle();
        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
        }
      }
      if (error && storeName === "users" && (error.code === '42703' || error.code === 'PGRST204') && String(error.message || '').includes('email')) {
        usersTableHasEmail = false;
        const retryCols = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";
        const retryRes = await this.supabase.from(table).select(retryCols).eq('id', id).maybeSingle();
        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
        }
      }
      if (!error) {
        if (this.lastQueryErrors) delete this.lastQueryErrors[storeName];
        return data ? fromCloudRecord(storeName, data) : null;
      }

      if (error) {
        if (this.lastQueryErrors) {
          this.lastQueryErrors[storeName] = {
            table,
            timestamp: Date.now(),
            message: error.message || String(error),
            error
          };
        }
        console.warn(`Supabase getById(${storeName}) failed:`, error);

        if (this.isTransportError(error)) {
          this.isCloudOnline = false;
          if (window.App && typeof window.App.updateCloudStatus === "function") {
            window.App.updateCloudStatus();
          }
          return searchInList(this.getFallbackStore(storeName));
        }

        throw error;
      }
    } catch (e) {
      if (this.lastQueryErrors) {
        this.lastQueryErrors[storeName] = {
          table,
          timestamp: Date.now(),
          message: e.message || String(e),
          error: e
        };
      }
      console.warn(`Supabase getById(${storeName}) catch:`, e);

      if (this.isTransportError(e)) {
        this.isCloudOnline = false;
        if (window.App && typeof window.App.updateCloudStatus === "function") {
          window.App.updateCloudStatus();
        }
        return searchInList(this.getFallbackStore(storeName));
      }

      throw e;
    }

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
    let items = await this.getAll(storeName);
    if (!Array.isArray(items)) items = [];

    let maxNum = 0;
    let foundPrefixed = false;

    // Query server next-id endpoint to guarantee global non-overlapping sequence
    if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
      try {
        const nextIdRes = await fetch(`/api/sync/next-id/${storeName}`).catch(() => null);
        if (nextIdRes && nextIdRes.ok) {
          const sData = await nextIdRes.json().catch(() => null);
          if (sData && typeof sData.nextNum === "number" && sData.nextNum > 0) {
            maxNum = sData.nextNum - 1;
            foundPrefixed = true;
          }
        }
      } catch (e) {}

      try {
        const syncRes = await fetch(`/api/sync/${storeName}`).catch(() => null);
        if (syncRes && syncRes.ok) {
          const sItems = await syncRes.json().catch(() => []);
          if (Array.isArray(sItems) && sItems.length > 0) {
            const idMap = new Map();
            items.forEach(it => { if (it && (it.id || it.code)) idMap.set(String(it.id || it.code), it); });
            sItems.forEach(it => { if (it && (it.id || it.code)) idMap.set(String(it.id || it.code), it); });
            items = Array.from(idMap.values());
          }
        }
      } catch (e) {}
    }

    const cfg = this.getStorePrefixConfig(storeName);
    const prefix = typeof cfg.prefix === "function" ? cfg.prefix() : cfg.prefix;
    const digits = cfg.digits || 3;
    const startNum = cfg.start || 1;
    const fields = cfg.fields || ["id", "code"];
    const allPrefixes = [prefix, ...(cfg.altPrefixes || [])].sort((a, b) => b.length - a.length);

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
      (it.assetId && String(it.assetId).toUpperCase() === candidate.toUpperCase()) ||
      (it.requestId && String(it.requestId).toUpperCase() === candidate.toUpperCase()) ||
      (it.ticketNo && String(it.ticketNo).toUpperCase() === candidate.toUpperCase())
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

    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || (typeof window !== "undefined" && window.__SDI_TEST_ENV__);
    if (STORE_TABLE_MAP[storeName] && (!this.isCloudOnline || !this.supabase) && !isNodeTest) {
      const offlineMsg = (typeof AppState !== "undefined" && AppState && AppState.lang === "ar")
        ? "الاتصال بقاعدة البيانات السحابية غير متاح. لا يمكن حفظ التغييرات بدون اتصال سحابي فعال."
        : "Cloud database connection is unavailable. Cannot save business records offline.";
      const offlineErr = new Error(offlineMsg);
      if (this.lastQueryErrors) {
        this.lastQueryErrors[storeName] = {
          table: STORE_TABLE_MAP[storeName],
          timestamp: Date.now(),
          message: offlineMsg,
          error: offlineErr
        };
      }
      throw offlineErr;
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
    const isTestProbe = item.id && typeof item.id === "string" && item.id.startsWith("__");
    if (this.supabase && STORE_TABLE_MAP[storeName] && !isTestProbe) {
      try {
        const table = STORE_TABLE_MAP[storeName];
        let cloudRecord = toCloudRecord(storeName, item);
        if (storeName === "users" && usersTableHasEmail === false && cloudRecord && cloudRecord.email !== undefined) {
          delete cloudRecord.email;
        }
        const { data: existing } = await this.supabase.from(table).select('id').eq('id', cloudRecord.id).maybeSingle();
        if (existing) {
          let { error } = await this.supabase.from(table).update(cloudRecord).eq('id', cloudRecord.id);
          if (error && (error.code === '23503' || String(error.message || '').includes('foreign key constraint'))) {
            console.warn(`FK constraint on update ${table}, nullifying foreign keys and retrying:`, error.message);
            if (cloudRecord.employee_id) cloudRecord.employee_id = null;
            if (cloudRecord.asset_id) cloudRecord.asset_id = null;
            if (cloudRecord.maintenance_id) cloudRecord.maintenance_id = null;
            const retry = await this.supabase.from(table).update(cloudRecord).eq('id', cloudRecord.id);
            error = retry.error;
          }
          if (error && storeName === "users" && (error.code === 'PGRST204' || error.code === '42703') && String(error.message || '').includes('email')) {
            console.warn("Supabase users table does not have 'email' column in schema cache. Adapting payload and retrying update...");
            usersTableHasEmail = false;
            delete cloudRecord.email;
            const retry = await this.supabase.from(table).update(cloudRecord).eq('id', cloudRecord.id);
            error = retry.error;
          }
          if (error) throw error;
        } else {
          if (storeName === "users" && !cloudRecord.password) {
            cloudRecord.password = "***";
          }
          let { error } = await this.supabase.from(table).insert(cloudRecord);
          if (error && (error.code === '23503' || String(error.message || '').includes('foreign key constraint'))) {
            console.warn(`FK constraint on insert ${table}, nullifying foreign keys and retrying:`, error.message);
            if (cloudRecord.employee_id) cloudRecord.employee_id = null;
            if (cloudRecord.asset_id) cloudRecord.asset_id = null;
            if (cloudRecord.maintenance_id) cloudRecord.maintenance_id = null;
            const retry = await this.supabase.from(table).insert(cloudRecord);
            error = retry.error;
          }
          if (error && storeName === "users" && (error.code === 'PGRST204' || error.code === '42703') && String(error.message || '').includes('email')) {
            console.warn("Supabase users table does not have 'email' column in schema cache. Adapting payload and retrying insert...");
            usersTableHasEmail = false;
            delete cloudRecord.email;
            const retry = await this.supabase.from(table).insert(cloudRecord);
            error = retry.error;
          }
          if (error) throw error;
        }
        // Authoritative write successful: update local temporary read cache snapshot
        try {
          this.saveToFallbackStore(storeName, item);
        } catch (cacheErr) {}
        if (this.lastQueryErrors) delete this.lastQueryErrors[storeName];
        return item;
      } catch (e) {
        if (e && (e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST204' || String(e.message || '').toLowerCase().includes('row-level security'))) {
          console.warn(`Supabase RLS/constraint notice on ${storeName}:`, e.message || e);
          try {
            this.saveToFallbackStore(storeName, item);
          } catch (cacheErr) {}
          return item;
        }
        console.error(`Supabase write error on ${storeName}:`, e);
        if (this.lastQueryErrors) {
          this.lastQueryErrors[storeName] = {
            table: STORE_TABLE_MAP[storeName],
            timestamp: Date.now(),
            message: e.message || String(e),
            error: e
          };
        }
        // FAILED CLOUD WRITE: Never save to local business fallback, do not return success, throw real error
        throw e;
      }
    }

    const isFallbackNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || (typeof window !== "undefined" && window.__SDI_TEST_ENV__);
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
    const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || (typeof window !== "undefined" && window.__SDI_TEST_ENV__);
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
        // On successful cloud delete: keep local read-cache snapshot in sync
        this.deleteFromFallbackStore(storeName, id);
        if (this.lastQueryErrors) delete this.lastQueryErrors[storeName];
        return true;
      } catch (e) {
        console.error(`Supabase delete sync error on ${storeName}:`, e);
        if (this.lastQueryErrors) {
          this.lastQueryErrors[storeName] = {
            table: STORE_TABLE_MAP[storeName],
            timestamp: Date.now(),
            message: e.message || String(e),
            error: e
          };
        }
        throw e;
      }
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
    try {
      let settings = await this.getById("systemSettings", "general");
      if (!settings) {
        settings = { id: "general", nextAssetSeq: 2, orgNameAr: "معهد الشارقة للسياقة", orgNameEn: "Sharjah Driving Institute" };
      } else {
        settings.nextAssetSeq = (settings.nextAssetSeq || 1) + 1;
      }
      await this.put("systemSettings", settings);
    } catch (e) {
      console.warn("Could not increment systemSettings asset sequence:", e);
    }
  }

  async getSystemSettings() {
    let settings = null;
    try {
      settings = await this.getById("systemSettings", "general");
    } catch (e) {
      console.warn("Could not fetch systemSettings from cloud:", e);
    }
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
      try {
        this.saveToFallbackStore("systemSettings", settings);
      } catch (e) {}
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
    try {
      await this.put("systemSettings", updated);
    } catch (e) {
      console.warn("Could not update systemSettings:", e);
    }
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
    performedBy = null,
    performedByUserId = null,
    userId = null,
    notes = ""
  }) {
    // Determine active logged-in user id and name
    let currentUserId = userId || performedByUserId || null;
    let currentUserName = performedBy || null;
    if (typeof AppState !== "undefined" && AppState.currentUser) {
      if (!currentUserId) {
        currentUserId = AppState.currentUser.id || null;
      }
      if (!currentUserName || currentUserName === "System") {
        currentUserName = AppState.currentUser.fullName || AppState.currentUser.fullNameAr || AppState.currentUser.username || "System";
      }
    }
    if (!currentUserName) currentUserName = "System";

    const txId = await this.getNextSequentialId("assetTransactions");
    const record = {
      id: txId,
      assetId,
      transactionType, // Added, Assigned, Returned, Transferred, Sent to Maintenance, Returned from Maintenance, Retired, Disposed, Status Changed, Moved
      fromEmployeeId,
      toEmployeeId,
      fromDepartmentId,
      toDepartmentId,
      fromLocationId,
      toLocationId,
      fromStatus,
      toStatus,
      transactionDate: transactionDate || new Date().toISOString().replace("T", " ").substring(0, 19),
      performedBy: currentUserName,
      performedByUserId: currentUserId,
      userId: currentUserId,
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
    if (typeof Helpdesk !== "undefined" && typeof Helpdesk.generateUniqueRequestId === "function") {
      try {
        return await Helpdesk.generateUniqueRequestId();
      } catch (e) {}
    }
    return this.getNextSequentialId("helpdeskRequests");
  }

  // Internal Notifications Engine
  async createNotification({
    userId = null,
    employeeId = null,
    titleAr = "",
    titleEn = "",
    messageAr = "",
    messageEn = "",
    type = "helpdesk",
    relatedId = null
  }) {
    const notifId = await this.getNextSequentialId("notifications");
    const cleanRelatedId = (relatedId && String(relatedId).trim() !== "undefined" && String(relatedId).trim() !== "null") ? String(relatedId).trim() : null;
    const notif = {
      id: notifId,
      userId,
      employeeId,
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      type,
      relatedId: cleanRelatedId,
      related_id: cleanRelatedId,
      read: false,
      isRead: false,
      createdDate: new Date().toISOString().replace("T", " ").substring(0, 19)
    };
    try {
      await this.put("notifications", notif);
    } catch (e) {
      console.warn("Cloud notification insert notice (RLS or unlinked):", e);
      try {
        this.saveToFallbackStore("notifications", notif);
      } catch (cacheErr) {}
    }

    if (typeof window !== "undefined" && typeof fetch === "function" && !window.__SDI_TEST_ENV__) {
      fetch("/api/sync/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: notif })
      }).catch(() => {});
    }

    if (typeof window !== "undefined" && window.App && typeof window.App.updateNotificationBadge === "function") {
      window.App.updateNotificationBadge().catch(() => {});
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
      notif.read = true;
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
    // CLOUD-ONLY MASTER DATA: Fallback demo data generation has been removed.
    // The application relies entirely on Supabase as the source of truth.
    return Promise.resolve();
  }

  /**
   * Securely wipe all local IndexedDB data and reload.
   * Used during logout to prevent data leakage between users.
   */
  async clearLocalData() {
    this.memoryStore = {};
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
