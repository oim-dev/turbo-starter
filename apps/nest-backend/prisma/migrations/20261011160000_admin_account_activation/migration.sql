-- Существующие аккаунты уже допущены. Новые OIDC-аккаунты явно ожидают активации.
ALTER TABLE "AdminUser" ADD COLUMN "isActivated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_activation_required"
  CHECK (NOT "isActive" OR "isActivated");
