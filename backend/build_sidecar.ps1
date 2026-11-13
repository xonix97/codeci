# Build the Windows sidecar binary: codeci-backend.exe (onefile) -> src-tauri/binaries/
# Requires: the backend venv with pyinstaller installed.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root 'backend\.venv\Scripts\python.exe'
& $venv -m pip install --quiet pyinstaller
$out = Join-Path $root 'src-tauri\binaries'
New-Item -ItemType Directory -Force $out | Out-Null
& $venv -m PyInstaller --onefile --name codeci-backend `
  --collect-all musicdl `
  --collect-all Cryptodome `
  --collect-all Crypto `
  --collect-all av `
  --collect-all nodejs_wheel `
  --noconfirm --workpath (Join-Path $root 'backend\build') `
  --distpath (Join-Path $root 'backend\dist') `
  --specpath (Join-Path $root 'backend\build') `
  (Join-Path $root 'backend\app\main.py')
$dest = Join-Path $out 'codeci-backend-x86_64-pc-windows-msvc.exe'
Copy-Item (Join-Path $root 'backend\dist\codeci-backend.exe') $dest -Force
Write-Output "Sidecar written to $dest"
