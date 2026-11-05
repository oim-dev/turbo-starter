-- Refresh credentials больше не используются. Аккаунты и сессии сохраняются;
-- ранее выданные JWT действуют до своего exp либо до отзыва DB-сессии.
DROP TABLE "ClientRefreshToken";
DROP TABLE "AdminRefreshToken";

-- Для всех новых сессий, включая Keycloak, действует единый срок JWT: 7 дней.
ALTER TABLE "AdminKeycloakSettings" DROP COLUMN "sessionTtlSeconds";
