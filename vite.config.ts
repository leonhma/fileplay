import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import type { ConfigEnv, UserConfig } from "vite";
import { config } from "dotenv";
import EnvironmentPlugin from "vite-plugin-environment";
import { ONLINE_STATUS_REFRESH_TIME } from "./src/lib/common";
config();

export default async function (config: ConfigEnv): Promise<UserConfig> {
  return {
    define: {
      '">PUBLIC_VAPID_KEY<"': JSON.stringify(process.env.PUBLIC_VAPID_KEY),
      '">ONLINE_STATUS_REFRESH_TIME<"': JSON.stringify(
        ONLINE_STATUS_REFRESH_TIME
      ),
    },
    plugins: [
      EnvironmentPlugin(["NODE_ENV"]),
      sveltekit(),
      SvelteKitPWA({
        srcDir: "src",
        filename: "sw.ts",
        registerType: "prompt",
        strategies: "injectManifest",
        injectManifest: {
          injectionPoint: undefined,
        },
        useCredentials: true,
        devOptions: {
          enabled: false,
        },
        manifest: await import("./static/manifest.json"),
      }),
    ],
  };
}
