# Gotti Stuff — Android APK через GitHub Actions и Capacitor

Приложение собирается в Android APK автоматически через GitHub Actions. APK — это Android WebView-оболочка, которая открывает опубликованное приложение Gotti Stuff.

## Скачать APK

После успешной сборки APK всегда доступен здесь:

```text
https://github.com/alexgood11121-create/gotti-stuff-sales-hub/releases/latest
```

На странице Release скачай файл `gotti-stuff-latest.apk`.

## Установка и обновление (важно)

- APK теперь **подписан постоянным ключом** (`android/keystore/gotti-release.jks`), поэтому каждая новая сборка ставится **поверх** старой — ошибки «конфликтует с существующим пакетом» больше не будет.
- **Один раз** при переходе на новую подпись нужно удалить старое приложение Gotti Stuff с планшета/телефона, затем поставить новый APK. Дальше — просто обновление поверх.
- Chrome при скачивании APK всегда пишет «файл может быть опасным» — это стандартное предупреждение для файлов не из Play Store. Нажми «Всё равно скачать», затем разреши установку из этого источника.
- Версия приложения растёт автоматически: `versionCode` = номер сборки, `versionName` = `1.0.<номер сборки>`.

### Свой ключ подписи (необязательно)

Если хочешь подписывать своим ключом, добавь в GitHub → Settings → Secrets and variables → Actions:

- `ANDROID_KEYSTORE_BASE64` — `base64 -w0 my-release.jks`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Сборка автоматически подхватит их вместо ключа из репозитория. Учти: смена ключа снова потребует удалить приложение перед установкой.

## Как запустить сборку в GitHub

1. Открой репозиторий на GitHub.
2. Перейди во вкладку **Actions**.
3. Выбери **Android Build**.
4. Нажми **Run workflow** или **Re-run jobs**, если сборка уже запускалась.
5. Дождись зелёной галочки.
6. Скачай APK по ссылке выше.

## Как приложение работает

- Android-пакет: `com.gottistuff.pos`.
- Название: `Gotti Stuff`.
- Приложение работает офлайн: весь интерфейс и данные хранятся на устройстве.
- После входа продажи сохраняются локально и синхронизируются, когда интернет появляется снова.


## Локальная сборка, если понадобится

## Что нужно установить

1. **Node.js 22+** и **bun** (`curl -fsSL https://bun.sh/install | bash`).
2. **Android Studio** (последняя версия): https://developer.android.com/studio.
3. **JDK 17** — обычно ставится вместе с Android Studio.
4. При первом запуске Android Studio: SDK Manager → установить `Android SDK Platform 36`, `Android SDK Build-Tools`, `Android SDK Platform-Tools`.

## Первая сборка

```bash
# 1. Экспортируй проект в GitHub (кнопка справа сверху в Lovable) и клонируй его.
git clone <твой репозиторий>
cd <папка-проекта>

# 2. Установи зависимости.
bun install

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
bunx cap sync android
```

Затем пересобери APK в Android Studio (или через `./gradlew assembleDebug` из папки `android/`).

## Публикация в Play Store

1. В Android Studio: `Build → Generate Signed Bundle / APK` → выбрать **Android App Bundle** → создать keystore и подписать.
2. Загрузить `.aab` в Google Play Console.

## Настройки, которые уже сделаны

- `capacitor.config.ts`: `appId=com.gottistuff.pos`, `appName=Gotti Stuff`, `webDir=www`, сайт `https://gotti-stuff-sales-hub.lovable.app`.
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
