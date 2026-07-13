import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectDir = __dirname;
  const iosDir = path.join(projectDir, 'ios');
  const androidDir = path.join(projectDir, 'android');
  const includeIos = process.env.INCLUDE_NATIVE_CONFIG === '1' || !fs.existsSync(iosDir);
  const includeAndroid = process.env.INCLUDE_NATIVE_CONFIG === '1' || !fs.existsSync(androidDir);
  const iosBundleIdentifier = 'com.adrienle.hue2';
  const widgetBundleIdentifier = 'com.adrienle.hue2.Hue2Widget';
  const appGroupIdentifier = 'group.com.adrienle.hue2';
  const appGroupEntitlement = {
    'com.apple.security.application-groups': [appGroupIdentifier],
  };

  const base: ExpoConfig = {
    name: 'Swoosh',
    slug: 'hue-2',
    version: '1.1.0',
    newArchEnabled: true,
    scheme: 'hue2',
    ios: {
      bundleIdentifier: iosBundleIdentifier,
      entitlements: appGroupEntitlement,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon-48x48.png',
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      [
        'expo-router',
        {
          origin: 'https://hue2-production.up.railway.app',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0d0f12',
        },
      ],
      './plugins/with-ios-widget',
    ],
    extra: {
      router: {},
      eas: {
        projectId: '8e503456-098f-4adf-8f8b-ef34d40c2240',
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: 'Hue2WidgetExtension',
                  bundleIdentifier: widgetBundleIdentifier,
                  entitlements: appGroupEntitlement,
                },
              ],
            },
          },
        },
      },
    },
  };

  Object.assign(base, {
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
  });

  if (includeIos) {
    base.ios = {
      entitlements: appGroupEntitlement,
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      associatedDomains: ['applinks:hue2-production.up.railway.app'],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserActivityTypes: ['NSUserActivityTypeBrowsingWeb'],
      },
    };
  }

  if (includeAndroid) {
    base.android = {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0d0f12',
      },
      package: 'com.adrienle.hue2',
      edgeToEdgeEnabled: true,
    };
  }

  return base;
};
