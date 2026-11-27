# =====================================================================
# scripts/laclarc-d1-windows.ps1 - 100% D1 - full run from the local PC
# =====================================================================
# IMPORTANT - ASCII-ONLY FILE:
#   Windows PowerShell 5.1 reads a .ps1 WITHOUT BOM using the ANSI code
#   page (Windows-1252). UTF-8 Arabic/emoji/box-drawing chars then become
#   mojibake (e.g. a check mark ends with byte 0x94 = curly quote) and
#   the parser breaks with random "Unexpected token" errors.
#   => Keep every char here < 128. Messages below are Darja in Latin.
# =====================================================================
# Sequence (9 steps, each one shows its own result):
#   1/9  Preflight      - repo + node_modules + wrangler auth
#   2/9  Backup         - pg_dump laclarc_db -> G:\Laclarc\backups (keep last 7)
#   3/9  Ensure D1      - find laclarc-catalog or create it + get database_id
#   4/9  Enable config  - activate binding "DB" + STORE_KV in wrangler.jsonc (markers)
#   5/9  Schema         - d1_schema.sql -> D1 (remote)
#   6/9  Bulk push      - push-local-to-d1.mjs (54,367 products -> D1)
#   7/9  Orders export  - export orders from D1 -> JSON in backups
#   8/9  Secret         - ADMIN_PASSWORD in CF (create if missing)
#   9/9  PM2 watcher    - realtime-d1-watcher.mjs alive + save + logs
#
# Usage:
#   1) Fill the variables below (one time only)
#   2) .\scripts\laclarc-d1-windows.ps1
#   Options: -SkipPush (skip initial upload) | -SkipWatcher (skip PM2) | -Yes (auto-answer)
#
# Security: secrets are never printed - they pass via env/secret only.
# =====================================================================

param(
    [switch]$SkipPush,
    [switch]$SkipWatcher,
    [switch]$Yes  # auto-answer 'y' on every prompt (no interaction)
)

$ErrorActionPreference = 'Stop'

# --- Variables - fill once --------------------------------------------
$RepoRoot      = "C:\Users\B512\Desktop\DRPS\frontend"
$BackupDir     = "G:\Laclarc\backups"      # if G: is missing -> falls back to "$RepoRoot\backups"
$D1Name        = "laclarc-catalog"
$KvName        = "STORE_KV"
$PgHost        = "localhost"
$PgPort        = "5432"
$PgUser        = "postgres"
$PgPassword    = ""                        # <- local PostgreSQL password (empty = trusted auth)
$PgDb          = "laclarc_db"
$AdminPassword = ""                        # <- same value as the ADMIN_PASSWORD secret in Cloudflare
# ----------------------------------------------------------------------

function Banner([string]$step) { Write-Host "`n======== $step ========" -ForegroundColor Cyan }

function Info([string]$m)  { Write-Host "[d1-win] $m" }
function Warn([string]$m)  { Write-Host "[d1-win] [W]  $m" -ForegroundColor Yellow }
function Die([string]$m)   { Write-Host "[d1-win] FATAL: $m" -ForegroundColor Red; exit 1 }

function Ask-YesNo([string]$q) {
    if ($Yes) { Write-Host "[d1-win] $q -> -Yes -> y"; return $true }
    $a = Read-Host "[d1-win] $q (y/n)"
    return ($a -match '^[yY]')
}

# --- 1/9 Preflight ----------------------------------------------------
Banner "1/9 PREFLIGHT"
if (-not (Test-Path $RepoRoot)) { Die "RepoRoot makanch: $RepoRoot" }
Set-Location $RepoRoot
Info "repo: $RepoRoot"
if (-not (Test-Path (Join-Path $RepoRoot "node_modules\postgres"))) { Die "node_modules naqsa - jarri: npm install" }
if (-not (Test-Path (Join-Path $RepoRoot "scripts\realtime-d1-watcher.mjs"))) { Die "watcher makanch - jarri: git pull (les scripts khasshom ykono f repo)" }
if (-not (Test-Path (Join-Path $RepoRoot "migrations\d1_schema.sql"))) { Die "migrations\d1_schema.sql makanch - jarri: git pull" }

