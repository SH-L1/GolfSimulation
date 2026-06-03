# Unity 2022.3 Android Viewer Migration

This repository keeps the Unity 6 project intact at `GolfSimulation/` and adds a Unity 2022.3 copy at `GolfSimulation_2022/`.

## Unity 2022 Copy

- Open `GolfSimulation_2022/` with Unity `2022.3.x`.
- Let Unity regenerate `Library/` and `Packages/packages-lock.json`.
- The copy is pinned to `2022.3.62f1` in `ProjectSettings/ProjectVersion.txt`; opening with another `2022.3.x` patch version is acceptable if Unity prompts for a same-LTS patch update.

## Package Changes

`GolfSimulation_2022/Packages/manifest.json` was downgraded for Unity 2022:

- URP: `17.3.0` -> `14.0.11`
- Input System: `1.18.0` -> `1.7.0`
- uGUI: `2.0.0` -> `1.0.0`
- Removed Microsoft GDK, GDK Tools, Multiplayer Center, and Purchasing.
- Removed `packages-lock.json` so Unity 2022 resolves a fresh lock file.

## First Open in Unity 2022

Before opening the project, confirm Unity Hub installed a complete Unity `2022.3.62f1` editor with:

- Core editor files, including `Editor/Data/Resources/PackageManager/Server/UnityPackageManager.exe`
- Android Build Support
- Android SDK & NDK Tools
- OpenJDK

1. Open `GolfSimulation_2022/`.
2. Wait for package resolve and full reimport.
3. Open `Assets/Scenes/SampleScene.unity`.
4. If rendering is pink/broken, run:
   - `GolfSimulation/2022/Recreate Minimal URP Assets`
   - Then reassign the generated URP asset if Unity asks.
5. Run:
   - `GolfSimulation/2022/Apply Android Viewer Settings`

## Android Library Export

In Unity 2022, run:

- `GolfSimulation/2022/Apply Android Viewer Settings`
- `GolfSimulation.EditorBuild.AndroidLibraryBuild2022.ExportAndroidLibrary`

Or from PowerShell after installing Unity 2022.3:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\tools\run_unity_2022_android_export.ps1
```

Close any already-open Unity editor for `GolfSimulation_2022/` before running the script. Unity batchmode cannot run while the project is locked by another editor instance.

The expected export path is:

`GolfSimulation_2022/Builds/Android/unityLibrary`

After export, verify the Unity Android Library output and the RN module path:

```powershell
node .\tools\validate_unity_library_export.js
```

## React Native Wiring

The Android Gradle project now points to:

`../GolfSimulation_2022/Builds/Android/unityLibrary`

The app already uses `@azesmway/react-native-unity` and renders `<UnityView />` in:

`src/screens/Viewer3D/index.tsx`
