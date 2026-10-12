import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the built web app (dist/) as the Tended Android app. The native layer adds
 * OS-level alarms (local notifications) that ring on a locked phone; see docs/ANDROID.md.
 */
const config: CapacitorConfig = {
  appId: "app.tended.care",
  appName: "Tended",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_tended",
      iconColor: "#0B7A6E",
      sound: "tended_chime.wav",
    },
  },
};

export default config;