Info "check wrangler auth ..."
$who = (& npx wrangler whoami 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { Die "wrangler auth fachal - jarri: npx wrangler login" }
Info "wrangler auth ok"

# --- 2/9 Backup (pg_dump) ---------------------------------------------
Banner "2/9 BACKUP - pg_dump laclarc_db"
if (-not (Test-Path $BackupDir)) {
    try { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null; Info "sawbna: $BackupDir" }
    catch { $BackupDir = Join-Path $RepoRoot "backups"; New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null; Warn "G: mashi mawjoud - backups f: $BackupDir" }
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
if (-not $pgDump) { Die "pg_dump makanch - zido f PATH wla zid masar pg_dump f list (step 2)" }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "laclarc_db_$ts.dump"
Info "pg_dump: $pgDump"
if ($PgPassword -ne "") { $env:PGPASSWORD = $PgPassword }
& $pgDump "-h$PgHost" "-p$PgPort" "-U$PgUser" "-d$PgDb" "-Fc" "-f$backupFile"
if ($LASTEXITCODE -ne 0) { Die "pg_dump fachal (code $LASTEXITCODE) - nharso backup qbel ay haja okhra" }
$sz = [math]::Round((Get-Item $backupFile).Length / 1MB, 1)
Info "[OK] backup: $backupFile (${sz} MB)"
# keep only the last 7 dumps
Get-ChildItem $BackupDir -Filter "laclarc_db_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | ForEach-Object { Remove-Item $_.FullName -Force; Info "hina backup qdim: $($_.Name)" }
if ($PgPassword -ne "") { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

# --- 3/9 Ensure D1 (laclarc-catalog) -----------------------------------
Banner "3/9 ENSURE D1 - $D1Name"
Push-Location $RepoRoot
$d1ListRaw = (& npx wrangler d1 list --json 2>$null | Out-String)
$d1Id = $null
try {
    $d1Arr = $d1ListRaw | ConvertFrom-Json
    $existing = $d1Arr | Where-Object { $_.name -eq $D1Name } | Select-Object -First 1
    if ($existing) { $d1Id = $existing.uuid }
} catch { Warn "parse dyal d1 list fachal - njarbo tariqa okhra" }
if (-not $d1Id) {
    Info "malqinahch - nasn3ou ..."
    $createOut = (& npx wrangler d1 create $D1Name 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { Die "d1 create fachal: $($createOut.Substring(0, [Math]::Min(400, $createOut.Length)))" }
    $m = [regex]::Match($createOut, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')
    if (-not $m.Success) { Die "ma qdarnach nakhdo database_id mn natija dyal d1 create" }
    $d1Id = $m.Groups[1].Value
}
Info "[OK] D1: $D1Name -> $d1Id"

# --- 4/9 Enable bindings in wrangler.jsonc (markers) --------------------
Banner "4/9 ENABLE BINDINGS - wrangler.jsonc"
$cfgPath = Join-Path $RepoRoot "wrangler.jsonc"
$cfg = Get-Content $cfgPath -Raw

$kvId = $null
$kvMarker = '// { "binding": "STORE_KV", "id": "STORE_KV_ID_HERE" },'
if ($cfg.Contains($kvMarker)) {
    Info "STORE_KV: nasn3ou / njabou namespace ..."
    $kvOut = (& npx wrangler kv namespace create $KvName 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { Warn "kv namespace create fachal - STORE_KV ybqa m3attel (mashi hajiz - phase-3)"; $kvOut = "" }
    $mkv = [regex]::Match($kvOut, '"id"\s*:\s*"([0-9a-f]{32})"')
    if ($mkv.Success) {
        $kvId = $mkv.Groups[1].Value
        $cfg = $cfg.Replace($kvMarker, ('{ "binding": "STORE_KV", "id": "' + $kvId + '" },'))
        Info "[OK] STORE_KV activ: $kvId"
    }
} elseif ($cfg.Contains('"binding": "STORE_KV"')) {
    Info "STORE_KV activ mn qbel - tfout"
}

$dbMarker = '// { "binding": "DB", "database_name": "laclarc-catalog", "database_id": "D1_DATABASE_ID_HERE" },'
if ($cfg.Contains($dbMarker)) {
    $cfg = $cfg.Replace($dbMarker, ('{ "binding": "DB", "database_name": "' + $D1Name + '", "database_id": "' + $d1Id + '" },'))
    Info "[OK] binding DB activ f wrangler.jsonc: $d1Id"
} elseif ($cfg -match '"binding"\s*:\s*"DB"') {
    if ($cfg.Contains($d1Id)) { Info "binding DB activ mn qbel b nafs id - tfout" }
    else { Warn "binding DB mawjoud b id akhor - verifie wrangler.jsonc b yeddik" }
} else {
    Die "marker dyal DB malqinahch f wrangler.jsonc - jarri: git pull"
}
# NOTE: write wrangler.jsonc as UTF-8 WITHOUT BOM. PS 5.1 "Set-Content -Encoding UTF8"
# writes a BOM and the jsonc/wrangler parser may reject it -> WriteAllText is the safe way.
[System.IO.File]::WriteAllText($cfgPath, $cfg, (New-Object System.Text.UTF8Encoding($false)))
Info "wrangler.jsonc tbeddel (deploy kayji mnin dir push f step laakhira)"

# --- 5/9 Schema -> D1 ----------------------------------------------------
Banner "5/9 SCHEMA - d1_schema.sql -> remote D1"
& npx wrangler d1 execute $D1Name --remote -y --file "migrations\d1_schema.sql"
if ($LASTEXITCODE -ne 0) { Die "d1 execute (schema) fachal" }
Info "[OK] schema ttebbaqat (products | orders | system_events | d1_meta)"

# --- 6/9 Bulk push (PostgreSQL -> D1) ------------------------------------
Banner "6/9 BULK PUSH - 54,367 products -> D1 (~15-30 min, one-time)"
if (-not $SkipPush) {
    $env:LOCAL_DATABASE_URL = if ($PgPassword -ne "") { "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${PgDb}" } else { "postgresql://${PgUser}@${PgHost}:${PgPort}/${PgDb}" }
    $env:D1_NAME = $D1Name
    & node "scripts\push-local-to-d1.mjs"
    $pushCode = $LASTEXITCODE
    Remove-Item Env:LOCAL_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:D1_NAME -ErrorAction SilentlyContinue
    if ($pushCode -ne 0) { Die "bulk push fachal (code $pushCode) - les fichiers li b9aw f .d1-push/ - sehhah w 3awd jarri step 6 bohdha" }
    Info "[OK] initial push kml"
} else {
    Warn "-SkipPush - foutna bulk push (3adi ila derto mn qbel)"
}

# --- 7/9 Orders export (D1 -> JSON) ---------------------------------------
Banner "7/9 ORDERS EXPORT - D1 -> JSON (backup)"
try {
    $ordersFile = Join-Path $BackupDir "d1-orders_$ts.json"
    (& npx wrangler d1 execute $D1Name --remote --json -y --command "SELECT * FROM orders" 2>$null | Out-String) | Set-Content -Path $ordersFile -Encoding UTF8
    Info "[OK] orders dyal D1 msadderin: $ordersFile (khawin daba - phase-3)"
} catch {
    Warn "orders export mamchach - 3adi f phase 1 (table khawi): $($_.Exception.Message)"
}

# --- 8/9 Secret - ADMIN_PASSWORD ------------------------------------------
Banner "8/9 SECRET - ADMIN_PASSWORD (timing-safe f endpoint)"
if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
    Warn "3ammar `$AdminPassword f script - ila kan secret m3ammar mn qbel f CF makach mochkil"
    $secList = (& npx wrangler secret list 2>$null | Out-String)
    if ($secList -notmatch "ADMIN_PASSWORD") { Die "ADMIN_PASSWORD makanch la f CF la f script - khassek wahda mnhom" }
    Info "ADMIN_PASSWORD mawjoud f CF mn qbel [OK]"
} else {
    $secList = (& npx wrangler secret list 2>$null | Out-String)
    if ($secList -match "ADMIN_PASSWORD") {
        Info "ADMIN_PASSWORD mawjoud f CF mn qbel - tfout (bach tbedlo: npx wrangler secret put ADMIN_PASSWORD)"
    } else {
        Info "nasn3ou secret f CF (la valeur ma tprintach) ..."
        $AdminPassword | & npx wrangler secret put ADMIN_PASSWORD 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) { Die "wrangler secret put fachal - dirlou b yeddik: npx wrangler secret put ADMIN_PASSWORD" }
        Info "[OK] ADMIN_PASSWORD tsan3 f CF"
    }
}

# --- 9/9 PM2 watcher -------------------------------------------------------
Banner "9/9 PM2 WATCHER - laclarc-d1-watcher"
if (-not $SkipWatcher) {
    $pm2Ok = $true
    try { (& pm2 -v 2>$null | Out-String) | ForEach-Object { $null = $_ } } catch { $pm2Ok = $false }
    if (-not $pm2Ok) {
        Info "PM2 makanch - narkboh (npm i -g pm2) ..."
        & npm install -g pm2 --silent
        if ($LASTEXITCODE -ne 0) { Die "installation dyal pm2 fachal - rakkboh b yeddik: npm i -g pm2" }
    }
    & pm2 delete laclarc-d1-watcher 2>$null | Out-Null
    if ([string]::IsNullOrWhiteSpace($AdminPassword)) { Warn "AdminPassword khawi - watcher ghadi yposti bla password (ghadi ydiq 403) - 3ammar `$AdminPassword f script w 3awd" }
    $env:ADMIN_PASSWORD = $AdminPassword
    $env:LOCAL_DATABASE_URL = if ($PgPassword -ne "") { "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${PgDb}" } else { "postgresql://${PgUser}@${PgHost}:${PgPort}/${PgDb}" }
    & pm2 start "scripts\realtime-d1-watcher.mjs" --name "laclarc-d1-watcher" --interpreter node --time
    if ($LASTEXITCODE -ne 0) { Die "pm2 start fachal" }
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:LOCAL_DATABASE_URL -ErrorAction SilentlyContinue
    & pm2 save
    Info "[OK] watcher hay taht PM2 (auto-restart 3la ay exit)"
} else {
    Warn "-SkipWatcher - foutna PM2"
}

# --- Final: push the config so the binding reaches deploy -------------------
Banner "DEPLOY - push wrangler.jsonc"
$gitStatus = (& git status --porcelain "wrangler.jsonc" 2>$null | Out-String)
if ($gitStatus.Trim() -ne "") {
    Info "wrangler.jsonc tbeddel localement - binding DB ma youselch l production hta yitpusha."
    if (Ask-YesNo "ndiro commit + push l wrangler.jsonc daba?") {
        & git add "wrangler.jsonc"
        & git commit -m "D1 migration: activate DB + STORE_KV bindings (laclarc-catalog) - via laclarc-d1-windows.ps1"
        & git push origin main
        if ($LASTEXITCODE -eq 0) { Info "[OK] itpusha - CI kaydir deploy, endpoint ywalli hay f ~2-3 d9ay9" }
        else { Warn "push fachal - dirlou b yeddik: git add wrangler.jsonc; git commit; git push" }
    } else {
        Info "ok - dirlou b yeddik mnin bghit: git add wrangler.jsonc; git commit -m 'activate D1 bindings'; git push"
    }
} else {
    Info "wrangler.jsonc nqi (activ mn qbel wla matbeddelch)"
}

# --- Final report ------------------------------------------------------------
Banner "[OK] SALINA - verification finale (b yeddik)"
Write-Host ""
Write-Host "1) watcher hay?    -> pm2 status laclarc-d1-watcher"
Write-Host "2) counter f D1?   -> npx wrangler d1 execute $D1Name --remote --command `"SELECT COUNT(*) FROM products`""
Write-Host "3) endpoint hay?   -> pm2 logs laclarc-d1-watcher --lines 30 --nostream"
Write-Host "   (ktb chi haja f pgAdmin f table products - tchouf UPSERT ok f log)"
Write-Host "4) catalog hay?    -> https://laclarc.com/api/products?page=1&limit=24"
Write-Host ""
Write-Host "Note: ila chfti D1_NOT_BOUND_503 f log dyal watcher - 3niha deploy" -ForegroundColor Yellow
Write-Host "ma wasselch: tsenna 2-3 d9ay9 3la CI wla verifi f GitHub Actions." -ForegroundColor Yellow
Write-Host ""
