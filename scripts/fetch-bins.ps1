# fetch-bins.ps1 — pobiera yt-dlp + ffmpeg/ffprobe do bin/win (Windows).
# Uruchom: npm run fetch-bins:win
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'bin\win'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host 'Pobieranie yt-dlp.exe...'
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' `
  -OutFile (Join-Path $dest 'yt-dlp.exe')

Write-Host 'Pobieranie ffmpeg (BtbN, win64-gpl)...'
$zip = Join-Path $env:TEMP 'ffmpeg-ytgrab.zip'
$ext = Join-Path $env:TEMP 'ffmpeg-ytgrab'
Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' `
  -OutFile $zip
if (Test-Path $ext) { Remove-Item -Recurse -Force $ext }
Expand-Archive -Path $zip -DestinationPath $ext -Force

$ffmpeg = Get-ChildItem -Path $ext -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
$ffprobe = Get-ChildItem -Path $ext -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
Copy-Item $ffmpeg.FullName (Join-Path $dest 'ffmpeg.exe') -Force
Copy-Item $ffprobe.FullName (Join-Path $dest 'ffprobe.exe') -Force

Remove-Item $zip -Force
Remove-Item -Recurse -Force $ext

Write-Host "Gotowe. Binarki w: $dest"
Get-ChildItem $dest | Select-Object Name, Length | Format-Table
