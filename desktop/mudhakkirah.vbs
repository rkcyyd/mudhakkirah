' ============================================================
'  mudhakkirah launcher
'  - no args   : opens the full app
'  - "widget"  : opens the compact desktop widget window
'
'  After you host the site, change APP_URL below to your URL,
'  e.g.  APP_URL = "https://USERNAME.github.io/mudhakkirah"
' ============================================================

APP_URL = "https://rkcyyd.github.io/mudhakkirah"

' ---------- setup ----------
Dim sh  : Set sh  = CreateObject("WScript.Shell")
Dim fso : Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir : scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Dim projectDir : projectDir = fso.GetParentFolderName(scriptDir)

Dim mode : mode = ""
If WScript.Arguments.Count > 0 Then mode = LCase(WScript.Arguments(0))

Dim isLocal : isLocal = (InStr(APP_URL, "localhost") > 0) Or (InStr(APP_URL, "127.0.0.1") > 0)

' ---------- 1) start the local server if needed ----------
If isLocal Then
  If Not ServerUp() Then
    sh.CurrentDirectory = projectDir
    sh.Run "pythonw """ & projectDir & "\serve.py"" 5173", 0, False
    Dim i
    For i = 1 To 40
      If ServerUp() Then Exit For
      WScript.Sleep 250
    Next
  End If
End If

' ---------- 2) build the URL ----------
Dim target : target = APP_URL & "/index.html#/"
If mode = "widget" Then target = target & "widget" Else target = target & "calendar"

' ---------- 3) find a Chromium browser for app-mode ----------
Dim candidates
candidates = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") )

Dim c, browser : browser = ""
For Each c In candidates
  If fso.FileExists(c) Then
    browser = c
    Exit For
  End If
Next

' ---------- 4) launch ----------
Dim args
If mode = "widget" Then
  args = "--app=" & target & " --window-size=430,700 --window-position=32,64"
Else
  args = "--app=" & target
End If

If browser <> "" Then
  sh.Run """" & browser & """ " & args, 1, False
Else
  sh.Run target, 1, False   ' fall back to the default browser
End If

' ---------- helper ----------
Function ServerUp()
  ServerUp = False
  On Error Resume Next
  Dim http : Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", "http://localhost:5173/index.html", False
  http.Send
  If Err.Number = 0 Then ServerUp = (http.Status = 200)
  On Error GoTo 0
End Function
