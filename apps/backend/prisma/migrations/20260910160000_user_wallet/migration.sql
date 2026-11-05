CREATE TYPE "WalletTransactionType" AS ENUM (
    'TOP_UP', 'RENTAL_PAYMENT', 'DEPOSIT_HOLD', 'RENTAL_REFUND', 'DEPOSIT_RELEASE'
);

CREATE TABLE "Wallet" (
    "userId" UUID NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "Wallet_balance_range" CHECK ("balance" BETWEEN 0 AND 9007199254740991)
);

CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceBefore" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "idempotencyKey" UUID,
    "bookingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletTransaction_amount_range" CHECK ("amount" BETWEEN 1 AND 9007199254740991),
    CONSTRAINT "WalletTransaction_balance_range" CHECK (
        "balanceBefore" BETWEEN 0 AND 9007199254740991 AND
        "balanceAfter" BETWEEN 0 AND 9007199254740991
    ),
    CONSTRAINT "WalletTransaction_source" CHECK (
        ("type" = 'TOP_UP' AND "idempotencyKey" IS NOT NULL AND "bookingId" IS NULL
            AND "amount" BETWEEN 10000 AND 10000000) OR
        ("type" <> 'TOP_UP' AND "idempotencyKey" IS NULL AND "bookingId" IS NOT NULL)
    ),
    CONSTRAINT "WalletTransaction_balance_change" CHECK (
        "balanceAfter" = "balanceBefore" + CASE
            WHEN "type" IN ('RENTAL_PAYMENT', 'DEPOSIT_HOLD') THEN -"amount"
            ELSE "amount"
        END
    )
);

CREATE UNIQUE INDEX "WalletTransaction_userId_idempotencyKey_key" ON "WalletTransaction"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "WalletTransaction_bookingId_type_key" ON "WalletTransaction"("bookingId", "type");
CREATE INDEX "WalletTransaction_userId_createdAt_id_idx" ON "WalletTransaction"("userId", "createdAt", "id");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Wallet"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- История дополняется новыми проводками: исправление означает отдельный возврат.
CREATE FUNCTION reject_wallet_transaction_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Wallet transactions are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "WalletTransaction_immutable"
BEFORE UPDATE OR DELETE ON "WalletTransaction"
FOR EACH ROW EXECUTE FUNCTION reject_wallet_transaction_change();

-- Старые пользователи получают логический ноль; строка создаётся при первой операции.
-- Существующие аренды и прежние симулированные залоги не считаются оплаченными из кошелька.
