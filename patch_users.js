const fs = require('fs');

let content = fs.readFileSync('js/users.js', 'utf8');

// Patch handleChangePassword
const passRegex = /async handleChangePassword\(event\) {[\s\S]*?App\.showToast[^\n]*\n  }/m;
const newPassBlock = `async handleChangePassword(event) {
    event.preventDefault();
    const lang = AppState.lang;
    const newPass = document.getElementById("formNewPassword")?.value || "";
    const confirmPass = document.getElementById("formConfirmPassword")?.value || "";

    if (!newPass || newPass.length < 6) {
      App.showToast(lang === "ar" ? "يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل" : "New password must be at least 6 characters", "error");
      return;
    }

    if (newPass !== confirmPass) {
      App.showToast(lang === "ar" ? "كلمات المرور الجديدة غير متطابقة" : "New passwords do not match", "error");
      return;
    }

    try {
      if (db.supabase) {
        const { error } = await db.supabase.auth.updateUser({ password: newPass });
        if (error) throw error;
        
        App.closeModal("changePasswordModal");
        App.showToast(lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully", "success");
      } else {
        App.showToast(lang === "ar" ? "الخدمة السحابية غير متوفرة" : "Cloud service unavailable", "error");
      }
    } catch (err) {
      console.warn("Change password error:", err);
      App.showToast((lang === "ar" ? "فشل تغيير كلمة المرور: " : "Failed to change password: ") + err.message, "error");
    }
  }`;

content = content.replace(passRegex, newPassBlock);

fs.writeFileSync('js/users.js', content, 'utf8');
console.log("Patched js/users.js successfully!");
