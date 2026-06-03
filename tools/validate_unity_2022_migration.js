const fs = require("fs");
const path = require("path");

const root = process.cwd();
const project = path.join(root, "GolfSimulation_2022");
const fail = [];
const info = {};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function expect(condition, message) {
  if (!condition) fail.push(message);
}

expect(exists("GolfSimulation/ProjectSettings/ProjectVersion.txt"), "Unity 6 source project is missing.");
expect(exists("GolfSimulation_2022/ProjectSettings/ProjectVersion.txt"), "Unity 2022 copy is missing.");
info.hasGeneratedLibrary = exists("GolfSimulation_2022/Library");
info.hasGeneratedTemp = exists("GolfSimulation_2022/Temp");

const version = read("GolfSimulation_2022/ProjectSettings/ProjectVersion.txt");
expect(version.includes("2022.3."), "ProjectVersion.txt is not pinned to Unity 2022.3.");

const manifest = JSON.parse(read("GolfSimulation_2022/Packages/manifest.json"));
const deps = manifest.dependencies || {};
expect(deps["com.unity.render-pipelines.universal"] === "14.0.11", "URP is not downgraded to 14.0.11.");
expect(deps["com.unity.inputsystem"] === "1.7.0", "Input System is not downgraded to 1.7.0.");
expect(deps["com.unity.ugui"] === "1.0.0", "uGUI is not downgraded to 1.0.0.");
expect(!("com.unity.microsoft.gdk" in deps), "Microsoft GDK package still exists.");
expect(!("com.unity.microsoft.gdk.tools" in deps), "Microsoft GDK tools package still exists.");
expect(!("com.unity.multiplayer.center" in deps), "Multiplayer Center package still exists.");
expect(!("com.unity.purchasing" in deps), "Purchasing package still exists.");
info.hasRegeneratedPackageLock = exists("GolfSimulation_2022/Packages/packages-lock.json");
if (info.hasRegeneratedPackageLock) {
  const lock = JSON.parse(read("GolfSimulation_2022/Packages/packages-lock.json"));
  const lockedDeps = lock.dependencies || {};
  expect(lockedDeps["com.unity.render-pipelines.universal"]?.version === "14.0.11", "packages-lock.json did not resolve URP 14.0.11.");
  expect(lockedDeps["com.unity.inputsystem"]?.version === "1.7.0", "packages-lock.json did not resolve Input System 1.7.0.");
  expect(lockedDeps["com.unity.ugui"]?.version === "1.0.0", "packages-lock.json did not resolve uGUI 1.0.0.");
}

const graphics = read("GolfSimulation_2022/ProjectSettings/GraphicsSettings.asset");
const quality = read("GolfSimulation_2022/ProjectSettings/QualitySettings.asset");
expect(!graphics.includes("UniversalRenderPipelineGlobalSettings"), "URP17 global settings reference remains in GraphicsSettings.");
expect(!quality.includes("5e6cbd92db86f4b18aec3ed561671858"), "Old Mobile URP17 RPAsset is still assigned in QualitySettings.");
expect(!quality.includes("4b83569d67af61e458304325a23e5dfd"), "Old PC URP17 RPAsset is still assigned in QualitySettings.");
expect(!exists("GolfSimulation_2022/Assets/Settings/UniversalRenderPipelineGlobalSettings.asset"), "Unity 6 URP global settings asset remains.");

const projectSettings = read("GolfSimulation_2022/ProjectSettings/ProjectSettings.asset");
expect(projectSettings.includes("Android: com.golfsimulation.unity"), "Android application id is not set for Unity library.");
expect(projectSettings.includes("AndroidMinSdkVersion: 25"), "Android min SDK is not 25.");
expect(projectSettings.includes("AndroidTargetSdkVersion: 35"), "Android target SDK is not 35.");
expect(projectSettings.includes("scriptingBackend:") && projectSettings.includes("Android: 1"), "Android scripting backend is not IL2CPP.");

const streaming = path.join(project, "Assets", "StreamingAssets", "preprocessed", "face_on");
const jsonCount = fs.existsSync(streaming) ? fs.readdirSync(streaming).filter((f) => f.endsWith(".json")).length : 0;
expect(jsonCount === 45, `Expected 45 preprocessed JSON files, found ${jsonCount}.`);

const settingsGradle = read("android/settings.gradle");
expect(settingsGradle.includes("../GolfSimulation_2022/Builds/Android/unityLibrary"), "RN Android project does not point at GolfSimulation_2022 unityLibrary export.");
expect(exists("tools/validate_unity_library_export.js"), "unityLibrary export validator is missing.");
expect(exists("tools/run_unity_2022_android_export.ps1"), "Unity 2022 Android export script is missing.");

expect(exists("GolfSimulation_2022/Assets/Editor/AndroidLibraryBuild2022.cs"), "Android library export utility is missing.");
expect(exists("GolfSimulation_2022/Assets/Editor/Unity2022SetupUtility.cs"), "Unity 2022 setup utility is missing.");
expect(exists("docs/unity_2022_android_viewer_migration.md"), "Migration guide is missing.");

if (fail.length) {
  console.error(JSON.stringify({ ok: false, fail }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, project: "GolfSimulation_2022", preprocessedFiles: jsonCount, ...info }, null, 2));
