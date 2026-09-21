# ينشئ اختصارين:
#   1) "رزنامة" على سطح المكتب  → يفتح التطبيق كاملًا
#   2) "رزنامة — ويدجت" في مجلد بدء التشغيل → يفتح الويدجت تلقائيًا عند تسجيل الدخول
#
# التشغيل:  powershell -ExecutionPolicy Bypass -File desktop\install-shortcuts.ps1
# للحذف:    powershell -ExecutionPolicy Bypass -File desktop\install-shortcuts.ps1 -Remove

param([switch]$Remove)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$vbs     = Join-Path $root 'desktop\mudhakkirah.vbs'
$icon    = Join-Path $root 'assets\icon.ico'
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'

$desktop = [Environment]::GetFolderPath('Desktop')
$startup = [Environment]::GetFolderPath('Startup')

$appName    = [char]0x0631 + [char]0x0632 + [char]0x0646 + [char]0x0627 + [char]0x0645 + [char]0x0629   # رزنامة
$widgetName = $appName + ' ' + [char]0x2014 + ' ' + [char]0x0648 + [char]0x064A + [char]0x062F + [char]0x062C + [char]0x062A  # رزنامة — ويدجت

$appLnk    = Join-Path $desktop ($appName + '.lnk')
$widgetLnk = Join-Path $startup ($widgetName + '.lnk')

if ($Remove) {
  foreach ($p in @($appLnk, $widgetLnk)) {
    if ([System.IO.File]::Exists($p)) { [System.IO.File]::Delete($p); Write-Output "حُذف: $p" }
  }
  return
}

function New-Lnk($finalPath, $arguments, $desc) {
  $dir = Split-Path -Parent $finalPath
  $tmp = Join-Path $dir ('_mudh_tmp_' + [guid]::NewGuid().ToString('N') + '.lnk')
  $sh  = New-Object -ComObject WScript.Shell
  $s   = $sh.CreateShortcut($tmp)
  $s.TargetPath       = $wscript
  $s.Arguments        = $arguments
  $s.WorkingDirectory = $root
  $s.IconLocation     = "$icon,0"
  $s.Description       = $desc
  $s.Save()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sh) | Out-Null
  if ([System.IO.File]::Exists($finalPath)) { [System.IO.File]::Delete($finalPath) }
  [System.IO.File]::Move($tmp, $finalPath)
}

New-Lnk $appLnk    ('"{0}"' -f $vbs)          'رزنامة — التقويم والمهام'
New-Lnk $widgetLnk ('"{0}" widget' -f $vbs)   'رزنامة — ويدجت سطح المكتب'

# ضبط الأيقونة عبر Shell.Application (يتعامل مع أسماء الملفات العربية)
$app = New-Object -ComObject Shell.Application
foreach ($pair in @(@($desktop, ($appName + '.lnk')), @($startup, ($widgetName + '.lnk')))) {
  try {
    $lnk = $app.Namespace($pair[0]).ParseName($pair[1]).GetLink
    $lnk.SetIconLocation($icon, 0)
    $lnk.Save()
  } catch {}
}

Write-Output "تم إنشاء:"
Write-Output "  $appLnk"
Write-Output "  $widgetLnk"
