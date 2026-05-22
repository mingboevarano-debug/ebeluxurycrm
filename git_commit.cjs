const { execSync } = require('child_process');
const repo = 'c:\\Users\\user\\Desktop\\call center crm';
try {
  const out = execSync('git add server/src/adminRoutes.js && git commit -m "fix: correct admin stats route wrapper" && git push', { cwd: repo, stdio: 'pipe' });
  console.log(out.toString());
  const head = execSync('type .git\\refs\\heads\\main', { cwd: repo, stdio: 'pipe' }).toString();
  console.log('HEAD:', head.trim());
} catch (e) {
  console.error('ERROR:', e.stdout && e.stdout.toString(), e.stderr && e.stderr.toString());
  process.exit(1);
}
