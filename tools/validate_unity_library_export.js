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
}

if (fs.existsSync(path.join(unityLibrary, "build.gradle"))) {
  const gradle = read(unityLibrary, "build.gradle");
  expect(
    /com\.android\.library/.test(gradle),
    "unityLibrary build.gradle is not an Android library module."
  );
  expect(gradle.includes("buildToolsVersion '35.0.0'"), "unityLibrary build.gradle is not normalized to Build Tools 35.0.0.");
}

if (fail.length) {
  console.error(JSON.stringify({ ok: false, unityLibrary, fail }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, unityLibrary }, null, 2));
