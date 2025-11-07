-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_code_requests" (
    "id" SERIAL NOT NULL,
    "applicantAddress" VARCHAR(42) NOT NULL,
    "referrerInviteCodeId" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "adminAddress" VARCHAR(42),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "invite_code_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "applicantAddress" VARCHAR(42) NOT NULL,
    "parentInviteCodeId" INTEGER,
    "creator" VARCHAR(42) NOT NULL,
    "maxUses" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "mintedNftCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "level" INTEGER NOT NULL DEFAULT 1,
    "rootInviteCodeId" INTEGER,
    "rootApplicantAddress" VARCHAR(42),

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_code_usage" (
    "id" SERIAL NOT NULL,
    "inviteCodeId" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "txHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_code_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_records" (
    "id" SERIAL NOT NULL,
    "nftId" INTEGER NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "mintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintTxHash" VARCHAR(66),
    "inviteCodeId" INTEGER,
    "rootInviteCodeId" INTEGER,
    "rootApplicantAddress" VARCHAR(42),
    "inviteChain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whitelist_history" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "inviteCode" VARCHAR(50),
    "adminAddress" VARCHAR(42),
    "txHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whitelist_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "batchId" BIGINT NOT NULL,
    "maxMintable" BIGINT NOT NULL,
    "mintPrice" VARCHAR(50) NOT NULL,
    "currentMinted" BIGINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" SERIAL NOT NULL,
    "adminAddress" VARCHAR(42) NOT NULL,
    "actionType" VARCHAR(50) NOT NULL,
    "actionData" JSONB,
    "txHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats_cache" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_address_key" ON "admins"("address");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invite_code_usage_inviteCodeId_userAddress_key" ON "invite_code_usage"("inviteCodeId", "userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "nft_records_nftId_key" ON "nft_records"("nftId");

-- CreateIndex
CREATE UNIQUE INDEX "stats_cache_key_key" ON "stats_cache"("key");

-- AddForeignKey
ALTER TABLE "invite_code_requests" ADD CONSTRAINT "invite_code_requests_referrerInviteCodeId_fkey" FOREIGN KEY ("referrerInviteCodeId") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_parentInviteCodeId_fkey" FOREIGN KEY ("parentInviteCodeId") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_rootInviteCodeId_fkey" FOREIGN KEY ("rootInviteCodeId") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_code_usage" ADD CONSTRAINT "invite_code_usage_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_records" ADD CONSTRAINT "nft_records_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_records" ADD CONSTRAINT "nft_records_rootInviteCodeId_fkey" FOREIGN KEY ("rootInviteCodeId") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
