-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "knowledge_base" ADD COLUMN     "embedding" vector;
