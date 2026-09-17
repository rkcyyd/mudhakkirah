Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $root 'assets\icon-512.png'

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle 16, 16, ($size-32), ($size-32)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 96
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc($rect.Right-$r, $rect.Y, $r, $r, 270, 90)
$path.AddArc($rect.Right-$r, $rect.Bottom-$r, $r, $r, 0, 90)
$path.AddArc($rect.X, $rect.Bottom-$r, $r, $r, 90, 90)
$path.CloseFigure()
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(31,111,235))
$g.FillPath($blue, $path)

$hdr = New-Object System.Drawing.Region $path
$hdr.Intersect((New-Object System.Drawing.Rectangle 16, 16, ($size-32), 120))
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11,79,196))
$g.FillRegion($dark, $hdr)

$g.FillEllipse($dark, 156, 4, 52, 80)
$g.FillEllipse($dark, 304, 4, 52, 80)

$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210,153,34))), 120, 216, 80, 68)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45,164,78))),  216, 216, 80, 68)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(207,34,46))),  312, 216, 80, 68)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 120, 316, 272, 44)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180,210,235))), 120, 380, 192, 44)

$g.Dispose()
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "created: $pngPath"
