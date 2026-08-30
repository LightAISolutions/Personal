# Transcribes meeting recordings with Whisper (large-v3-turbo) on the local GPU.
#
# Why this exists: the bare whisper-ctranslate2 command has three fragile
# assumptions — the venv must be activated, the pip-installed CUDA DLLs must be
# on PATH (Windows does not search site-packages), and the audio must sit in the
# current directory. This wrapper removes all three, so any file can be
# transcribed from any PowerShell window.
#
#   & "$env:USERPROFILE\whisper\transcribe.ps1" "C:\path\to\meeting.m4a"
#
# Tip: type the command with a trailing space, then drag the audio file(s) from
# File Explorer onto the window — PowerShell pastes the full quoted paths.
#
# Setup this expects (see repository-information/CHANGELOG.md v02.35r context):
#   py -3.12 -m venv $env:USERPROFILE\whisper
#   pip install whisper-ctranslate2 nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"

param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$Path
)

$venv = "$env:USERPROFILE\whisper"
$exe  = Join-Path $venv "Scripts\whisper-ctranslate2.exe"

if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host "whisper-ctranslate2 not found at $exe" -ForegroundColor Red
  Write-Host "Create the environment first (see the header of this script)." -ForegroundColor Red
  exit 1
}

# CTranslate2 loads cublas64_12.dll / cudnn by name. pip puts them under
# site-packages\nvidia\**\bin, which is not on the Windows DLL search path —
# without this the run dies with "Library cublas64_12.dll is not found".
$nvidia = Join-Path $venv "Lib\site-packages\nvidia"
$bins = (Get-ChildItem $nvidia -Recurse -Directory -Filter bin -ErrorAction SilentlyContinue |
         Select-Object -ExpandProperty FullName) -join ';'
if ($bins) { $env:PATH = "$bins;$env:PATH" } else {
  Write-Host "No NVIDIA library folders found under $nvidia — the run may fall back to CPU." -ForegroundColor Yellow
}

$failed = 0
foreach ($p in $Path) {
  if (-not (Test-Path -LiteralPath $p)) {
    Write-Host "Not found: $p" -ForegroundColor Red
    $failed++
    continue
  }
  $audio = (Resolve-Path -LiteralPath $p).Path
  $dir   = Split-Path -Parent $audio
  Write-Host "`n=== $([System.IO.Path]::GetFileName($audio)) ===" -ForegroundColor Cyan

  # --vad_filter skips silence (meetings are full of it); --language en avoids
  # a mis-detection when a meeting opens with a few non-English words.
  & $exe --model large-v3-turbo --device cuda --compute_type float16 `
         --vad_filter True --language en --output_format vtt `
         --output_dir $dir $audio
  if ($LASTEXITCODE -ne 0) { $failed++ }
}

if ($failed -gt 0) {
  Write-Host "`n$failed file(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "`nDone. Transcripts are beside their audio." -ForegroundColor Green

# Developed by: LightAISolutions
