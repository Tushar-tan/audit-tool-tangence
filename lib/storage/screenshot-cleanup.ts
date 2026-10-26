import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../prisma';

export interface CleanupResult {
  success: boolean;
  retentionDays: number;
  cutoffDate: string;
  deletedAudits: number;
  deletedFiles: number;
  freedBytes: number;
  freedMb: string;
  remainingAudits: number;
  dryRun?: boolean;
}

export interface StorageStats {
  totalAudits: number;
  totalFiles: number;
  totalBytes: number;
  totalMb: string;
  retentionDays: number;
  expiredAuditsCount: number;
}

/**
 * Returns the base screenshot directory: <cwd>/public/uploads/screenshots
 */
export function getScreenshotsDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'screenshots');
}

/**
 * Get disk usage stats for the screenshots storage folder.
 */
export async function getScreenshotStorageStats(retentionDays?: number): Promise<StorageStats> {
  const effectiveDays = retentionDays ?? (Number(process.env.SCREENSHOT_RETENTION_DAYS) || 3);
  const retentionMs = effectiveDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  const screenshotsDir = getScreenshotsDir();
  let totalAudits = 0;
  let totalFiles = 0;
  let totalBytes = 0;
  let expiredAuditsCount = 0;

  try {
    const entries = await fs.readdir(screenshotsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      totalAudits++;
      const auditDir = path.join(screenshotsDir, entry.name);

      let isExpired = false;
      try {
        const stat = await fs.stat(auditDir);
        const folderTime = Math.max(stat.mtimeMs || 0, stat.birthtimeMs || 0);
        if (folderTime < cutoff) {
          isExpired = true;
          expiredAuditsCount++;
        }
      } catch {
        // ignore stat errors
      }

      // Read inner files to tally bytes and counts
      try {
        const files = await fs.readdir(auditDir);
        for (const file of files) {
          totalFiles++;
          try {
            const fileStat = await fs.stat(path.join(auditDir, file));
            totalBytes += fileStat.size;
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore readdir errors
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return {
    totalAudits,
    totalFiles,
    totalBytes,
    totalMb: (totalBytes / (1024 * 1024)).toFixed(2),
    retentionDays: effectiveDays,
    expiredAuditsCount
  };
}

/**
 * Automatically cleans up screenshot directories older than the retention period (default 3 days / 72 hours).
 * This significantly reduces project and disk storage size while keeping audit metrics and issues intact in DB.
 */
export async function cleanupOldScreenshots(options?: {
  retentionDays?: number;
  dryRun?: boolean;
}): Promise<CleanupResult> {
  const retentionDays = options?.retentionDays ?? (Number(process.env.SCREENSHOT_RETENTION_DAYS) || 3);
  const dryRun = Boolean(options?.dryRun);
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  const screenshotsDir = getScreenshotsDir();

  let deletedAudits = 0;
  let deletedFiles = 0;
  let freedBytes = 0;
  let remainingAudits = 0;

  try {
    await fs.access(screenshotsDir);
  } catch {
    // Directory does not exist yet
    return {
      success: true,
      retentionDays,
      cutoffDate: new Date(cutoff).toISOString(),
      deletedAudits: 0,
      deletedFiles: 0,
      freedBytes: 0,
      freedMb: '0.00',
      remainingAudits: 0,
      dryRun
    };
  }

  try {
    const entries = await fs.readdir(screenshotsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const targetPath = path.join(screenshotsDir, entry.name);

      if (entry.isDirectory()) {
        const auditId = entry.name;
        let folderTimestamp = 0;

        // Try getting creation time from database first for precision
        try {
          const dbAudit = await prisma.audit.findUnique({
            where: { id: auditId },
            select: { createdAt: true }
          });
          if (dbAudit?.createdAt) {
            folderTimestamp = new Date(dbAudit.createdAt).getTime();
          }
        } catch {
          // Database might be unavailable or audit removed
        }

        // Fallback to filesystem timestamp
        if (!folderTimestamp) {
          try {
            const stat = await fs.stat(targetPath);
            folderTimestamp = Math.max(stat.mtimeMs || 0, stat.birthtimeMs || 0);
          } catch {
            folderTimestamp = 0;
          }
        }

        // Check if older than retention threshold (e.g. > 3 days)
        if (folderTimestamp && folderTimestamp < cutoff) {
          // Count files & bytes inside before deletion
          let auditBytes = 0;
          let auditFiles = 0;

          try {
            const files = await fs.readdir(targetPath);
            for (const file of files) {
              auditFiles++;
              try {
                const fileStat = await fs.stat(path.join(targetPath, file));
                auditBytes += fileStat.size;
              } catch {
                // ignore
              }
            }
          } catch {
            // ignore
          }

          if (!dryRun) {
            try {
              await fs.rm(targetPath, { recursive: true, force: true });

              // Optionally clean up screenshot references in DB to mark them as expired/reclaimed
              try {
                await prisma.pageAudit.updateMany({
                  where: { auditId },
                  data: {
                    desktopScreenshot: null,
                    tabletScreenshot: null,
                    mobileScreenshot: null,
                    fullPageScreenshot: null,
                    annotatedScreenshot: null
                  }
                });
                await prisma.auditIssue.updateMany({
                  where: { auditId },
                  data: {
                    screenshotUrl: null
                  }
                });
              } catch {
                // DB update is non-critical
              }
            } catch (err) {
              console.error(`Failed to delete expired screenshots folder for audit ${auditId}:`, err);
              continue;
            }
          }

          deletedAudits++;
          deletedFiles += auditFiles;
          freedBytes += auditBytes;
        } else {
          remainingAudits++;
        }
      } else if (entry.isFile()) {
        // Orphaned loose screenshot file in root directory
        try {
          const stat = await fs.stat(targetPath);
          if (stat.mtimeMs < cutoff && entry.name !== '.gitkeep') {
            const fileSize = stat.size;
            if (!dryRun) {
              await fs.unlink(targetPath);
            }
            deletedFiles++;
            freedBytes += fileSize;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error('Error during screenshot cleanup:', err);
  }

  const freedMb = (freedBytes / (1024 * 1024)).toFixed(2);
  console.log(`[Screenshot Cleanup] Completed: Deleted ${deletedAudits} audit folders (${deletedFiles} files, ${freedMb} MB freed). Retention: ${retentionDays} days.`);

  return {
    success: true,
    retentionDays,
    cutoffDate: new Date(cutoff).toISOString(),
    deletedAudits,
    deletedFiles,
    freedBytes,
    freedMb,
    remainingAudits,
    dryRun
  };
}

/**
 * Initializes recurring background screenshot garbage collection.
 * Runs once after server boot, and every 6 hours thereafter.
 */
export function startPeriodicScreenshotCleanup(): void {
  const globalObj = globalThis as unknown as { __screenshotCleanupRunning?: boolean };

  if (globalObj.__screenshotCleanupRunning) {
    return;
  }
  globalObj.__screenshotCleanupRunning = true;

  // Run initial cleanup after brief delay to avoid blocking startup
  setTimeout(() => {
    cleanupOldScreenshots().catch((err) => {
      console.warn('[Screenshot Cleanup] Initial startup cleanup warning:', err.message);
    });
  }, 5000);

  // Periodic interval every 6 hours
  const interval = setInterval(() => {
    cleanupOldScreenshots().catch((err) => {
      console.warn('[Screenshot Cleanup] Periodic cleanup warning:', err.message);
    });
  }, 6 * 60 * 60 * 1000);

  if (interval.unref) {
    interval.unref();
  }
}
