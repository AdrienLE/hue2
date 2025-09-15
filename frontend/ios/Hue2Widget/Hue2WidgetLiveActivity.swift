//
//  Hue2WidgetLiveActivity.swift
//  Hue2Widget
//
//  Created by Adrien Ecoffet on 9/14/25.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct Hue2WidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct Hue2WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: Hue2WidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension Hue2WidgetAttributes {
    fileprivate static var preview: Hue2WidgetAttributes {
        Hue2WidgetAttributes(name: "World")
    }
}

extension Hue2WidgetAttributes.ContentState {
    fileprivate static var smiley: Hue2WidgetAttributes.ContentState {
        Hue2WidgetAttributes.ContentState(emoji: "😀")
     }

     fileprivate static var starEyes: Hue2WidgetAttributes.ContentState {
         Hue2WidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: Hue2WidgetAttributes.preview) {
   Hue2WidgetLiveActivity()
} contentStates: {
    Hue2WidgetAttributes.ContentState.smiley
    Hue2WidgetAttributes.ContentState.starEyes
}
