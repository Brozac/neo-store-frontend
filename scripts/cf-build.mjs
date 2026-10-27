#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// MIGRATION-CF — scripts/cf-build.mjs
// بيلد Cross-platform (Windows/Mac/Linux) لباندل Cloudflare Workers:
//   1) CF_SLIM=1  → next.config كينحّي withSentryConfig (حد المجاني 3MB gzip)
//   2) كيستبدل instrumentation.ts بنسخة بلا Sentry مؤقتاً (كتترجع أوتوماتيك
//      حتى إلا البيلد طاح — finally)
//   3) كيشغّل: opennextjs-cloudflare build
// الاستعمال: npm run cf:build   (ولا cf:deploy / cf:preview)
// ═══════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// .dev.vars للـ preview المحلي — كيتصاوب أوتوماتيك إلا ما كانش (gitignored)
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', 'NEXTJS_ENV=development\n');
}

const INSTR = 'instrumentation.ts';

const CF_INSTRUMENTATION = `// ──── ⚙️ ملف مُولَّد مؤقتاً من scripts/cf-build.mjs — الأصل كترجع بعد البيلد ────
// CF_SLIM build: Sentry محذوف من باندل Cloudflare (حد الـ Worker المجاني 3MB gzip)

export async function register() {
  // بلا SDK — أخطاء السيرفر كيتسجلو في wrangler tail / CF dashboard
}

type RevalidateRequest = { url?: string } | null | undefined;

export const onRequestError = async (
  err: unknown,
  request: RevalidateRequest,
  context: unknown
) => {
  console.error('[onRequestError]', err, request?.url ?? '', context);
};
// ──── [/CF_SLIM] ────
`;

process.env.CF_SLIM = '1';

const original = readFileSync(INSTR, 'utf8');
writeFileSync(INSTR, CF_INSTRUMENTATION);

let exitCode = 0;
try {
  // الحزمة المثبتة scoped: node_modules/@opennextjs/cloudflare — نقرا package.json مباشرة
  // (الاسم غير المقيد opennextjs-cloudflare = احتياط للتثبيت اليدوي القديم فقط)
  // ✅ محتم على Windows/Linux/Mac — بلا require.resolve وبلا قيود exports
  let pkg = null, pkgDir = null;
  for (const base of [
    path.join(process.cwd(), 'node_modules', '@opennextjs', 'cloudflare'),
    path.join(process.cwd(), 'node_modules', 'opennextjs-cloudflare'),
  ]) {
    const candidate = path.join(base, 'package.json');
    if (existsSync(candidate)) {
      pkg = JSON.parse(readFileSync(candidate, 'utf8'));
      pkgDir = base;
      break;
    }
  }
  if (!pkg) throw new Error('opennextjs-cloudflare ما تلقاش في node_modules — دير: npm install --legacy-peer-deps');
  const binPath = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['opennextjs-cloudflare'];
  if (!binPath) throw new Error('opennextjs-cloudflare bin ما تلقاش');
  const cli = path.join(pkgDir, binPath);

  const res = spawnSync(process.execPath, [cli, 'build'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.error) {
    console.error('[cf-build] spawn error:', res.error.code, res.error.message, 'cli=', cli);
    exitCode = 1;
  } else {
    exitCode = res.status ?? 1;
  }
} catch (e) {
  console.error('[cf-build]', e);
  exitCode = 1;
} finally {
  // الرجوع الإجباري — حتى إلا البيلد طاح، الأصل كيرجع
  writeFileSync(INSTR, original);
}

process.exit(exitCode);
