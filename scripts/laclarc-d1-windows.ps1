# ═══════════════════════════════════════════════════════════════════
# scripts/laclarc-d1-windows.ps1 — 100% D1 — التشغيل الكامل من الـ PC
# ═══════════════════════════════════════════════════════════════════
# التسلسلة (9 خطوات، كل وحدة كتبان وهات نجاحها):
#   1/9  Preflight      — repo + node_modules + wrangler auth
#   2/9  Backup         — pg_dump laclarc_db → G:\Laclarc\backups (يتحفظ آخر 7)
#   3/9  Ensure D1      — يوجد laclarc-catalog أو يصنعه + يجيب database_id
#   4/9  Enable config  — يفعّل binding "DB" + STORE_KV فwrangler.jsonc (markers)
#   5/9  Schema         — d1_schema.sql → D1 (remote)
#   6/9  Bulk push      — push-local-to-d1.mjs (54,367 منتج → D1)
#   7/9  Orders export  — تصدير orders من D1 → JSON فالـ backups
#   8/9  Secret         — ADMIN_PASSWORD فCF (يصنعه إلا غير موجود)
#   9/9  PM2 watcher    — realtime-d1-watcher.mjs حي + save + logs
#
# الاستعمال:
#   1) عمّر المتغيرات تحت (مرة وحدة)
#   2) .\scripts\laclarc-d1-windows.ps1
#   خيارات: -SkipPush (يفوت الرفع البدئي) · -SkipWatcher (يفوت الـ PM2)
#
# الأمان: الكلمات السرية ما كيتطبعوش — كتدوز بـ env/secret فقط.
# ═══════════════════════════════════════════════════════════════════

param(
    [switch]$SkipPush,
    [switch]$SkipWatcher,
    [switch]$Yes  # يجاوب أوتوماتيكياً 'y' على كل سؤال (بلا تفاعل)
)

$ErrorActionPreference = 'Stop'

# ─── ⭐ المتغيرات — عمّرهم مرة وحدة ───────────────────────────────────────
$RepoRoot      = "C:\Users\B512\Desktop\DRPS\frontend"
$BackupDir     = "G:\Laclarc\backups"      # إلا ما كاينش G: → كيتستعمل "$RepoRoot\backups"
$D1Name        = "laclarc-catalog"
$KvName        = "STORE_KV"
$PgHost        = "localhost"
$PgPort        = "5432"
$PgUser        = "postgres"
$PgPassword    = "512512"                        # ← كلمة سر PostgreSQL المحلي (خاوية = trusted auth)
$PgDb          = "laclarc_db"
$AdminPassword = "Mm512512"                        # ← نفس قيمة سرّ ADMIN_PASSWORD فCloudflare
# ──────────────────────────────────────────────────────────────────────

function Banner([string]$step) { Write-Host "`n════════ $step ════════" -ForegroundColor Cyan }

function Info([string]$m)  { Write-Host "[d1-win] $m" }
function Warn([string]$m)  { Write-Host "[d1-win] ⚠️  $m" -ForegroundColor Yellow }
function Die([string]$m)   { Write-Host "[d1-win] ❌ FATAL: $m" -ForegroundColor Red; exit 1 }

function Ask-YesNo([string]$q) {
    if ($Yes) { Write-Host "[d1-win] $q → -Yes → y"; return $true }
    $a = Read-Host "[d1-win] $q (y/n)"
    return ($a -match '^[yY]')
}

# ─── 1/9 Preflight ───────────────────────────────────────────────────
Banner "1/9 PREFLIGHT"
if (-not (Test-Path $RepoRoot)) { Die "RepoRoot غير موجود: $RepoRoot" }
Set-Location $RepoRoot
Info "repo: $RepoRoot"
if (-not (Test-Path (Join-Path $RepoRoot "node_modules\postgres"))) { Die "node_modules ناقصة — جري: npm install" }
if (-not (Test-Path (Join-Path $RepoRoot "scripts\realtime-d1-watcher.mjs"))) { Die "watcher ما كاينش — جري git pull (السكريبتات خاصهم يكونو فالريبو)" }
if (-not (Test-Path (Join-Path $RepoRoot "migrations\d1_schema.sql"))) { Die "migrations\d1_schema.sql ما كاينش — جري git pull" }

