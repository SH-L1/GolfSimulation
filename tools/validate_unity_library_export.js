const fs = require("fs");
const path = require("path");

const root = process.cwd();
const unityLibrary = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "GolfSimulation_2022", "Builds", "Android", "unityLibrary");

const fail = [];
const expect = (condition, message) => {
  if (!condition) fail.push(message);
};
const exists = (...parts) => fs.existsSync(path.join(...parts));
const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");

expect(fs.existsSync(unityLibrary), `unityLibrary directory not found: ${unityLibrary}`);
expect(exists(unityLibrary, "build.gradle"), "unityLibrary/build.gradle is missing.");
expect(exists(unityLibrary, "src", "main", "AndroidManifest.xml"), "unityLibrary AndroidManifest.xml is missing.");
expect(exists(unityLibrary, "src", "main", "assets"), "unityLibrary assets directory is missing.");
expect(
  exists(unityLibrary, "src", "main", "jniLibs") || exists(unityLibrary, "libs"),
  "unityLibrary native/library output is missing."
);

const settingsPath = path.join(root, "android", "settings.gradle");
expect(fs.existsSync(settingsPath), "android/settings.gradle is missing.");
if (fs.existsSync(settingsPath)) {
  const settings = fs.readFileSync(settingsPath, "utf8").replace(/\\/g, "/");
  expect(
    settings.includes("../GolfSimulation_2022/Builds/Android/unityLibrary"),
    "android/settings.gradle does not point to GolfSimulation_2022/Builds/Android/unityLibrary."
  );
}

const appGradlePath = path.join(root, "android", "app", "build.gradle");
expect(fs.existsSync(appGradlePath), "android/app/build.gradle is missing.");
if (fs.existsSync(appGradlePath)) {
  const appGradle = fs.readFileSync(appGradlePath, "utf8");
  expect(appGradle.includes("implementation project(':unityLibrary')"), "app build.gradle does not depend on :unityLibrary.");
  expect(appGradle.includes("pickFirst '**/libunity.so'"), "app build.gradle is missing libunity.so packaging conflict handling.");
  expect(appGradle.includes("ndkPath \"C:/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/NDK\""), "app build.gradle does not point at the Unity 2022 NDK.");
}

const rootGradlePath = path.join(root, "android", "build.gradle");
expect(fs.existsSync(rootGradlePath), "android/build.gradle is missing.");
if (fs.existsSync(rootGradlePath)) {
  const rootGradle = fs.readFileSync(rootGradlePath, "utf8");
  expect(rootGradle.includes('buildToolsVersion = "34.0.0"'), "Root Gradle buildToolsVersion is not aligned with the Unity export.");
  expect(rootGradle.includes('compileSdkVersion = 35'), "Root Gradle compileSdkVersion is not aligned with the Unity export.");
  expect(rootGradle.includes('targetSdkVersion = 35'), "Root Gradle targetSdkVersion is not aligned with the Unity export.");
  expect(rootGradle.includes('ndkVersion = "23.1.7779620"'), "Root Gradle ndkVersion is not aligned with the Unity export.");
}

const gradlePropertiesPath = path.join(root, "android", "gradle.properties");
expect(fs.existsSync(gradlePropertiesPath), "android/gradle.properties is missing.");
if (fs.existsSync(gradlePropertiesPath)) {
  const gradleProperties = fs.readFileSync(gradlePropertiesPath, "utf8");
  expect(gradleProperties.includes("ndkVersion=23.1.7779620"), "gradle.properties is missing the Unity NDK version override.");
  expect(gradleProperties.includes("ndkPath=C:/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/NDK"), "gradle.properties is missing the Unity NDK path override.");
}

if (fs.existsSync(path.join(unityLibrary, "build.gradle"))) {
  const gradle = read(unityLibrary, "build.gradle");
  expect(
    /com\.android\.library/.test(gradle),
    "unityLibrary build.gradle is not an Android library module."
  );
}

if (fail.length) {
  console.error(JSON.stringify({ ok: false, unityLibrary, fail }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, unityLibrary }, null, 2));
