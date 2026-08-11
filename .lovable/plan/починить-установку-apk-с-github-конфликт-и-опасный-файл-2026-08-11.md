# Починить установку APK с GitHub (конфликт и «опасный файл»)

## Что происходит на самом деле

Это не ограничение на скачивание. Два разных сообщения Android:

1. «Приложение не установлено: конфликтует с существующим пакетом» — каждая сборка в GitHub Actions создаёт **новый временный ключ подписи** (debug keystore генерируется заново на runner'е). Android считает такие APK разными приложениями с одинаковым `com.gottistuff.pos` и отказывается ставить поверх старого.
2. «Опасный файл» — обычное предупреждение Chrome/Android для любого APK не из Play Store. Полностью убрать нельзя, но подписанный релизный APK с версионированием выглядит корректнее и ставится без сюрпризов.

## Что сделаем

1. **Постоянный ключ подписи**
   - Генерируем один keystore и храним его в GitHub Secrets (base64): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   - Workflow восстанавливает файл ключа перед сборкой и подписывает им APK.
   - Все будущие сборки — с той же подписью, обновление ставится поверх без удаления приложения.

2. **Релизная сборка вместо debug**
   - `./gradlew assembleRelease` с блоком `signingConfigs.release` в `android/app/build.gradle`, значения читаются из переменных окружения.
   - Если секретов нет — fallback на debug-сборку, чтобы workflow не падал.

3. **Автоувеличение версии**
   - `versionCode` = номер запуска workflow, `versionName` = `1.0.<run_number>`, чтобы Android видел обновление, а не конфликт.

4. **Инструкция в MOBILE.md**
   - Как создать keystore, как добавить 4 секрета в GitHub, как ставить APK поверх (и что при первом переходе со старой подписи придётся один раз удалить старое приложение).

## Важно

Один раз при переходе на новую подпись старое приложение нужно удалить с планшета — дальше все обновления будут ставиться поверх без ошибок.

## Технические детали

- `.github/workflows/android-build.yml`: шаг декодирования keystore, env-переменные подписи, `assembleRelease`, пути `app/build/outputs/apk/release/app-release.apk`, release-теги `latest` и `build-<run_number>` без изменений.
- `android/app/build.gradle`: `signingConfigs { release { ... } }`, привязка к `buildTypes.release`, `versionCode`/`versionName` из `System.getenv`.