Info "فحص wrangler auth …"
$who = (& npx wrangler whoami 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { Die "wrangler auth فشل — جري: npx wrangler login" }
Info "wrangler auth ok"

# ─── 2/9 Backup (pg_dump) ────────────────────────────────────────────
Banner "2/9 BACKUP — pg_dump laclarc_db"
if (-not (Test-Path $BackupDir)) {
    try { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null; Info "تصدعنا: $BackupDir" }
    catch { $BackupDir = Join-Path $RepoRoot "backups"; New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null; Warn "G: ماشي متوفر — backups ف: $BackupDir" }
}
$pgDump = $null
foreach ($c in @(
    "pg_dump",
    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
)) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $pgDump = $c; break }
    if ($c -like "*.exe" -and (Test-Path $c)) { $pgDump = $c; break }
}
if (-not $pgDump) { Die "pg_dump ما تلقاش — زيدو فPATH ولا عدّل المتغير" }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "laclarc_db_$ts.dump"
Info "pg_dump: $pgDump"
if ($PgPassword -ne "") { $env:PGPASSWORD = $PgPassword }
& $pgDump "-h$PgHost" "-p$PgPort" "-U$PgUser" "-d$PgDb" "-Fc" "-f$backupFile"
if ($LASTEXITCODE -ne 0) { Die "pg_dump فشل (code $LASTEXITCODE) — تسالك قبل أي شي اخر" }
$sz = [math]::Round((Get-Item $backupFile).Length / 1MB, 1)
Info "✅ backup: $backupFile (${sz} MB)"
# يتحفظ آخر 7 فقط
Get-ChildItem $BackupDir -Filter "laclarc_db_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | ForEach-Object { Remove-Item $_.FullName -Force; Info "حذفنا backup قديم: $($_.Name)" }
if ($PgPassword -ne "") { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

# ─── 3/9 Ensure D1 (laclarc-catalog) ─────────────────────────────────
Banner "3/9 ENSURE D1 — $D1Name"
Push-Location $RepoRoot
$d1ListRaw = (& npx wrangler d1 list --json 2>$null | Out-String)
$d1Id = $null
try {
    $d1Arr = $d1ListRaw | ConvertFrom-Json
    $existing = $d1Arr | Where-Object { $_.name -eq $D1Name } | Select-Object -First 1
    if ($existing) { $d1Id = $existing.uuid }
} catch { Warn "parse ديال d1 list فشل — نجرب السكريبت الجديد" }
if (-not $d1Id) {
    Info "ما لقيناهش — نصنعو …"
    $createOut = (& npx wrangler d1 create $D1Name 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { Die "d1 create فشل: $($createOut.Substring(0, [Math]::Min(400, $createOut.Length)))" }
    $m = [regex]::Match($createOut, "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")
    if (-not $m.Success) { Die "ما قدرناش نستخرجو database_id من ناتج d1 create" }
    $d1Id = $m.Groups[1].Value
}
Info "✅ D1: $D1Name → $d1Id"

# ─── 4/9 Enable bindings فwrangler.jsonc (markers) ──────────────────
Banner "4/9 ENABLE BINDINGS — wrangler.jsonc"
$cfgPath = Join-Path $RepoRoot "wrangler.jsonc"
$cfg = Get-Content $cfgPath -Raw

$kvId = $null
$kvMarker = '// { "binding": "STORE_KV", "id": "STORE_KV_ID_HERE" },'
if ($cfg.Contains($kvMarker)) {
    Info "STORE_KV: نصنعو/نجيبو الـ namespace …"
    $kvOut = (& npx wrangler kv namespace create $KvName 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { Warn "kv namespace create فشل — STORE_KV كيبقى معطل (ماشي حاجز — phase-3)"; $kvOut = "" }
    $mkv = [regex]::Match($kvOut, '"id"\s*:\s*"([0-9a-f]{32})"')
    if ($mkv.Success) {
        $kvId = $mkv.Groups[1].Value
        $cfg = $cfg.Replace($kvMarker, ('{ "binding": "STORE_KV", "id": "' + $kvId + '" },'))
        Info "✅ STORE_KV فعال: $kvId"
    }
} elseif ($cfg.Contains('"binding": "STORE_KV"')) {
    Info "STORE_KV فعال من قبل — تفوت"
}

$dbMarker = '// { "binding": "DB", "database_name": "laclarc-catalog", "database_id": "D1_DATABASE_ID_HERE" },'
if ($cfg.Contains($dbMarker)) {
    $cfg = $cfg.Replace($dbMarker, ('{ "binding": "DB", "database_name": "' + $D1Name + '", "database_id": "' + $d1Id + '" },'))
    Info "✅ binding DB فعال فwrangler.jsonc: $d1Id"
} elseif ($cfg -match '"binding"\s*:\s*"DB"') {
    if ($cfg.Contains($d1Id)) { Info "binding DB فعال من قبل بنفس الـ id — تفوت" }
    else { Warn "binding DB موجود بـ id آخر — تحقق يدوياً من wrangler.jsonc" }
} else {
    Die "marker ديال DB ما لقيناهش فwrangler.jsonc — جري git pull"
}
# ⚠️ UTF-8 بلا BOM — PowerShell 5.1 (-Encoding UTF8) كيكتب BOM وwrangler/jsonc
#    ما كيتقبلوش → هادا الطريقة المضمونة على كل النسخ.
[System.IO.File]::WriteAllText($cfgPath, $cfg, (New-Object System.Text.UTF8Encoding($false)))
Info "wrangler.jsonc تحدث (deploy كيجي منين تعمل push فالخطوة الأخيرة)"

# ─── 5/9 Schema → D1 ─────────────────────────────────────────────────
Banner "5/9 SCHEMA — d1_schema.sql → remote D1"
& npx wrangler d1 execute $D1Name --remote -y --file "migrations\d1_schema.sql"
if ($LASTEXITCODE -ne 0) { Die "d1 execute (schema) فشل" }
Info "✅ السكيما تطبقات (products · orders · system_events · d1_meta)"

# ─── 6/9 Bulk push (PostgreSQL → D1) ────────────────────────────────
Banner "6/9 BULK PUSH — 54,367 منتج → D1 (~15-30 دقيقة، one-time)"
if (-not $SkipPush) {
    $env:LOCAL_DATABASE_URL = if ($PgPassword -ne "") { "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${PgDb}" } else { "postgresql://${PgUser}@${PgHost}:${PgPort}/${PgDb}" }
    $env:D1_NAME = $D1Name
    & node "scripts\push-local-to-d1.mjs"
    $pushCode = $LASTEXITCODE
    Remove-Item Env:LOCAL_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:D1_NAME -ErrorAction SilentlyContinue
    if ($pushCode -ne 0) { Die "bulk push فشل (code $pushCode) — الملفات المتبقية ف.d1-push/ — صحح وعاود جري الخطوة 6 بوحدو" }
    Info "✅ الرفع البدئي كمل"
} else {
    Warn "-SkipPush — فوتنا الرفع (عادي إلا درتو من قبل)"
}

# ─── 7/9 Orders export (D1 → JSON) ──────────────────────────────────
Banner "7/9 ORDERS EXPORT — D1 → JSON (احتياطي)"
try {
    $ordersFile = Join-Path $BackupDir "d1-orders_$ts.json"
    (& npx wrangler d1 execute $D1Name --remote --json -y --command "SELECT * FROM orders" 2>$null | Out-String) | Set-Content -Path $ordersFile -Encoding UTF8
    Info "✅ orders D1 مصدّرين: $ordersFile (خاويين حالياً — phase-3)"
} catch {
    Warn "orders export ما مشاش — عادي فالمرحلة 1 (الجدول خاوي): $($_.Exception.Message)"
}

# ─── 8/9 Secret — ADMIN_PASSWORD ────────────────────────────────────
Banner "8/9 SECRET — ADMIN_PASSWORD (timing-safe فالendpoint)"
if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
    Warn "عمّر `$AdminPassword فالسكريبت — إلا كان السرّ معمّر من قبل فCF ما كاين مشكل"
    $secList = (& npx wrangler secret list 2>$null | Out-String)
    if ($secList -notmatch "ADMIN_PASSWORD") { Die "ADMIN_PASSWORD ما كاينش فCF ولا فالسكريبت — لازم وحدة منهم" }
    Info "ADMIN_PASSWORD موجود فCF من قبل ✅"
} else {
    $secList = (& npx wrangler secret list 2>$null | Out-String)
    if ($secList -match "ADMIN_PASSWORD") {
        Info "ADMIN_PASSWORD موجود فCF من قبل — تفوت (باش تبدلو: npx wrangler secret put ADMIN_PASSWORD)"
    } else {
        Info "نصنعو السرّ فCF (القيمة ما كتطبعش) …"
        $AdminPassword | & npx wrangler secret put ADMIN_PASSWORD 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) { Die "wrangler secret put فشل — جري يدوياً: npx wrangler secret put ADMIN_PASSWORD" }
        Info "✅ ADMIN_PASSWORD تصنع فCF"
    }
}

# ─── 9/9 PM2 watcher ─────────────────────────────────────────────────
Banner "9/9 PM2 WATCHER — laclarc-d1-watcher"
if (-not $SkipWatcher) {
    $pm2Ok = $true
    try { (& pm2 -v 2>$null | Out-String) | ForEach-Object { $null = $_ } } catch { $pm2Ok = $false }
    if (-not $pm2Ok) {
        Info "PM2 ما كاينش — نركبو (npm i -g pm2) …"
        & npm install -g pm2 --silent
        if ($LASTEXITCODE -ne 0) { Die "تركيب pm2 فشل — ركبو يدوياً: npm i -g pm2" }
    }
    & pm2 delete laclarc-d1-watcher 2>$null | Out-Null
    $env:ADMIN_PASSWORD = $AdminPassword
    $env:LOCAL_DATABASE_URL = if ($PgPassword -ne "") { "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${PgDb}" } else { "postgresql://${PgUser}@${PgHost}:${PgPort}/${PgDb}" }
    & pm2 start "scripts\realtime-d1-watcher.mjs" --name "laclarc-d1-watcher" --interpreter node --time
    if ($LASTEXITCODE -ne 0) { Die "pm2 start فشل" }
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_DATABASE_URL -ErrorAction SilentlyContinue
    & pm2 save
    Info "✅ watcher حي تحت PM2 (auto-restart على أي exit)"
} else {
    Warn "-SkipWatcher — فوتنا الـ PM2"
}

# ─── الأخيرة: push الـ config باش الـ binding يوصل للـ deploy ────────
Banner "DEPLOY — push wrangler.jsonc"
$gitStatus = (& git status --porcelain "wrangler.jsonc" 2>$null | Out-String)
if ($gitStatus.Trim() -ne "") {
    Info "wrangler.jsonc تغير محلياً — الـ binding DB ما يوصلش للإنتاج إلا منين يتpushا."
    if (Ask-YesNo "نعملو commit + push لwrangler.jsonc دابا؟") {
        & git add "wrangler.jsonc"
        & git commit -m "D1 migration: activate DB + STORE_KV bindings (laclarc-catalog) — via laclarc-d1-windows.ps1"
        & git push origin main
        if ($LASTEXITCODE -eq 0) { Info "✅ مشفوع — CI كيدير deploy، الـ endpoint يولي حي ف~2-3 دقائق" }
        else { Warn "push فشل — عملو يدوياً: git add wrangler.jsonc; git commit; git push" }
    } else {
        Info "أوكي — عمرو يدوياً منين تحب: git add wrangler.jsonc; git commit -m 'activate D1 bindings'; git push"
    }
} else {
    Info "wrangler.jsonc نظيف (تفعل من قبل ولا ما تغيرش)"
}

# ─── التقرير النهائي ─────────────────────────────────────────────────
Banner "✅ SALINA — التحقق النهائي (يراهول اليد)"
Write-Host ""
Write-Host "1) watcher حي؟          → pm2 status laclarc-d1-watcher"
Write-Host "2) العدّاد فD1؟          → npx wrangler d1 execute $D1Name --remote --command `"SELECT COUNT(*) FROM products`""
Write-Host "3) endpoint حي؟          → pm2 logs laclarc-d1-watcher --lines 30 --nostream"
Write-Host "   (اكتب شي حاجة فpgAdmin فجدول products — تشوف UPSERT ok فالسجل)"
Write-Host "4) الكاتالوگ الحي؟        → https://laclarc.com/api/products?page=1&limit=24"
Write-Host ""
Write-Host "ملاحظة: إلا شفت D1_NOT_BOUND_503 فسجل الـ watcher — معناها الـ deploy" -ForegroundColor Yellow
Write-Host "ما وصلش بعد: صبر 2-3 دقائق على CI ولا تحقق فGitHub Actions." -ForegroundColor Yellow
Write-Host ""
