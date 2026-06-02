# APK 빌드 스크립트 — 실행할 때마다 버전 자동 증가
$versionFile = "android\version.properties"
$props = Get-Content $versionFile | Where-Object { $_ -match "=" }
$buildNumber = ($props | Where-Object { $_ -match "BUILD_NUMBER" }) -replace "BUILD_NUMBER=", ""
$buildNumber = [int]$buildNumber + 1

# version.properties 업데이트
"BUILD_NUMBER=$buildNumber" | Out-File $versionFile -Encoding utf8 -NoNewline

# JS 상수 파일 업데이트
"export const APP_VERSION = 'ver.$buildNumber';" | Out-File "src\constants\appVersion.ts" -Encoding utf8 -NoNewline

Write-Host "Building ver.$buildNumber..." -ForegroundColor Cyan

# JS 번들 생성 (캐시 초기화)
npx react-native bundle `
  --entry-file index.js `
  --platform android `
  --dev false `
  --bundle-output android/app/src/main/assets/index.android.bundle `
  --assets-dest android/app/src/main/res `
  --reset-cache

# APK 빌드
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

Write-Host ""
Write-Host "APK ready: ver.$buildNumber" -ForegroundColor Green
Write-Host "Path: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Green
