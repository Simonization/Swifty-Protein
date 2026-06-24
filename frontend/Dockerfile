# =============================================================================
# Swifty-Proteins — React Native Android APK factory (HEAVY build image)
#
# This image contains JDK + Node + the Android SDK & build-tools so the APK can
# be built HEADLESS, with zero toolchain on the host. It is NOT for running the
# app — it produces dist/app-release.apk, which the jury installs on a device.
#
# Versions are PINNED on purpose: the goal is a byte-reproducible-ish build that
# still works in ~2 years. Bump deliberately, not by accident.
# =============================================================================

# JDK 17 is the sweet spot for current React Native / Gradle.
FROM eclipse-temurin:17-jdk-jammy

# ---- pinned versions -------------------------------------------------------
ARG NODE_MAJOR=20
ARG ANDROID_CMDLINE_TOOLS=11076708          # "Command line tools only" build number
ARG ANDROID_PLATFORM=android-34
ARG ANDROID_BUILD_TOOLS=34.0.0
# NDK is only needed if a native module (some 3D libs) requires it. Off by default
# to keep the image smaller; set to a version string to install.
ARG ANDROID_NDK=""

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    ANDROID_HOME=/opt/android-sdk \
    GRADLE_USER_HOME=/opt/gradle-cache

# ---- base OS deps + Node ---------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl unzip git ca-certificates \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Android command-line tools -------------------------------------------
RUN mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools" \
    && curl -fsSL -o /tmp/cmdline.zip \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip" \
    && unzip -q /tmp/cmdline.zip -d "${ANDROID_SDK_ROOT}/cmdline-tools" \
    && mv "${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools" "${ANDROID_SDK_ROOT}/cmdline-tools/latest" \
    && rm /tmp/cmdline.zip

ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools"

# ---- accept licenses + install SDK packages -------------------------------
RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager \
        "platform-tools" \
        "platforms;${ANDROID_PLATFORM}" \
        "build-tools;${ANDROID_BUILD_TOOLS}" >/dev/null \
    && if [ -n "${ANDROID_NDK}" ]; then sdkmanager "ndk;${ANDROID_NDK}" >/dev/null; fi

WORKDIR /app

# ---- dependency layer (cached unless package*.json changes) ----------------
# These COPYs assume Rodolfo's RN app lives in this frontend/ folder.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else echo ">> no package-lock yet — skipping (scaffold the RN app first)"; fi

# ---- app source ------------------------------------------------------------
COPY . .

# Build the signed release APK. For a school project a debug/self-signed key is
# fine; configure signing in android/app/build.gradle. Output is copied to
# /app/dist by the Makefile/compose volume mount.
CMD ["sh", "-c", "cd android && ./gradlew assembleRelease && mkdir -p /app/dist && cp app/build/outputs/apk/release/*.apk /app/dist/app-release.apk && echo '>> APK at dist/app-release.apk'"]
