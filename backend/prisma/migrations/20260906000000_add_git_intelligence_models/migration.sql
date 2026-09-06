-- CreateTable
CREATE TABLE "GitRepository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "url" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "GitRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitCommit" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorEmail" TEXT,
    "authorDate" TIMESTAMP(3),
    "url" TEXT,

    CONSTRAINT "GitCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitFileChange" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'modified',
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "patch" TEXT,

    CONSTRAINT "GitFileChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "commitSha" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "source" TEXT NOT NULL DEFAULT 'api',
    "description" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentCommit" (
    "deploymentId" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,

    CONSTRAINT "DeploymentCommit_pkey" PRIMARY KEY ("deploymentId","commitId")
);

-- CreateIndex
CREATE INDEX "GitRepository_userId_idx" ON "GitRepository"("userId");

-- CreateIndex
CREATE INDEX "GitRepository_owner_name_idx" ON "GitRepository"("owner", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepository_userId_fullName_key" ON "GitRepository"("userId", "fullName");

-- CreateIndex
CREATE INDEX "GitCommit_repositoryId_idx" ON "GitCommit"("repositoryId");

-- CreateIndex
CREATE INDEX "GitCommit_authorDate_idx" ON "GitCommit"("authorDate");

-- CreateIndex
CREATE UNIQUE INDEX "GitCommit_repositoryId_sha_key" ON "GitCommit"("repositoryId", "sha");

-- CreateIndex
CREATE INDEX "GitFileChange_commitId_idx" ON "GitFileChange"("commitId");

-- CreateIndex
CREATE INDEX "Deployment_userId_idx" ON "Deployment"("userId");

-- CreateIndex
CREATE INDEX "Deployment_repositoryId_idx" ON "Deployment"("repositoryId");

-- CreateIndex
CREATE INDEX "Deployment_deployedAt_idx" ON "Deployment"("deployedAt");

-- CreateIndex
CREATE INDEX "DeploymentCommit_commitId_idx" ON "DeploymentCommit"("commitId");

-- AddForeignKey
ALTER TABLE "GitRepository" ADD CONSTRAINT "GitRepository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitFileChange" ADD CONSTRAINT "GitFileChange_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "GitCommit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitRepository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentCommit" ADD CONSTRAINT "DeploymentCommit_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentCommit" ADD CONSTRAINT "DeploymentCommit_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "GitCommit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

