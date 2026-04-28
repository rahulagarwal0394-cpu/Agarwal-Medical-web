$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = "C:\Users\Rahul Agarwal\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$serverPath = Join-Path $projectRoot "server.js"
$logPath = Join-Path $projectRoot "server.log"

Set-Location -LiteralPath $projectRoot
& $nodePath $serverPath *>> $logPath
