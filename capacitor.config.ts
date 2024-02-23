import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "me.fileplay.app",
  appName: "Fileplay",
  webDir: "build-static",
  server: {
    androidScheme: "https",
    hostname: "fileplay.wir-sind-frey.de",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
