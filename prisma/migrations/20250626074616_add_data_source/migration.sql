/*
  Warnings:

  - You are about to drop the column `avg_response_time_ms` on the `chat_analytics` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `chat_analytics` table. All the data in the column will be lost.
  - You are about to drop the column `satisfaction_score` on the `chat_analytics` table. All the data in the column will be lost.
  - You are about to drop the column `total_messages` on the `chat_analytics` table. All the data in the column will be lost.
  - You are about to drop the column `total_sessions` on the `chat_analytics` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `intent` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `message_type` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `response_time_ms` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `session_id` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `session_id` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `user_agent` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `user_ip` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `website_user_id` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `session_id` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `feedback_forms` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `flight_cache` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `flight_cache` table. All the data in the column will be lost.
  - You are about to drop the column `flight_data` on the `flight_cache` table. All the data in the column will be lost.
  - You are about to drop the column `flight_number` on the `flight_cache` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `knowledge_base` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `knowledge_base` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `knowledge_base` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `knowledge_base` table. All the data in the column will be lost.
  - The `keywords` column on the `knowledge_base` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `content_hash` on the `scraping_cache` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `scraping_cache` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `scraping_cache` table. All the data in the column will be lost.
  - You are about to drop the column `scraped_data` on the `scraping_cache` table. All the data in the column will be lost.
  - You are about to drop the column `source_url` on the `scraping_cache` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `support_agents` table. All the data in the column will be lost.
  - You are about to drop the column `current_session_id` on the `support_agents` table. All the data in the column will be lost.
  - You are about to drop the column `is_online` on the `support_agents` table. All the data in the column will be lost.
  - You are about to drop the column `last_activity` on the `support_agents` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `support_agents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sessionId]` on the table `chat_sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[flightNumber]` on the table `flight_cache` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `scraping_cache` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `message` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `response` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionId` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionId` to the `chat_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `chat_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionId` to the `feedback_forms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `flight_cache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flightData` to the `flight_cache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flightNumber` to the `flight_cache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `knowledge_base` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `scraping_cache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `scraping_cache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `support_agents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `support_agents` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_session_id_fkey";

-- DropForeignKey
ALTER TABLE "feedback_forms" DROP CONSTRAINT "feedback_forms_session_id_fkey";

-- DropIndex
DROP INDEX "chat_sessions_session_id_key";

-- DropIndex
DROP INDEX "feedback_forms_session_id_key";

-- DropIndex
DROP INDEX "flight_cache_flight_number_key";

-- AlterTable
ALTER TABLE "chat_analytics" DROP COLUMN "avg_response_time_ms",
DROP COLUMN "created_at",
DROP COLUMN "satisfaction_score",
DROP COLUMN "total_messages",
DROP COLUMN "total_sessions",
ADD COLUMN     "avgResponse" DOUBLE PRECISION,
ADD COLUMN     "failed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "successful" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topQueries" JSONB,
ADD COLUMN     "totalChats" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "confidence",
DROP COLUMN "content",
DROP COLUMN "created_at",
DROP COLUMN "intent",
DROP COLUMN "message_type",
DROP COLUMN "response_time_ms",
DROP COLUMN "session_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isSuccessful" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "processingTime" INTEGER,
ADD COLUMN     "queryType" TEXT,
ADD COLUMN     "response" TEXT NOT NULL,
ADD COLUMN     "sessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "chat_sessions" DROP COLUMN "created_at",
DROP COLUMN "session_id",
DROP COLUMN "status",
DROP COLUMN "updated_at",
DROP COLUMN "user_agent",
DROP COLUMN "user_ip",
DROP COLUMN "website_user_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "needsHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "feedback_forms" DROP COLUMN "created_at",
DROP COLUMN "message",
DROP COLUMN "name",
DROP COLUMN "session_id",
DROP COLUMN "status",
DROP COLUMN "subject",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "isResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "sessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "flight_cache" DROP COLUMN "created_at",
DROP COLUMN "expires_at",
DROP COLUMN "flight_data",
DROP COLUMN "flight_number",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "flightData" JSONB NOT NULL,
ADD COLUMN     "flightNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "knowledge_base" DROP COLUMN "created_at",
DROP COLUMN "is_active",
DROP COLUMN "language",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "keywords",
ADD COLUMN     "keywords" TEXT[];

-- AlterTable
ALTER TABLE "scraping_cache" DROP COLUMN "content_hash",
DROP COLUMN "created_at",
DROP COLUMN "expires_at",
DROP COLUMN "scraped_data",
DROP COLUMN "source_url",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "headings" TEXT[],
ADD COLUMN     "lastScraped" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "support_agents" DROP COLUMN "created_at",
DROP COLUMN "current_session_id",
DROP COLUMN "is_online",
DROP COLUMN "last_activity",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentChats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivity" TIMESTAMP(3),
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "maxChats" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'agent',
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "chat_handoffs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "context" JSONB,
    "waitTime" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_chats" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "satisfaction" INTEGER,
    "notes" TEXT,

    CONSTRAINT "agent_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_notes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_responses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_quota" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 1500,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_quota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_quota_provider_date_key" ON "api_quota"("provider", "date");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_sessionId_key" ON "chat_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "flight_cache_flightNumber_key" ON "flight_cache"("flightNumber");

-- CreateIndex
CREATE UNIQUE INDEX "scraping_cache_url_key" ON "scraping_cache"("url");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_handoffs" ADD CONSTRAINT "chat_handoffs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_handoffs" ADD CONSTRAINT "chat_handoffs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_chats" ADD CONSTRAINT "agent_chats_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_chats" ADD CONSTRAINT "agent_chats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "support_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notes" ADD CONSTRAINT "agent_notes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "support_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
