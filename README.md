🌑 Eclipse GPS

A smart GPS and navigation app built for Durga Puja pandal hopping, with live GPS tracking, automatic nearby pandal discovery, route navigation, and more.

✨ Features

- 📍 Live GPS location tracking
- 🛕 Automatic nearby pandal discovery
- 📏 Nearest-to-farthest pandal ranking
- 🗺️ Interactive Google Maps
- 🛰️ Standard, Satellite and Hybrid map modes
- 🧭 Route calculation and navigation
- 🚗 Live movement tracking while navigating
- 🔄 Automatic route updates when required
- 🔐 Firebase Google Authentication
- 👥 Friends/live-location safety features
- 🤖 AI-assisted GPS experience
- 📱 Android APK support
- 💻 Mobile and desktop browser support
- 📐 Responsive mobile interface
- 📂 Pandal Explorer 2.0 with expandable/collapsible panel

🎯 Main Purpose

Eclipse GPS is designed to make Durga Puja pandal hopping easier.

Instead of manually searching for individual pandal names, the app can use the user's live location to discover nearby pandals and organize them based on distance.

🗺️ Navigation

The navigation system is designed to:

1. Detect the user's current GPS position.
2. Select a destination/pandal.
3. Calculate a route.
4. Display the route on the map.
5. Track the user's movement.
6. Keep the navigation experience synchronized with the user's location.

📱 Android

The Android version is built using Capacitor and can be packaged as an APK through GitHub Actions.

Build process

The project uses:

- Node.js 22
- Java 21
- Gradle
- Android SDK
- Capacitor
- GitHub Actions

Every push to the "main" branch can automatically trigger the Android build workflow.

The generated debug APK is uploaded as a GitHub Actions artifact.

🚀 Development

Install dependencies:

npm install

Build the web application:

npm run build

Sync the Android project:

npx cap sync android

Build the Android debug APK:

cd android
./gradlew assembleDebug

🔑 Configuration

Eclipse GPS uses environment variables for services such as Firebase and Google Maps.

Create a ".env" file locally with the required project configuration.

Never commit private API keys, service-account credentials, or other secrets to GitHub.

🔐 Firebase

Firebase is used for authentication and application services.

Google Sign-In is supported through Firebase Authentication.

🛠️ GitHub Actions

The Android workflow is located at:

.github/workflows/android.yml

The workflow:

1. Checks out the repository.
2. Installs Node.js.
3. Sets up Java.
4. Sets up Android tooling.
5. Installs dependencies.
6. Builds the web application.
7. Syncs Capacitor with Android.
8. Builds the debug APK.
9. Uploads the APK as an artifact.

📦 APK Updates

A new APK is generated when the workflow successfully builds after a code change.

Important: installing an APK does not automatically update when the GitHub repository changes.

A new APK must be downloaded and installed on the device unless an automatic update/release system is added later.

🧪 Testing Checklist

Before releasing a version, test:

- [ ] App launches correctly
- [ ] Location permission works
- [ ] Live GPS works
- [ ] Nearby pandals load
- [ ] Pandal ranking works
- [ ] Map loads correctly
- [ ] Standard map works
- [ ] Satellite map works
- [ ] Hybrid map works
- [ ] Route calculation works
- [ ] Navigation works
- [ ] GPS movement updates correctly
- [ ] App does not freeze
- [ ] Browser version works
- [ ] Android APK works
- [ ] Firebase Google Sign-In works
- [ ] Pandal Explorer Show/Hide works

🌑 Project

Eclipse GPS

Built as a smart navigation companion for exploring Durga Puja pandals and eventually other destinations.

---

Version

v1.0 — Development / Testing

More features and improvements will be added as Eclipse GPS evolves.
