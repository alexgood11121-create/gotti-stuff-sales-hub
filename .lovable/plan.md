Да, теперь вижу репозиторий: `alexgood11121-create/gotti-stuff-sales-hub`.

План исправления:

1. **Исправлю Android workflow**
   - Сделаю сборку стабильной для GitHub Actions.
   - Добавлю правильную подготовку Node/Bun, Java и Android SDK.
   - Уберу слабые места, из-за которых APK может не собираться на чистом GitHub runner.

2. **Сделаю APK как WebView-приложение Gotti Stuff**
   - Приложение будет открывать опубликованный сайт:
     `https://gotti-stuff-sales-hub.lovable.app`
   - Название APK останется `Gotti Stuff`.
   - Пакет Android: `com.gottistuff.pos`.

3. **Сделаю выдачу APK через GitHub Releases**
   - После успешной сборки GitHub автоматически создаст Release.
   - APK будет прикреплён к релизу как файл.

4. **Рабочая ссылка на APK**
   После исправления и нового запуска Actions ссылка будет:

   `https://github.com/alexgood11121-create/gotti-stuff-sales-hub/releases/latest`

5. **После твоего подтверждения**
   - Я внесу правки.
   - Потом тебе нужно будет дождаться синхронизации Lovable → GitHub и нажать **Re-run jobs** или **Run workflow** в GitHub Actions.
   - Если сборка пройдёт зелёной, APK появится по ссылке выше.