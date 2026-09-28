/**
 * Asset Reservation Validator
 */
const AssetValidator = {
    isReserved: (asset) => {
        return asset && asset.project_id && asset.project_id.trim() !== "";
    },
    
    // Validates if the change to an asset is allowed based on project reservation
    assertReservation: (oldAsset, newAsset, isProjectContext = false) => {
        if (!AssetValidator.isReserved(oldAsset)) return;

        // If it's a project context operation, we are more permissive
        if (isProjectContext) return;

        // If not a project context, strict checks:
        
        // 1. Cannot change project_id
        if (newAsset.project_id !== oldAsset.project_id) {
            throw new Error("Asset is reserved for a project. Cannot change project reservation.");
        }

        // 2. Cannot change location/branch
        if (newAsset.location_id !== oldAsset.location_id) {
             throw new Error("Asset is reserved for a project. Cannot reassign branch/location.");
        }

        // 3. Cannot change employee/custodian
        if (newAsset.employee_id !== oldAsset.employee_id) {
             throw new Error("Asset is reserved for a project. Cannot reassign custodian.");
        }

        // 4. Cannot change department
        if (newAsset.department_id !== oldAsset.department_id) {
             throw new Error("Asset is reserved for a project. Cannot reassign department.");
        }
    }
};

window.AssetValidator = AssetValidator;
