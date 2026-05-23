#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(Hue2WidgetBridge, NSObject)

RCT_EXTERN_METHOD(syncAuthContext:(NSString *)token
                  apiBaseUrl:(NSString *)apiBaseUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearAuthContext:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadTimelines:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
