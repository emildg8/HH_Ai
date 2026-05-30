Add-Type -AssemblyName System.Drawing
$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$bg = [System.Drawing.Color]::FromArgb(26, 58, 92)
$g.Clear($bg)
$font = New-Object System.Drawing.Font('Segoe UI', 180, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::White
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
$g.DrawString('HH', $font, $brush, $rect, $sf)
$out = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'desktop\hh-ai-desktop\app-icon.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "OK $out"
