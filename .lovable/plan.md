## Проблема

Сборка падает на шаге установки Capacitor CLI / `cap add android` / `cap sync`. Симлинк `node_modules → .capacitor-tools/node_modules` — хрупкий: `cap` при запуске читает `package.json` проекта и лезет за зависимостями, которых там нет, либо `cap add android` не находит нужные плагины. Публичного доступа к логам приватного репо у меня нет, но паттерн сбоев указывает именно сюда — а мы делаем уже 4-ю попытку.

## Решение — убрать Capacitor из CI полностью

Идея: сгенерировать папку `android/` один раз локально (в песочнице), закоммитить её в репо. Тогда GitHub Actions делает только одно: копирует `www/` в `android/app/src/main/assets/public/` и запускает `./gradlew assembleDebug`. Без Node, без bun, без Capacitor CLI, без symlink-хаков.

Так как APK — это WebView-обёртка, которая грузит `https://gotti-stuff-sales-hub.lovable.app`, а `www/index.html` — статичный редирект в 20 строк, `cap sync` в CI не нужен вообще.

## Шаги

1. **Сгенерировать `android/` в песочнице**
   - `bun install` + `bunx cap add android` локально.
   - Убедиться, что `capacitor.config.ts` уже настроен (url на опубликованный сайт).
   - `bunx cap sync android` → скопирует `www/` и `capacitor.config.json` внутрь `android/`.

2. **Закоммитить папку `android/`** в репо (уберу её из `.gitignore`, если она там есть).

3. **Переписать `.github/workflows/android-build.yml`** — минимальный:
   ```text
   - checkout
   - setup-java 17
   - setup-android SDK 36 + build-tools 36
   - копируем www/ → android/app/src/main/assets/public/ (на случай изменений)
   - cd android && ./gradlew --no-daemon assembleDebug
   - переименовываем APK → gotti-stuff-latest.apk + gotti-stuff-<run>.apk
   - upload-artifact + release (tag latest + versioned) — как сейчас
   ```
   Убираю: setup-node, setup-bun, установку Capacitor, symlink, `cap add`, `cap sync`.

4. **Диагностика** — оставлю `Show build environment` (java, sdkmanager list) и добавлю `./gradlew assembleDebug --stacktrace`, чтобы при следующем падении в логе была точная строка.

5. **Обновить `MOBILE.md`** — упомянуть, что `android/` теперь коммитится, и для обновления обёртки надо локально запустить `bunx cap sync android` + закоммитить.

## Результат

После merge и зелёной сборки постоянная ссылка:
`https://github.com/alexgood11121-create/gotti-stuff-sales-hub/releases/download/latest/gotti-stuff-latest.apk`

## Что мне понадобится от тебя

Ничего. Всё делаю сам после аппрува. Единственное — если в будущем сменишь домен сайта или иконку, скажи, я перегенерирую `android/`.
