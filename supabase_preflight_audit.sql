-- SDI IT Asset Hub - Read-only production preflight audit
-- Run this in Supabase SQL Editor before applying supabase_schema.sql.
-- This script never updates or deletes data.

-- Duplicate identifiers that would block unique indexes.
SELECT 'duplicate_asset_id' AS check_name, asset_id AS value, COUNT(*) AS row_count
FROM public.assets
WHERE asset_id IS NOT NULL AND BTRIM(asset_id) <> ''
GROUP BY asset_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

SELECT 'duplicate_barcode' AS check_name, barcode_value AS value, COUNT(*) AS row_count
FROM public.assets
WHERE barcode_value IS NOT NULL AND BTRIM(barcode_value) <> ''
GROUP BY barcode_value
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

SELECT 'duplicate_qr_code' AS check_name, qr_code_value AS value, COUNT(*) AS row_count
FROM public.assets
WHERE qr_code_value IS NOT NULL AND BTRIM(qr_code_value) <> ''
GROUP BY qr_code_value
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

SELECT 'duplicate_issue_no' AS check_name, issue_no AS value, COUNT(*) AS row_count
FROM public.warehouse_issues
WHERE issue_no IS NOT NULL AND BTRIM(issue_no) <> ''
GROUP BY issue_no
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

SELECT 'duplicate_transfer_no' AS check_name, transfer_no AS value, COUNT(*) AS row_count
FROM public.asset_transfers
WHERE transfer_no IS NOT NULL AND BTRIM(transfer_no) <> ''
GROUP BY transfer_no
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

SELECT 'duplicate_project_no' AS check_name, project_no AS value, COUNT(*) AS row_count
FROM public.projects
WHERE project_no IS NOT NULL AND BTRIM(project_no) <> ''
GROUP BY project_no
HAVING COUNT(*) > 1
ORDER BY row_count DESC, value;

-- Orphan references used by reports and installation relationships.
SELECT 'asset_missing_type' AS check_name, a.id, a.asset_id
FROM public.assets a
LEFT JOIN public.asset_types t ON t.id = a.asset_type_id
WHERE a.asset_type_id IS NOT NULL AND t.id IS NULL;

SELECT 'asset_missing_location' AS check_name, a.id, a.asset_id
FROM public.assets a
LEFT JOIN public.locations l ON l.id = a.location_id
WHERE a.location_id IS NOT NULL AND l.id IS NULL;

SELECT 'asset_missing_department' AS check_name, a.id, a.asset_id
FROM public.assets a
LEFT JOIN public.departments d ON d.id = a.department_id
WHERE a.department_id IS NOT NULL AND d.id IS NULL;

SELECT 'asset_missing_employee' AS check_name, a.id, a.asset_id
FROM public.assets a
LEFT JOIN public.employees e ON e.id = a.current_employee_id
WHERE a.current_employee_id IS NOT NULL AND e.id IS NULL;

SELECT 'warehouse_issue_missing_asset' AS check_name, w.id, w.issue_no, w.asset_id
FROM public.warehouse_issues w
LEFT JOIN public.assets a ON a.id = w.asset_id OR a.asset_id = w.asset_id
WHERE a.id IS NULL;

-- Open handoffs must point to assets in transit.
SELECT 'open_issue_asset_state_mismatch' AS check_name,
       w.id AS warehouse_issue_id, w.issue_no, w.asset_id,
       a.status AS asset_status
FROM public.warehouse_issues w
JOIN public.assets a ON a.id = w.asset_id OR a.asset_id = w.asset_id
WHERE w.status IN ('Issued', 'In Transit', 'Awaiting Installation')
  AND a.status <> 'In Transit';

-- Completed installation records must point to installed/maintenance assets.
SELECT 'completed_installation_asset_state_mismatch' AS check_name,
       w.id AS warehouse_issue_id, w.issue_no, w.asset_id,
       a.status AS asset_status
FROM public.warehouse_issues w
JOIN public.assets a ON a.id = w.asset_id OR a.asset_id = w.asset_id
WHERE w.status = 'Installed'
  AND a.status NOT IN ('Installed', 'Under Maintenance');

-- Hierarchical locations must not reference missing parents.
SELECT 'location_missing_parent' AS check_name, child.id, child.parent_id
FROM public.locations child
LEFT JOIN public.locations parent ON parent.id = child.parent_id
WHERE child.parent_id IS NOT NULL AND parent.id IS NULL;

-- Realtime publication must contain every operational table.
WITH required_tables(table_name) AS (
  VALUES
    ('assets'), ('maintenance'), ('employees'), ('locations'),
    ('departments'), ('system_settings'), ('warehouse_issues'),
    ('asset_transfers'), ('projects'), ('asset_types'),
    ('asset_transactions'), ('project_tasks'), ('licenses'), ('users')
)
SELECT 'realtime_table_missing' AS check_name, required_tables.table_name
FROM required_tables
LEFT JOIN pg_publication_tables published
  ON published.pubname = 'supabase_realtime'
 AND published.schemaname = 'public'
 AND published.tablename = required_tables.table_name
WHERE published.tablename IS NULL
ORDER BY required_tables.table_name;

-- Summary counts.
SELECT 'assets' AS table_name, COUNT(*) AS row_count FROM public.assets
UNION ALL
SELECT 'warehouse_issues', COUNT(*) FROM public.warehouse_issues
UNION ALL
SELECT 'installed_assets', COUNT(*) FROM public.assets WHERE status = 'Installed'
UNION ALL
SELECT 'open_warehouse_issues', COUNT(*)
FROM public.warehouse_issues
WHERE status IN ('Issued', 'In Transit', 'Awaiting Installation');
