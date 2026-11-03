# Genera las vistas previas en Windows usando Google Chrome (no necesita Node).
#   preview\<diseno>\slide-1..3.png   -> los 3 slides tal como se publican (1440x1800)
#   preview\resumen\<diseno>.jpg       -> los 3 slides juntos, para revisar rapido
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\preview.ps1 [-Only 03]
param([string]$Only = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'No se encontro Chrome ni Edge.' }

$profileDir = Join-Path $env:TEMP 'instagram-webs-chrome'
$mockup = ([uri](Join-Path $root 'mockup\mockup.html')).AbsoluteUri
$cfg = Get-Content (Join-Path $root 'posts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$enc = { param($s) [uri]::EscapeDataString([string]$s) }

Add-Type -AssemblyName System.Drawing
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$quality = New-Object System.Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
$summaryDir = Join-Path $root 'preview\resumen'
New-Item -ItemType Directory -Force $summaryDir | Out-Null

for ($i = 0; $i -lt $cfg.sites.Count; $i++) {
  $s = $cfg.sites[$i]
  if ($Only -and -not $s.slug.StartsWith($Only)) { continue }
  $dir = Join-Path $root "preview\$($s.slug)"
  New-Item -ItemType Directory -Force $dir | Out-Null

  foreach ($n in 1..3) {
    $q = "site=$(& $enc $s.slug)&slide=$n&name=$(& $enc $s.name)&tag=$(& $enc $s.tag)&n=$('{0:D2}' -f ($i + 1))&handle=$(& $enc $cfg.handle)&bg=$(& $enc $s.bg)&ink=$(& $enc $s.ink)&accent=$(& $enc $s.accent)&font=$(& $enc $s.font)&fw=$(& $enc $s.fw)&layout=$(if ($i % 2) { 'b' } else { 'a' })"
    $out = Join-Path $dir "slide-$n.png"
    # Misma configuracion que generate.mjs: lienzo 1080x1350 con escala 4/3
    $chromeArgs = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', "--user-data-dir=`"$profileDir`"",
      '--window-size=1080,1350', '--force-device-scale-factor=1.3333333', '--virtual-time-budget=10000', "--screenshot=`"$out`"", "$mockup`?$q")
    Start-Process -FilePath $chrome -ArgumentList $chromeArgs -Wait -NoNewWindow -RedirectStandardError (Join-Path $env:TEMP 'instagram-webs-chrome.log')
  }

  # Imagen resumen con los 3 slides lado a lado
  $w = 720; $h = 900; $gap = 30
  $bmp = New-Object System.Drawing.Bitmap (($w * 3) + ($gap * 4)), ($h + $gap * 2)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::FromArgb(30, 30, 32))
  foreach ($n in 1..3) {
    $img = [System.Drawing.Image]::FromFile((Join-Path $dir "slide-$n.png"))
    $g.DrawImage($img, $gap + ($n - 1) * ($w + $gap), $gap, $w, $h)
    $img.Dispose()
  }
  $g.Dispose()
  $bmp.Save((Join-Path $summaryDir "$($s.slug).jpg"), $jpeg, $quality)
  $bmp.Dispose()
  Write-Host "OK $($s.slug)"
}
