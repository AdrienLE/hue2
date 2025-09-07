# Hue 2 — Product & Engineering Plan

This document captures the near‑term plan for Hue 2. The focus is to add an iOS Home Screen widget while keeping our Expo/EAS workflow intact and ensuring builds (local and cloud) include the widget.

## Goals

- Add a first‑class iOS widget to quickly glance at habits and, in later phases, support basic actions (check, +1, ±weight).
- Maintain our Expo/EAS workflows for builds and releases; minimize disruption to the React Native app.
- Keep the widget implementation modular and incrementally upgradable (e.g., deep‑link MVP → interactive AppIntents later).

## Scope (Phase 1)

- Ship a display widget (StaticConfiguration) that shows placeholder content now, and later a snapshot of habits.
- Taps can deep‑link into the app (e.g., open the app to the main list). Interactivity via AppIntents comes in Phase 2.
- Ensure build scripts (local + Diawi and cloud/EAS) incorporate the widget target.

## Architecture

- App: Expo/React Native app remains unchanged for core logic.
- Widget: Native Swift/SwiftUI via WidgetKit in a Widget Extension target.
- Build Integration: Use an Expo config plugin to scaffold the widget files during `expo prebuild -p ios`. When the `ios/` project is checked in or generated, the widget target is present and bundled.

## Implementation Plan

1) Widget Scaffolding (this repo)
   - Add a config plugin at `frontend/plugins/with-ios-widget.js` that, during iOS prebuild, writes a minimal WidgetKit extension (SwiftUI stub + Info.plist) into the iOS project directory. The plugin attempts to set up the extension folder structure consistently.
   - Add the plugin reference to `frontend/app.json` (`plugins` array) so managed prebuilds (local or EAS) run it.

2) Build Scripts
   - Keep existing build scripts. They already support local builds and Diawi upload:
     - `scripts/build-prod.sh` — builds iOS/Android (local or cloud via EAS profiles); accepts API URL overrides.
     - `scripts/build_and_upload_diawi.sh` — builds and uploads the latest iOS artifact to Diawi.
   - Add a convenience workflow for iOS + widgets:
     - `scripts/ios_widget_workflow.sh` — runs `expo prebuild -p ios`, installs pods, builds iOS (local by default), and optionally uploads to Diawi.

3) Auth & Data (Phase 2)
   - For interactive widget actions (iOS 17+), add an AppIntents target and share auth via App Groups or Keychain access group. This requires changes to Auth (prefer PKCE + refresh token) and entitlements. Not in Phase 1.

## Developer Workflow

- Local prebuild + build (includes widget):
  - `./scripts/ios_widget_workflow.sh`                     # prebuild + local build
  - `./scripts/ios_widget_workflow.sh --diawi --token …`   # prebuild + local build + Diawi upload
  - `./scripts/ios_widget_workflow.sh --cloud`             # prebuild + cloud (EAS) build

- Cloud builds (EAS):
  - Continue using existing workflows (`scripts/build-prod.sh ios`, EAS profiles in `frontend/eas.json`). The config plugin runs during managed prebuild on EAS, so the widget files are included.

## Future Roadmap (Widget)

- Phase 1 (now): Display widget + deep‑link action to open the app.
- Phase 2: Interactive widget with AppIntents (check, +1, ±weight) using App Groups/Keychain shared auth.
- Phase 3: Snapshot caching + background refresh polish + analytics.

## Notes & Limitations

- The config plugin scaffolds a default Widget extension with minimal SwiftUI. Xcode may still be required for fine‑grained target tweaks. If automatic target wiring needs refinement, we can promote the plugin to fully register PBX targets or commit `ios/` with the target included.
- The widget currently uses placeholder content (static label). Hooking it to live data comes next.
