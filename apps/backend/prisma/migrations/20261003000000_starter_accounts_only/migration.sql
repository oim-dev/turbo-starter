-- Очистка продуктовой схемы: данные перечисленных таблиц удаляются безвозвратно.
-- Аккаунты, существующие роли, сессии и refresh-токены сохраняются.
BEGIN;

-- Сначала зависимые таблицы. Без CASCADE: неизвестные внешние зависимости
-- должны остановить миграцию, а не быть удалены вместе с продуктовой схемой.
DROP TABLE "AiRequestEvent";
DROP TABLE "AiRequest";
DROP TABLE "AiConversation";
DROP TABLE "WalletTransaction";
DROP FUNCTION reject_wallet_transaction_change();
DROP TABLE "Wallet";
DROP TABLE "ActPhotoAnalysis";
DROP TABLE "_ActVersionToPhoto";
DROP TABLE "_DisputeToPhoto";
DROP TABLE "Complaint";
DROP TABLE "Review";
DROP TABLE "Dispute";
DROP TABLE "ActVersion";
DROP TABLE "CalendarBlock";
DROP TABLE "BookingEvent";
DROP TABLE "Booking";
DROP TABLE "BookingGroup";
DROP TABLE "Photo";
DROP TABLE "Equipment";
DROP TABLE "Category";
DROP TABLE "AdminAccessEvent";
DROP TABLE "ClientUserStatusEvent";

ALTER TABLE "ClientUser"
  DROP COLUMN "phone",
  DROP COLUMN "city",
  DROP COLUMN "statusVersion";

ALTER TABLE "AdminUser"
  DROP COLUMN "accessVersion",
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

DROP TYPE "WalletTransactionType";
DROP TYPE "AdminAccessAction";
DROP TYPE "EquipmentStatus";
DROP TYPE "PhotoPurpose";
DROP TYPE "BookingStatus";
DROP TYPE "DepositStatus";
DROP TYPE "ActType";
DROP TYPE "DisputeResolution";
DROP TYPE "ComplaintResolution";
DROP TYPE "AiRequestStatus";
DROP TYPE "AiConfirmationChannel";
DROP TYPE "ActPhotoAnalysisStatus";

-- btree_gist мог существовать до проекта и использоваться другими объектами БД.
-- Расширение не удаляем. SessionTransport.MOBILE сохраняет исторические сессии.
COMMIT;
