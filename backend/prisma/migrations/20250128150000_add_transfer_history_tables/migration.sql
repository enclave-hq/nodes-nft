-- CreateTable
CREATE TABLE "referral_reward_distributions" (
    "id" SERIAL NOT NULL,
    "rootReferrerAddress" VARCHAR(42) NOT NULL,
    "amount" VARCHAR(50) NOT NULL,
    "amountWei" VARCHAR(50) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "txHash" VARCHAR(66),
    "adminAddress" VARCHAR(100) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_reward_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_withdrawals" (
    "id" SERIAL NOT NULL,
    "amount" VARCHAR(50) NOT NULL,
    "amountWei" VARCHAR(50) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "txHash" VARCHAR(66),
    "adminAddress" VARCHAR(100) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_reward_distributions_rootReferrerAddress_idx" ON "referral_reward_distributions"("rootReferrerAddress");

-- CreateIndex
CREATE INDEX "referral_reward_distributions_toAddress_idx" ON "referral_reward_distributions"("toAddress");

-- CreateIndex
CREATE INDEX "revenue_withdrawals_toAddress_idx" ON "revenue_withdrawals"("toAddress");

