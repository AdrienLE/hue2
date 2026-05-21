import Foundation
import React
import WidgetKit

@objc(Hue2WidgetBridge)
final class Hue2WidgetBridge: NSObject {
  private static let appGroup = "group.com.adrienle.hue2"
  private static let accessTokenKey = "auth_access_token"
  private static let apiBaseURLKey = "api_base_url"
  private static let lastSyncKey = "last_sync_at"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(syncAuthContext:apiBaseUrl:resolver:rejecter:)
  func syncAuthContext(
    _ token: String,
    apiBaseUrl: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
      reject("HUE2_WIDGET_SYNC_FAILED", "The Hue 2 app group is not available in this build.", nil)
      return
    }

    defaults.set(token, forKey: Self.accessTokenKey)
    defaults.set(apiBaseUrl, forKey: Self.apiBaseURLKey)
    defaults.set(Date().timeIntervalSince1970, forKey: Self.lastSyncKey)
    defaults.synchronize()
    WidgetCenter.shared.reloadTimelines(ofKind: "Hue2Widget")
    resolve(nil)
  }

  @objc(clearAuthContext:rejecter:)
  func clearAuthContext(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
      reject("HUE2_WIDGET_CLEAR_FAILED", "The Hue 2 app group is not available in this build.", nil)
      return
    }

    defaults.removeObject(forKey: Self.accessTokenKey)
    defaults.removeObject(forKey: Self.apiBaseURLKey)
    defaults.removeObject(forKey: Self.lastSyncKey)
    defaults.synchronize()
    WidgetCenter.shared.reloadTimelines(ofKind: "Hue2Widget")
    resolve(nil)
  }
}
