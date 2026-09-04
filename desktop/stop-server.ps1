# يوقف خادم مذكّرتي المحلي فقط (عملية pythonw التي تشغّل serve.py)
Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe'" |
  Where-Object { $_.CommandLine -match 'serve\.py' } |
  ForEach-Object {
    Write-Output ("إيقاف PID {0}" -f $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force
  }
Write-Output "تم."
