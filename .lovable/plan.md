План исправления APK-сборки:

1. **Сделать workflow более надёжным**
   - Убрать зависимость от полного `bun install --frozen-lockfile` для APK-сборки.
   - В GitHub Actions установить только нужные Capacitor-пакеты через публичный npm registry.
   - Оставить Node 22, Java 17 и Android SDK 36, потому что Capacitor 8 требует именно их.

2. **Собирать Android как оболочку приложения**
   - Использовать текущий `capacitor.config.ts`, где APK открывает опубликованный сайт:
     `https://gotti-stuff-sales-hub.lovable.app`
   - Проверить, что `www/index.html` остаётся fallback-страницей.

3. **Сделать файл для скачивания понятным**
   - После успешной сборки сохранять APK как:
     `gotti-stuff-latest.apk`
   - Загружать его в GitHub Actions Artifacts.
   - Публиковать его в GitHub Releases с постоянной ссылкой:
     `https://github.com/alexgood11121-create/gotti-stuff-sales-hub/releases/download/latest/gotti-stuff-latest.apk`

4. **Добавить диагностику, если снова упадёт**
   - В workflow вывести версии Node/Java/Android SDK/Capacitor.
   - Если Gradle упадёт, GitHub покажет точную ошибку в шаге `Build debug APK`, а не просто `exit code 1`.

После одобрения я внесу эти изменения в `.github/workflows/android-build.yml`. Потом тебе нужно будет нажать **Re-run jobs** или сделать новый push — и после зелёной сборки ссылка на APK станет рабочей.