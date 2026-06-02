Write-Host "[ADB Watch] USB 재연결 자동 감지 중... (Ctrl+C로 종료)" -ForegroundColor Cyan

$lastState = ""

while ($true) {
    $output = adb devices 2>&1 | Select-String "device$"
    $connected = $output -ne $null -and $output.Count -gt 0

    if ($connected -and $lastState -ne "connected") {
        $lastState = "connected"
        Write-Host "[ADB Watch] 기기 연결됨 — adb reverse 설정 중..." -ForegroundColor Green
        adb reverse tcp:8081 tcp:8081 | Out-Null
        Write-Host "[ADB Watch] 완료. Metro 연결 준비됨." -ForegroundColor Green
    }
    elseif (-not $connected -and $lastState -ne "disconnected") {
        $lastState = "disconnected"
        Write-Host "[ADB Watch] 기기 연결 끊김." -ForegroundColor Yellow
    }

    Start-Sleep -Seconds 3
}
