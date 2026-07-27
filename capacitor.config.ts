import type { CapacitorConfig } from "@capacitor/cli";

// APK грузит статические файлы из android/app/src/main/assets/public
// (собираются из папки www/ отдельным SPA-бандлом — см. vite.capacitor.config.ts).
// server.url НЕ указываем — иначе Capacitor открывает удалённый сайт и ничего не работает офлайн.
const config: CapacitorConfig = {
  appId: "com.gottistuff.pos",
  appName: "Gotti Stuff",
  webDir: "www",
  android: {
    allowMixedContent: false,
  },
};

export default config;
