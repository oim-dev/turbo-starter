-- Разрешение входа остаётся единственным флагом isActive.
ALTER TABLE "AdminUser" DROP CONSTRAINT "AdminUser_activation_required";
ALTER TABLE "AdminUser" DROP COLUMN "isActivated";
