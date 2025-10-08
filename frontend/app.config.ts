import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectDir = __dirname;
  const iosDir = path.join(projectDir, 'ios');
  const includeNative = process.env.INCLUDE_NATIVE_CONFIG === '1' || !fs.existsSync(iosDir);

  const base: ExpoConfig = {
    name: 'Hue 2',
    slug: 'hue-2',
    version: '1.0.0',
    newArchEnabled: true,
    scheme: 'hue2',
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
          backgroundColor: '#ffffff',
        },
      ],
      './plugins/with-ios-widget',
    ],
    extra: {
      router: {},
      eas: {
        projectId: '8e503456-098f-4adf-8f8b-ef34d40c2240',
      },
    },
  };

  if (includeNative) {
    // Only include native config during prebuild or when ios/ does not exist.
    Object.assign(base, {
      orientation: 'portrait',
      icon: './assets/images/icon.png',
      userInterfaceStyle: 'automatic',
      ios: {
        supportsTablet: true,
        bundleIdentifier: 'com.adrienle.hue2',
        associatedDomains: ['applinks:hue2-production.up.railway.app'],
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false,
          NSUserActivityTypes: ['NSUserActivityTypeBrowsingWeb'],
        },
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/images/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        package: 'com.adrienle.hue2',
        edgeToEdgeEnabled: true,
      },
    });
  }

  return base;
};
