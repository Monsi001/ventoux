-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('STRAVA', 'MYWHOOSH', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RIDE', 'VIRTUAL_RIDE', 'RUN', 'STRENGTH', 'HIKE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "ftp" INTEGER,
    "stravaId" TEXT,
    "stravaToken" TEXT,
    "stravaRefresh" TEXT,
    "stravaExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "races" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "elevation" INTEGER NOT NULL,
    "location" TEXT,
    "targetLevel" TEXT NOT NULL DEFAULT 'FINISH',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weeks" JSONB NOT NULL,
    "phases" JSONB NOT NULL,
    "aiNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL DEFAULT 'MANUAL',
    "stravaId" TEXT,
    "type" "ActivityType" NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION,
    "elevation" INTEGER,
    "avgPower" INTEGER,
    "maxPower" INTEGER,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgSpeed" DOUBLE PRECISION,
    "tss" DOUBLE PRECISION,
    "normalizedPower" INTEGER,
    "intensityFactor" DOUBLE PRECISION,
    "calories" INTEGER,
    "gpxData" TEXT,
    "fitData" BYTEA,
    "rawData" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_constraints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "availableDays" JSONB NOT NULL,
    "maxHours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mywhoosh_workouts" (
    "id" TEXT NOT NULL,
    "mywhooshId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "categoryName" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "tss" INTEGER,
    "intensityFactor" DOUBLE PRECISION,
    "kj" INTEGER,
    "stepCount" INTEGER NOT NULL,
    "steps" JSONB NOT NULL,
    "authorName" TEXT,
    "isRecovery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mywhoosh_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stravaId_key" ON "users"("stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_stravaId_key" ON "activities"("stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_constraints_userId_weekStart_key" ON "weekly_constraints"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "mywhoosh_workouts_mywhooshId_key" ON "mywhoosh_workouts"("mywhooshId");

-- CreateIndex
CREATE INDEX "mywhoosh_workouts_categoryName_idx" ON "mywhoosh_workouts"("categoryName");

-- CreateIndex
CREATE INDEX "mywhoosh_workouts_duration_idx" ON "mywhoosh_workouts"("duration");

-- CreateIndex
CREATE INDEX "mywhoosh_workouts_tss_idx" ON "mywhoosh_workouts"("tss");

-- AddForeignKey
ALTER TABLE "races" ADD CONSTRAINT "races_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_constraints" ADD CONSTRAINT "weekly_constraints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
