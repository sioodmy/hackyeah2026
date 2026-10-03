{
  pkgs,
  system,
}: let
  # Minimalny zestaw pod Expo SDK 56 / RN 0.85 (compileSdk 35).
  #
  # Celowo bez NDK, cmake i emulatora: MapLibre, Reanimated i Hermes
  # dystrybuują prebuiltowe .so w AAR-ach z Mavena, więc natywna kompilacja
  # C++ nie występuje. To oszczędza ~2 GB pobierania względem pełnego zestawu.
  sdk =
    (pkgs.androidenv.composeAndroidPackages {
      cmdLineToolsVersion = "latest";
      platformToolsVersion = "latest";
      platformVersions = ["35"];
      buildToolsVersions = ["35.0.0"];
      includeEmulator = false;
      includeCmake = false;
      includeNDK = false;
    }).androidsdk;
in {
  inherit sdk;

  env = {
    ANDROID_HOME = "${sdk}/libexec/android-sdk";
    ANDROID_SDK_ROOT = "${sdk}/libexec/android-sdk";
    JAVA_HOME = "${pkgs.jdk17}";
  };
}
