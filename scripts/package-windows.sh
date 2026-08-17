#!/usr/bin/env bash
# Cross-compile a portable Swordfish Windows x64 zip from Linux or Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TOOLS="${SWORDFISH_TOOLS:-$ROOT/.tools}"
mkdir -p "$TOOLS"

VERSION="$(node -p "require('./package.json').version")"
APP_NAME="Swordfish"
OUT_DIR="$ROOT/release-win"
STAGE="$OUT_DIR/${APP_NAME}-${VERSION}-win32-x64"
APP_DIR="$STAGE/resources/app"
JDK_VERSION="${SWORDFISH_JDK_VERSION:-25.0.4}"
JDK_BUILD="${SWORDFISH_JDK_BUILD:-7}"
ADOPTIUM_TAG="jdk-${JDK_VERSION}%2B${JDK_BUILD}"

log() { printf '==> %s\n' "$*"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

download() {
    local url="$1"
    local dest="$2"
    if [[ -f "$dest" ]]; then
        return 0
    fi
    log "Downloading $(basename "$dest")"
    curl -L --retry 4 --retry-delay 4 --fail -o "$dest.partial" "$url"
    mv "$dest.partial" "$dest"
}

ensure_host_jdk() {
    if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/javac" && -x "${JAVA_HOME}/bin/jlink" ]]; then
        local ver
        ver="$("${JAVA_HOME}/bin/java" -version 2>&1 | head -n 1 || true)"
        if [[ "$ver" == *'"25'* ]]; then
            return 0
        fi
    fi
    if need_cmd java && need_cmd javac && need_cmd jlink; then
        local ver
        ver="$(java -version 2>&1 | head -n 1 || true)"
        if [[ "$ver" == *'"25'* ]]; then
            export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")}"
            return 0
        fi
    fi
    local tarball="$TOOLS/OpenJDK25U-jdk_x64_linux_hotspot_${JDK_VERSION}_${JDK_BUILD}.tar.gz"
    local home="$TOOLS/jdk-25-linux"
    if [[ ! -x "$home/bin/javac" ]]; then
        download "https://github.com/adoptium/temurin25-binaries/releases/download/${ADOPTIUM_TAG}/OpenJDK25U-jdk_x64_linux_hotspot_${JDK_VERSION}_${JDK_BUILD}.tar.gz" "$tarball"
        rm -rf "$home"
        mkdir -p "$home"
        tar -xzf "$tarball" -C "$home" --strip-components=1
    fi
    export JAVA_HOME="$home"
}

ensure_windows_jmods() {
    if [[ -n "${WINDOWS_JMODS:-}" && -f "${WINDOWS_JMODS}/java.base.jmod" ]]; then
        return 0
    fi
    if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
        if [[ -d "${JAVA_HOME}/jmods" && -f "${JAVA_HOME}/jmods/java.base.jmod" ]]; then
            WINDOWS_JMODS="${JAVA_HOME}/jmods"
            return 0
        fi
    fi
    local zip="$TOOLS/OpenJDK25U-jmods_x64_windows_hotspot_${JDK_VERSION}_${JDK_BUILD}.zip"
    local dest="$TOOLS/jdk-25-windows-jmods/jmods"
    if [[ ! -f "$dest/java.base.jmod" ]]; then
        download "https://github.com/adoptium/temurin25-binaries/releases/download/${ADOPTIUM_TAG}/OpenJDK25U-jmods_x64_windows_hotspot_${JDK_VERSION}_${JDK_BUILD}.zip" "$zip"
        rm -rf "$TOOLS/jdk-25-windows-jmods"
        mkdir -p "$TOOLS/jmods-extract"
        unzip -q -o "$zip" -d "$TOOLS/jmods-extract"
        mkdir -p "$dest"
        find "$TOOLS/jmods-extract" -name '*.jmod' -exec mv {} "$dest/" \;
        rm -rf "$TOOLS/jmods-extract"
    fi
    WINDOWS_JMODS="$dest"
}

ensure_gradle() {
    if need_cmd gradle; then
        GRADLE_CMD="gradle"
        return 0
    fi
    local zip="$TOOLS/gradle-9.5.1-bin.zip"
    local home="$TOOLS/gradle-9.5.1"
    if [[ ! -x "$home/bin/gradle" ]]; then
        download "https://services.gradle.org/distributions/gradle-9.5.1-bin.zip" "$zip"
        rm -rf "$home"
        unzip -q -o "$zip" -d "$TOOLS"
    fi
    GRADLE_CMD="$home/bin/gradle"
}

ensure_host_jdk
export PATH="${JAVA_HOME}/bin:${PATH}"
ensure_windows_jmods
ensure_gradle

log "Host Java: $("${JAVA_HOME}/bin/java" -version 2>&1 | head -n 1)"
log "Windows jmods: ${WINDOWS_JMODS}"

log "Building Windows Java runtime"
"$GRADLE_CMD" --no-daemon windowsRuntime "-PwindowsJmods=${WINDOWS_JMODS}"

if [[ ! -f "$ROOT/dist-win/bin/java.exe" ]]; then
    echo "dist-win/bin/java.exe was not created" >&2
    exit 1
fi

log "Installing npm dependencies"
if [[ -f package-lock.json ]]; then
    npm ci
else
    npm install
fi

log "Compiling TypeScript"
npm run build

ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
ELECTRON_ZIP="$TOOLS/electron-v${ELECTRON_VERSION}-win32-x64.zip"
download "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-win32-x64.zip" "$ELECTRON_ZIP"

log "Assembling ${APP_NAME} ${VERSION} Windows tree"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
unzip -q -o "$ELECTRON_ZIP" -d "$STAGE"
rm -f "$STAGE/resources/default_app.asar"
mv "$STAGE/electron.exe" "$STAGE/${APP_NAME}.exe"
mkdir -p "$APP_DIR"

copy_tree() {
    local src="$1"
    local dest="$2"
    mkdir -p "$dest"
    cp -a "$src/." "$dest/"
}

copy_tree "$ROOT/js" "$APP_DIR/js"
copy_tree "$ROOT/html" "$APP_DIR/html"
copy_tree "$ROOT/css" "$APP_DIR/css"
copy_tree "$ROOT/images" "$APP_DIR/images"
copy_tree "$ROOT/fonts" "$APP_DIR/fonts"
copy_tree "$ROOT/catalog" "$APP_DIR/catalog"
copy_tree "$ROOT/srx" "$APP_DIR/srx"
copy_tree "$ROOT/xmlfilter" "$APP_DIR/xmlfilter"
copy_tree "$ROOT/models" "$APP_DIR/models"
copy_tree "$ROOT/review" "$APP_DIR/review"
copy_tree "$ROOT/licenses" "$APP_DIR/licenses"
copy_tree "$ROOT/dist-win/bin" "$APP_DIR/bin"
copy_tree "$ROOT/dist-win/lib" "$APP_DIR/lib"
copy_tree "$ROOT/dist-win/conf" "$APP_DIR/conf"
copy_tree "$ROOT/dist-win/include" "$APP_DIR/include"
copy_tree "$ROOT/dist-win/legal" "$APP_DIR/legal"
cp "$ROOT/package.json" "$APP_DIR/package.json"
cp "$ROOT/package-lock.json" "$APP_DIR/package-lock.json"
cp "$ROOT/LICENSE" "$APP_DIR/LICENSE"
cp "$ROOT/swordfish_en.pdf" "$APP_DIR/swordfish_en.pdf"
cp "$ROOT/scripts/windows-readme.txt" "$STAGE/README.txt"
cp "$ROOT/scripts/windows-readme.txt" "$STAGE/使用说明.txt"

log "Installing production Node modules into the app"
(cd "$APP_DIR" && npm ci --omit=dev)

log "Stamping ${APP_NAME}.exe"
node "$ROOT/scripts/stamp-exe.mjs" \
    --exe "$STAGE/${APP_NAME}.exe" \
    --png "$ROOT/images/icon.png" \
    --version "$VERSION" \
    --name "$APP_NAME" \
    --description "Swordfish Translation Editor"

ZIP_PATH="$OUT_DIR/${APP_NAME}-${VERSION}-win32-x64.zip"
log "Creating $ZIP_PATH"
(
    cd "$OUT_DIR"
    zip -r -q "$(basename "$ZIP_PATH")" "$(basename "$STAGE")"
)

log "Windows package ready"
ls -lh "$ZIP_PATH"
ls -lh "$STAGE/${APP_NAME}.exe" "$APP_DIR/bin/java.exe"
