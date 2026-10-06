// macOS: ký ad-hoc gói .app (không cần chứng chỉ Apple) để chạy được trên máy chip Apple (M1/M2…).
// Bản chưa công chứng: lần đầu mở bị chặn → Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Vẫn mở (Open Anyway).
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
