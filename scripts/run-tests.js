const { execSync } = require('child_process');

console.log('Running test suite via tsx...\n');
try {
  execSync('npx -y tsx scripts/run-tests.ts', { stdio: 'inherit' });
} catch (err) {
  process.exit(1);
}
