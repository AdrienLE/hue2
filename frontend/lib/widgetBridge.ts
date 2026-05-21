import { NativeModules, Platform } from 'react-native';

type Hue2WidgetBridgeModule = {
  syncAuthContext: (token: string, apiBaseUrl: string) => Promise<void>;
  clearAuthContext: () => Promise<void>;
};

const widgetBridge =
  Platform.OS === 'ios'
    ? (NativeModules.Hue2WidgetBridge as Hue2WidgetBridgeModule | undefined)
    : undefined;

export async function syncWidgetAuthContext(token: string, apiBaseUrl: string) {
  if (!widgetBridge || !token || !apiBaseUrl) return;

  try {
    await widgetBridge.syncAuthContext(token, apiBaseUrl);
  } catch (error) {
    console.warn('Failed to sync auth context for Hue 2 widget', error);
  }
}

export async function clearWidgetAuthContext() {
  if (!widgetBridge) return;

  try {
    await widgetBridge.clearAuthContext();
  } catch (error) {
    console.warn('Failed to clear auth context for Hue 2 widget', error);
  }
}
