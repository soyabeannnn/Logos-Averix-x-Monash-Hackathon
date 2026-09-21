<#
.SYNOPSIS
  One-step setup for Logos on Windows (also works on macOS/Linux with PowerShell 7).

.DESCRIPTION
  Checks Python and Node.js, creates .venv, installs backend and frontend dependencies, and creates
  .env (offering to save your Anthropic API key). Safe to re-run: finished steps are skipped.

.PARAMETER Start
  After setup, open the backend and the frontend each in their own window, then open the browser.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\setup.ps1
  powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Start
#>
param([switch]$Start)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
$EnvFile = Join-Path $Root ".env"
$KeyPlaceholder = "sk-ant-your-key-here"

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    ok: $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    warning: $text" -ForegroundColor Yellow }

function Stop-Setup($text) {
  Write-Host "`nSetup stopped: $text" -ForegroundColor Red
  exit 1
}

# Returns the first command line that runs a Python >= 3.10, as an array (program + leading args).
function Find-Python {
  $candidates = @(@("py", "-3"), @("python"), @("python3"))
  foreach ($candidate in $candidates) {
    if (-not (Get-Command $candidate[0] -ErrorAction SilentlyContinue)) { continue }
    try {
      $rest = @($candidate | Select-Object -Skip 1)
      $ok = & $candidate[0] @rest -c "import sys; print(sys.version_info >= (3, 10))" 2>$null
      if ($ok -eq "True") { return $candidate }
    } catch { }
  }
  return $null
}

function Test-NodeVersion {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  $version = (node --version).TrimStart("v").Split(".")
  return ([int]$version[0] -gt 20) -or ([int]$version[0] -eq 20 -and [int]$version[1] -ge 9)
}

function Get-EnvValue($name) {
  if (-not (Test-Path $EnvFile)) { return "" }
  $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^\s*$name\s*=\s*", "").Trim()
}

function Set-EnvValue($name, $value) {
  $lines = @(Get-Content $EnvFile)
  $updated = $false
  $lines = $lines | ForEach-Object {
    if ($_ -match "^\s*$name\s*=") { $updated = $true; "$name=$value" } else { $_ }
  }
  if (-not $updated) { $lines += "$name=$value" }
  Set-Content -Path $EnvFile -Value $lines -Encoding ASCII
}

# ---- 1. prerequisites ----
Write-Step "Checking prerequisites"
$python = Find-Python
if (-not $python) {
  Stop-Setup "Python 3.10 or newer was not found. Install it from https://www.python.org/downloads/ (tick 'Add python.exe to PATH') or run: winget install Python.Python.3.12"
}
Write-Ok ("Python: " + (& $python[0] @($python | Select-Object -Skip 1) --version))
if (-not (Test-NodeVersion)) {
  Stop-Setup "Node.js 20.9 or newer was not found. Install the LTS version from https://nodejs.org or run: winget install OpenJS.NodeJS.LTS"
}
Write-Ok ("Node.js: " + (node --version))

# ---- 2. backend ----
Write-Step "Setting up the backend"
$venvPython = if ($IsWindows -or $env:OS -eq "Windows_NT") { Join-Path $Root ".venv\Scripts\python.exe" } else { Join-Path $Root ".venv/bin/python" }
if (-not (Test-Path $venvPython)) {
  & $python[0] @($python | Select-Object -Skip 1) -m venv (Join-Path $Root ".venv")
  if ($LASTEXITCODE -ne 0) { Stop-Setup "could not create the virtual environment (.venv)" }
  Write-Ok "created .venv"
} else {
  Write-Ok ".venv already exists"
}
& $venvPython -m pip install --quiet --disable-pip-version-check -r (Join-Path $Root "requirements.txt")
if ($LASTEXITCODE -ne 0) { Stop-Setup "pip install failed" }
Write-Ok "backend dependencies installed"

# ---- 3. API key ----
Write-Step "Checking .env"
if (-not (Test-Path $EnvFile)) {
  Copy-Item (Join-Path $Root ".env.example") $EnvFile
  Write-Ok "created .env from .env.example"
}
$key = Get-EnvValue "ANTHROPIC_API_KEY"
if (-not $key -or $key -eq $KeyPlaceholder) {
  if ([Console]::IsInputRedirected) {
    Write-Warn "ANTHROPIC_API_KEY is not set. Edit .env and paste your key before running the pipeline."
  } else {
    $secure = Read-Host "Paste your Anthropic API key (input hidden; press Enter to skip)" -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    if ($plain) {
      Set-EnvValue "ANTHROPIC_API_KEY" $plain.Trim()
      Write-Ok "saved the key to .env (this file is git-ignored)"
    } else {
      Write-Warn "no key entered. Edit .env and set ANTHROPIC_API_KEY before running the pipeline."
    }
  }
} else {
  Write-Ok "ANTHROPIC_API_KEY is set"
}

# ---- 4. frontend ----
Write-Step "Setting up the frontend"
Push-Location $Frontend
try {
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Stop-Setup "npm install failed" }
} finally {
  Pop-Location
}
Write-Ok "frontend dependencies installed"

# ---- 5. dataset ----
Write-Step "Checking the dataset"
if ((Test-Path (Join-Path $Root "inbox")) -and (Test-Path (Join-Path $Root "attachments"))) {
  Write-Ok "inbox/ and attachments/ found"
} else {
  Write-Warn "inbox/ and attachments/ were not found next to loader.py. The Inbox will stay empty until you add them or set DATA_SOURCE in .env."
}

# ---- done ----
Write-Host "`nSetup complete." -ForegroundColor Green
if ($Start) {
  Write-Step "Starting Logos (a window opens for the backend and one for the frontend)"
  $shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
  Start-Process $shell -WorkingDirectory $Root -ArgumentList "-NoExit", "-Command", "& '$venvPython' -m uvicorn logos.api:app --port 8000"
  Start-Process $shell -WorkingDirectory $Frontend -ArgumentList "-NoExit", "-Command", "npm run dev"
  Start-Sleep -Seconds 8
  Start-Process "http://localhost:3000"
} else {
  Write-Host @"

To run it, open two terminals in this folder:

  Terminal 1 (backend):   .venv\Scripts\python.exe -m uvicorn logos.api:app --port 8000
  Terminal 2 (frontend):  cd frontend; npm run dev

Then open http://localhost:3000. Or re-run this script with -Start to do both for you.
"@
}
