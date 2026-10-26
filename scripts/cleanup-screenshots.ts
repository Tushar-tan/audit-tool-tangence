import { cleanupOldScreenshots, getScreenshotStorageStats } from '../lib/storage/screenshot-cleanup';

async function main() {
  console.log('--- Screenshot Storage & Retention Cleanup Tool ---');
  
  const beforeStats = await getScreenshotStorageStats();
  console.log(`Current Storage: ${beforeStats.totalAudits} audit directories, ${beforeStats.totalFiles} files (${beforeStats.totalMb} MB).`);
  console.log(`Audits older than ${beforeStats.retentionDays} days: ${beforeStats.expiredAuditsCount}`);

  const retentionDaysArg = process.argv[2] ? Number(process.argv[2]) : undefined;
  const result = await cleanupOldScreenshots({ retentionDays: retentionDaysArg });

  console.log('\n--- Cleanup Summary ---');
  console.log(`Retention Window : ${result.retentionDays} days`);
  console.log(`Cutoff Date      : ${result.cutoffDate}`);
  console.log(`Audits Deleted   : ${result.deletedAudits}`);
  console.log(`Files Removed    : ${result.deletedFiles}`);
  console.log(`Storage Reclaimed: ${result.freedMb} MB (${result.freedBytes} bytes)`);
  console.log(`Audits Remaining : ${result.remainingAudits}`);

  const afterStats = await getScreenshotStorageStats();
  console.log(`Remaining Storage: ${afterStats.totalAudits} audit directories (${afterStats.totalMb} MB).`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
