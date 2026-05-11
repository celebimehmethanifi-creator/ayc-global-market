# Stop all AYC Global Market services
Write-Host "Tum servisler durduruluyor..." -ForegroundColor Yellow
@(8000,8001,8002,8003,3000) | ForEach-Object {
    $port = $_
    $pids = netstat -ano | Select-String ":$port " | ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}
Write-Host "Tum servisler durduruldu." -ForegroundColor Green