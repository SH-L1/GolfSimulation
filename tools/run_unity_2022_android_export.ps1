param(
    [string]$UnityExe = "",
    [string]$ProjectPath = "",
    [string]$LogFile = ""
)

$ErrorActionPreference = "Stop"

function Invoke-UnityBatchMode {
    param(
        [string]$UnityExePath,
        [string]$ProjectPathValue,
        [string]$ExecuteMethod,
        [string]$UnityLogFile
    )

    $arguments = @(
        "-batchmode",
        "-quit",
        "-projectPath", $ProjectPathValue,
        "-executeMethod", $ExecuteMethod,
        "-logFile", $UnityLogFile
    )

    $process = Start-Process `
        -FilePath $UnityExePath `
        -ArgumentList $arguments `
        -Wait `
        -PassThru `
        -WindowStyle Hidden

    return $process.ExitCode
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    $ProjectPath = Join-Path $RepoRoot "GolfSimulation_2022"
}
if ([string]::IsNullOrWhiteSpace($LogFile)) {
    $LogFile = Join-Path $ProjectPath "Temp\unity-2022-android-export.log"
}

if ([string]::IsNullOrWhiteSpace($UnityExe)) {
    $hubRoot = "C:\Program Files\Unity\Hub\Editor"
    $candidate = Get-ChildItem -Path $hubRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "2022.3*" } |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if ($candidate -ne $null) {
        $UnityExe = Join-Path $candidate.FullName "Editor\Unity.exe"
    }
}

if (-not (Test-Path -LiteralPath $UnityExe)) {
    throw "Unity 2022.3 editor not found. Install Unity 2022.3.x or pass -UnityExe `"C:\Path\To\Unity.exe`"."
}

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    throw "Project path not found: $ProjectPath"
}

$projectLockFile = Join-Path $ProjectPath "Temp\UnityLockfile"
if (Test-Path -LiteralPath $projectLockFile) {
    $runningUnity = Get-Process Unity -ErrorAction SilentlyContinue
    if ($runningUnity -ne $null) {
        $processList = ($runningUnity | ForEach-Object { "$($_.Id)" }) -join ", "
        throw "Unity project appears to be open or locked. Close Unity process(es) first, then rerun this script. Unity PID(s): $processList"
    }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null
$setupLogFile = [System.IO.Path]::Combine(
    [System.IO.Path]::GetDirectoryName($LogFile),
    ([System.IO.Path]::GetFileNameWithoutExtension($LogFile) + "-setup" + [System.IO.Path]::GetExtension($LogFile))
)

$setupExitCode = Invoke-UnityBatchMode `
    -UnityExePath $UnityExe `
    -ProjectPathValue $ProjectPath `
    -ExecuteMethod "GolfSimulation.EditorBuild.Unity2022SetupUtility.RecreateMinimalUrpAssets" `
    -UnityLogFile $setupLogFile

if ($setupExitCode -ne 0) {
    throw "Unity 2022 URP setup failed. See log: $setupLogFile"
}

$exportExitCode = Invoke-UnityBatchMode `
    -UnityExePath $UnityExe `
    -ProjectPathValue $ProjectPath `
    -ExecuteMethod "GolfSimulation.EditorBuild.AndroidLibraryBuild2022.ExportAndroidLibrary" `
    -UnityLogFile $LogFile

if ($exportExitCode -ne 0) {
    throw "Unity 2022 Android Library export failed. See log: $LogFile"
}

$unityLibrary = Join-Path $ProjectPath "Builds\Android\unityLibrary"
if (-not (Test-Path -LiteralPath $unityLibrary)) {
    throw "Export completed but unityLibrary was not found: $unityLibrary"
}

Push-Location $RepoRoot
try {
    node .\tools\validate_unity_library_export.js $unityLibrary
}
finally {
    Pop-Location
}

Write-Host "Unity Android Library export complete: $unityLibrary"
