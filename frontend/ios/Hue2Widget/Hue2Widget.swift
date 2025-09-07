import WidgetKit
import SwiftUI

struct Hue2WidgetEntry: TimelineEntry { let date: Date }

struct Hue2WidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> Hue2WidgetEntry { .init(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (Hue2WidgetEntry) -> ()) { completion(.init(date: .now)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Hue2WidgetEntry>) -> ()) {
        completion(Timeline(entries: [.init(date: .now)], policy: .atEnd))
    }
}

struct Hue2WidgetView: View {
    var entry: Hue2WidgetEntry
    var body: some View {
        ZStack {
            Color(.systemBackground)
            Text("Hue 2 Widget")
        }
    }
}

struct Hue2Widget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Hue2Widget", provider: Hue2WidgetProvider()) { entry in
            Hue2WidgetView(entry: entry)
        }
        .configurationDisplayName("Hue 2")
        .description("Quick view of your habits.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
