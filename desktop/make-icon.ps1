# يُنشئ assets/icon.ico و assets/icon.png من رسم بسيط.
# التشغيل:  powershell -ExecutionPolicy Bypass -File desktop\make-icon.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $root 'assets\icon.png'
$icoPath = Join-Path $root 'assets\icon.ico'

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::Transparent)

# خلفية زرقاء بحواف دائرية
$rect = New-Object System.Drawing.Rectangle 8, 8, ($size-16), ($size-16)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 48
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc($rect.Right-$r, $rect.Y, $r, $r, 270, 90)
$path.AddArc($rect.Right-$r, $rect.Bottom-$r, $r, $r, 0, 90)
$path.AddArc($rect.X, $rect.Bottom-$r, $r, $r, 90, 90)
$path.CloseFigure()
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(31,111,235))
$g.FillPath($blue, $path)

# شريط علوي أغمق (ترويسة تقويم)
$hdr = New-Object System.Drawing.Region $path
$hdr.Intersect((New-Object System.Drawing.Rectangle 8, 8, ($size-16), 60))
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11,79,196))
$g.FillRegion($dark, $hdr)

# حلقتان علويتان
$g.FillEllipse($dark, 78, 2, 26, 40)
$g.FillEllipse($dark, 152, 2, 26, 40)

# ثلاث خانات ملوّنة (واجب/اختبار)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210,153,34))), 60, 108, 40, 34)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45,164,78))),  108, 108, 40, 34)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(207,34,46))),  156, 108, 40, 34)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 60, 158, 136, 22)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180,210,235))), 60, 190, 96, 22)

$g.Dispose()
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# لفّ الـ PNG داخل ملف ICO (يدعمه ويندوز Vista فأحدث)
$png = [System.IO.File]::ReadAllBytes($pngPath)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)   # ICONDIR
$bw.Write([Byte]0); $bw.Write([Byte]0)                             # 256x256
$bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length)
$bw.Write([UInt32]22)                                              # offset
$bw.Write($png)
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bmp.Dispose()

Write-Output "created: $pngPath"
Write-Output "created: $icoPath"
