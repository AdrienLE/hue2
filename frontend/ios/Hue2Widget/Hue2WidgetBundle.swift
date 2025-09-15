//
//  Hue2WidgetBundle.swift
//  Hue2Widget
//
//  Created by Adrien Ecoffet on 9/14/25.
//

import WidgetKit
import SwiftUI

@main
struct Hue2WidgetBundle: WidgetBundle {
    var body: some Widget {
        Hue2Widget()
        Hue2WidgetControl()
        Hue2WidgetLiveActivity()
    }
}
