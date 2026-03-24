# Chrome Web Store ZIP creation script
# Usage: powershell -ExecutionPolicy Bypass -File scripts/create_zip.ps1
# Run from project root directory

$ErrorActionPreference = 'Stop'

$manifest = Get-Content 'manifest.json' -Raw | ConvertFrom-Json
$version  = $manifest.version
$name     = $manifest.name

$distDir = 'dist'
$outFile = "$distDir\${name}-v${version}.zip"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if (Test-Path $outFile) {
    Remove-Item $outFile
}

Compress-Archive -Path @('manifest.json', 'background.js', 'icons') -DestinationPath $outFile

$size = (Get-Item $outFile).Length
Write-Host "Created: $outFile ($size bytes)"
