# Swoosh

A modern habit tracking app with beautiful design and powerful analytics

Built with the Base App template - a modular React Native/Expo application foundation.

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn or npm
- Expo CLI
- Python 3.8+ (for backend)

### Installation

1. Install frontend dependencies:
```bash
cd frontend
yarn install
```

2. Install backend dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. **Important: Set your production URL**
   Replace all instances of `REPLACE_WITH_PROD_URL` with your actual production URL:
   ```bash
   # Find and replace in all files
   find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.sh" -o -name "*.md" \) \
     -not -path "./node_modules/*" \
     -exec sed -i '' 's|REPLACE_WITH_PROD_URL|https://your-production-url.com|g' {} \;
   ```

### Development

1. Start the backend:
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Start the frontend:
```bash
cd frontend
yarn start
```

## Configuration

This app uses a centralized configuration system. Main configuration files:

- `frontend/lib/app-config.ts` - Main app configuration
- `.env.local` - Environment variables
- `frontend/app.json` - Expo configuration

## Features

Current feature configuration:
- Authentication: $([ "$AUTH_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")
- Profile Pictures: ✅ Enabled
- Dark Mode: ✅ Enabled
- Push Notifications: ❌ Disabled

To enable/disable features, modify the `FEATURE_FLAGS` in `app-config.ts`.

## Customization

See `BASE_APP_CUSTOMIZATION_GUIDE.md` for detailed customization instructions.

## Deployment

### Frontend (Web)
```bash
cd frontend
yarn build:web
```

### Mobile Apps
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

### Internal Distribution (Diawi)

Build locally and upload to Diawi with a QR code for easy install on devices:

```bash
# 1) Set your Diawi token (do not commit this)
export DIAWI_TOKEN=your-diawi-token

# 2) Run the helper script (iOS reuses the persistent Xcode build cache)
./scripts/build_and_upload_diawi.sh            # fast iOS build and upload
./scripts/build_and_upload_diawi.sh android    # Android (if local build supported)

# Original EAS local build, including interactive signing setup if needed
./scripts/build_and_upload_diawi.sh ios --eas-build --interactive

# Upload an existing IPA without building
./scripts/build_and_upload_diawi.sh ios --file frontend/builds/swoosh-ios-fast.ipa --skip-build
```

Notes:
- Fast iOS builds use the checked-in Xcode workspace, cache Pods and DerivedData, and bundle the current JavaScript and widget code each time. An incremental Release install build is packaged into an archive for IPA export; Xcode's archive action would clean the compiled intermediates. The first build takes longer; subsequent builds reuse compiled dependencies.
- `--eas-build` retains the original EAS workflow. Android builds continue to use `./scripts/build-prod.sh`.
- It uploads the resulting artifact to Diawi using `DIAWI_TOKEN`, then prints the Diawi link. If `qrencode` is installed, it also renders a QR code in the terminal.
- If `qrencode` is missing, you will see install instructions (e.g., `brew install qrencode`).

#### Fast iOS setup and build-only commands

Download signing credentials once by running this from the repository root (the
subshell keeps your terminal in the root directory afterwards):

```bash
(cd frontend && eas credentials --platform ios)
```

Choose the production profile and the option to download credentials to `credentials.json`.
The file must include both native targets, `Hue2` and `Hue2WidgetExtension`, with separate
ad hoc provisioning profiles and a shared distribution certificate. Expo documents this
[multi-target credentials format](https://docs.expo.dev/app-signing/local-credentials/#multi-target-project).
Credentials, certificates, profiles, and build outputs are ignored by Git. Keep them local.
`SWOOSH_IOS_CREDENTIALS` or `--credentials` can select another credentials file; relative
paths in the credentials file are resolved from `frontend`, as in EAS.

From the repository root:

```bash
./scripts/build-ios-ipa-fast.sh --check           # check signing/configuration
./scripts/build-ios-ipa-fast.sh                   # build without uploading
./scripts/build-ios-ipa-fast.sh --profile staging --api-url https://staging.example.com
./scripts/build-ios-ipa-fast.sh --build-number 123
./scripts/build-ios-ipa-fast.sh --archive-only    # unsigned device archive for build QA
```

From `frontend`, `yarn build:ios:fast` and `yarn diawi:ios` provide the same build and
build/upload commands. The default IPA is `frontend/builds/swoosh-ios-fast.ipa`.
An alternate `--output` path is relative to `frontend` unless absolute. A failed build
leaves the previous IPA intact and stops before uploading. Build logs and compiled
dependencies live under `frontend/builds/native-cache/`; concurrent fast builds of the
same checkout fail with a lock message instead of sharing the archive while writing.
Compiler parallelism defaults to four jobs to limit memory use during concurrent work;
use `--jobs N` to change it. Device builds do not boot or control a simulator.

The builder loads the selected EAS profile's public environment, including inherited
profiles. Explicit shell variables take precedence, and `--api-url` overrides the API
for the selected environment. Local `.env` files are disabled for release bundling.
Remote EAS secrets/hooks are not run. Signing uses a temporary keychain removed after
export; provisioning profiles are installed locally for Xcode to reuse. Both the app
and widget are checked in the exported IPA before it replaces the previous output.

The checked-in native project is preserved: this command never runs Expo prebuild or
deletes `ios/`. Pod installation runs once and when native dependency inputs change;
`--install-pods` forces it. Changes to native app configuration/plugins still require
the usual reviewed native-project update. Native Swift/widget edits need only a rebuild.
Fast builds retain the native build number unless `--build-number` is supplied for both
targets; they do not update EAS's remote version counter. Use EAS for App Store builds.

### Backend
Deploy the backend to your preferred hosting platform (Railway, Render, AWS, etc.).

### MCP Server
The backend exposes an authenticated MCP Streamable HTTP endpoint at `/mcp`. MCP clients
should connect to:

```bash
https://your-production-api.example.com/mcp/
```

The MCP server validates the same Auth0 bearer tokens as the REST API and exposes tools for
reading habit state, creating/updating/deleting habits, checking habits and sub-habits, and
recording count or weight updates. In production, set:

```bash
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-auth0-audience
MCP_RESOURCE_SERVER_URL=https://your-production-api.example.com/mcp/
```

`MCP_ISSUER_URL` is optional and defaults to `https://${AUTH0_DOMAIN}/`.

## Support

- Company: Adrien Ecoffet
- Email: adrien@ecoffet.com

## License

[Add your license here]
