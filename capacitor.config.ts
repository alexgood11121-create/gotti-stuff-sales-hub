import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gottistuff.pos",
  appName: "Gotti Stuff",
  webDir: "www",
  server: {
    url: "https://gotti-stuff-sales-hub.lovable.app",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
