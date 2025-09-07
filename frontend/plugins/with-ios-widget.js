// Minimal config plugin to scaffold a blank WidgetKit extension folder
// during `expo prebuild -p ios`. This writes Swift/Info.plist stubs under
// ios/<ProjectName>Widget/. It does NOT fully register the Xcode target —
// open Xcode once after prebuild to add the target and link the folder.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function safeName(name) {
  return String(name || 'App').replace(/[^A-Za-z0-9_]/g, '');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileOnce(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

function withIOSWidget(config) {
  return withDangerousMod(config, [
    'ios',
    cfg => {
      const projectRoot = cfg.modRequest.platformProjectRoot; // ios/
      const projectName = cfg.modRequest.projectName || safeName(cfg.name);
      const widgetTarget = `${safeName(projectName)}Widget`;
      const widgetDir = path.join(projectRoot, widgetTarget);

      ensureDir(widgetDir);

      // Bundle file
      const bundleSwift = `import WidgetKit\nimport SwiftUI\n\n@main\nstruct ${widgetTarget}Bundle: WidgetBundle {\n    var body: some Widget {\n        ${widgetTarget}()\n    }\n}\n`;
      writeFileOnce(path.join(widgetDir, `${widgetTarget}Bundle.swift`), bundleSwift);

      // Widget file
      const widgetSwift = `import WidgetKit\nimport SwiftUI\n\nstruct ${widgetTarget}Entry: TimelineEntry { let date: Date }\n\nstruct ${widgetTarget}Provider: TimelineProvider {\n    func placeholder(in context: Context) -> ${widgetTarget}Entry { .init(date: .now) }\n    func getSnapshot(in context: Context, completion: @escaping (${widgetTarget}Entry) -> ()) { completion(.init(date: .now)) }\n    func getTimeline(in context: Context, completion: @escaping (Timeline<${widgetTarget}Entry>) -> ()) {\n        completion(Timeline(entries: [.init(date: .now)], policy: .atEnd))\n    }\n}\n\nstruct ${widgetTarget}View: View {\n    var entry: ${widgetTarget}Entry\n    var body: some View {\n        ZStack {\n            Color(.systemBackground)\n            Text(\"Hue 2 Widget\")\n        }\n    }\n}\n\nstruct ${widgetTarget}: Widget {\n    var body: some WidgetConfiguration {\n        StaticConfiguration(kind: \"${widgetTarget}\", provider: ${widgetTarget}Provider()) { entry in\n            ${widgetTarget}View(entry: entry)\n        }\n        .configurationDisplayName(\"Hue 2\")\n        .description(\"Quick view of your habits.\")\n        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])\n    }\n}\n`;
      writeFileOnce(path.join(widgetDir, `${widgetTarget}.swift`), widgetSwift);

      // Assets and Info.plist stubs
      const assetsDir = path.join(widgetDir, 'Assets.xcassets');
      ensureDir(assetsDir);
      writeFileOnce(
        path.join(assetsDir, 'Contents.json'),
        JSON.stringify({ info: { version: 1, author: 'xcode' } }, null, 2)
      );

      // Minimal Info.plist for Widget extension
      const infoPlist = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n  <key>CFBundleDevelopmentRegion</key><string>en</string>\n  <key>CFBundleDisplayName</key><string>${widgetTarget}</string>\n  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>\n  <key>CFBundleName</key><string>${widgetTarget}</string>\n  <key>NSExtension</key>\n  <dict>\n    <key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string>\n  </dict>\n</dict>\n</plist>\n`;
      writeFileOnce(path.join(widgetDir, 'Info.plist'), infoPlist);

      // Drop a README with next steps
      const readme = `# ${widgetTarget}\n\nThis folder contains a stub WidgetKit extension. After running \`expo prebuild -p ios\`, open the Xcode workspace and add a new Widget Extension target named \"${widgetTarget}\" pointing to this folder. Ensure it's embedded in the app and included in the build phases.\n\nLater we can automate PBX target wiring.\n`;
      writeFileOnce(path.join(widgetDir, 'README.md'), readme);

      return cfg;
    },
  ]);
}

module.exports = withIOSWidget;
