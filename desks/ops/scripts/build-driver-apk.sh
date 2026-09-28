#!/usr/bin/env bash
# Build Silverleaf Driver APK (debug by default) and copy to public/downloads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-debug}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d "$HOME/.local/jdk/jdk-21.0.12+8" ]]; then
    export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12+8"
  elif [[ -d /usr/lib/jvm/java-21-openjdk-amd64 ]]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
  fi
fi
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT"
npx cap sync android

cd "$ROOT/android"
if [[ "$MODE" == "release" ]]; then
  ./gradlew assembleRelease
  SRC="$ROOT/android/app/build/outputs/apk/release/app-release-unsigned.apk"
else
  ./gradlew assembleDebug
  SRC="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
fi

mkdir -p "$ROOT/public/downloads"
cp -f "$SRC" "$ROOT/public/downloads/sl-driver.apk"
echo "APK ready: $ROOT/public/downloads/sl-driver.apk"
ls -lh "$ROOT/public/downloads/sl-driver.apk"
