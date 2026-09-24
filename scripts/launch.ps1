$projectRoot = Split-Path -Parent $PSScriptRoot
Start-Process -FilePath "$projectRoot/.venv/Scripts/pythonw.exe" -ArgumentList ('"' + "$PSScriptRoot/keep_running.py" + '"') -WindowStyle Hidden
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $studioStatus = Invoke-RestMethod 'http://127.0.0.1:5050/api/status' -TimeoutSec 1
        if ($studioStatus.project -eq 'ScrewShop') { break }
    } catch { }
    Start-Sleep -Milliseconds 500
}
$edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
if (Test-Path -LiteralPath $edge) {
    Start-Process -FilePath $edge -ArgumentList '--app=http://localhost:5050/barwork'
} else {
    Start-Process 'http://localhost:5050/barwork'
}
