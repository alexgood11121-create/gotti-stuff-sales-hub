# Gotti Stuff — Android APK через Capacitor

Web-приложение упаковывается в нативный Android APK. Собирать APK нужно локально (в облаке нет Android SDK).

## Что нужно установить

1. **Node.js 20+** и **bun** (`curl -fsSL https://bun.sh/install | bash`).
2. **Android Studio** (последняя версия): https://developer.android.com/studio.
3. **JDK 17** — обычно ставится вместе с Android Studio.
4. При первом запуске Android Studio: SDK Manager → установить `Android SDK Platform 34+`, `Android SDK Build-Tools`, `Android SDK Platform-Tools`.

## Первая сборка

```bash
# 1. Экспортируй проект в GitHub (кнопка справа сверху в Lovable) и клонируй его.
git clone <твой репозиторий>
cd <папка-проекта>

# 2. Установи зависимости и собери веб-часть.
bun install
bun run build

# 3. Добавь Android-платформу (один раз).
bunx cap add android

# 4. Синхронизируй сборку в нативный проект.
bunx cap sync android

# 5. Открой Android Studio.
bunx cap open android
```

В Android Studio: `Build → Build Bundle(s) / APK(s) → Build APK(s)`. Готовый APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## После правок в веб-коде

```bash
bun run build
bunx cap sync android
```

Затем пересобери APK в Android Studio (или через `./gradlew assembleDebug` из папки `android/`).

## Публикация в Play Store

1. В Android Studio: `Build → Generate Signed Bundle / APK` → выбрать **Android App Bundle** → создать keystore и подписать.
2. Загрузить `.aab` в Google Play Console.

## Настройки, которые уже сделаны

- `capacitor.config.ts`: `appId=com.gottistuff.pos`, `appName=Gotti Stuff`, `webDir=dist/client`.
- Приложение работает офлайн (IndexedDB) и синхронизирует продажи при появлении интернета.

## Иконка и splash screen

Замени файлы в `android/app/src/main/res/mipmap-*/` (иконка) и `android/app/src/main/res/drawable*/splash.png` после `cap add android`. Или используй `@capacitor/assets`:

```bash
bun add -d @capacitor/assets
mkdir assets
# положи assets/icon.png (1024x1024) и assets/splash.png (2732x2732)
bunx capacitor-assets generate --android
```

## Что нужно от тебя, если понадобится настроить дополнительно

- Своя иконка (PNG 1024×1024) и splash (PNG 2732×2732).
- Ориентация экрана (только альбомная для планшета? По умолчанию — оба).
- Другой `appId`, если планируешь публиковать в Play Store под своим брендом.
