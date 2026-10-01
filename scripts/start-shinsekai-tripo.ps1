# Dedicated local TRIPO inbox. Does not open or overwrite existing .blend scenes.
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$bridgeOutput = Join-Path $workspaceRoot 'research-cache/tripo-bridge'
$receiverScript = Join-Path $PSScriptRoot 'shinsekai-tripo-receiver.py'
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe'
$listener = Get-NetTCPConnection -LocalPort 60600 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Output 'TRIPO receiver is already listening. Check receiver-status.json before sending.'
    exit 0
}
New-Item -ItemType Directory -Path $bridgeOutput -Force | Out-Null
$receiverProcess = Start-Process -FilePath $blenderExe -ArgumentList @('--factory-startup','--python',('"' + $receiverScript + '"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bridgeOutput 'receiver.stdout.log') -RedirectStandardError (Join-Path $bridgeOutput 'receiver.stderr.log') -PassThru
$receiverProcess.Id | Set-Content -LiteralPath (Join-Path $bridgeOutput 'receiver.pid')
Write-Output ('Started TRIPO receiver, PID ' + $receiverProcess.Id + '. Check receiver-status.json for connection state.')
