/**
 * Lets a release build talk to a plaintext (`http://`) backend.
 *
 * React Native's gradle plugin sets `android:usesCleartextTraffic` to false for
 * the release build type (see
 * `@react-native/gradle-plugin/.../AgpConfiguratorUtils.kt`), and only the debug
 * manifest opts back in. So a release APK whose `EXPO_PUBLIC_API_URL` is a local
 * `http://10.0.2.2:8000` has every fetch and WebSocket refused by the OS, with
 * nothing in the app to explain why.
 *
 * Rather than flipping cleartext on unconditionally — which would also allow it
 * for the published server build — this enables it only when the build actually
 * targets a plaintext URL. An `https://` backend leaves the manifest untouched.
 */

const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (!apiUrl.startsWith('http://')) return config;

  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};