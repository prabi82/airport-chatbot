-- Create blocked_ips table
CREATE TABLE IF NOT EXISTS "blocked_ips" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "blockedBy" TEXT,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id")
);

-- Create unique index on ipAddress
CREATE UNIQUE INDEX IF NOT EXISTS "blocked_ips_ipAddress_key" ON "blocked_ips"("ipAddress");

-- Create index on isActive for faster queries
CREATE INDEX IF NOT EXISTS "blocked_ips_isActive_idx" ON "blocked_ips"("isActive");

