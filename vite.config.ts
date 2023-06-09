import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import type { ConfigEnv, UserConfig } from "vite";
import { config } from "dotenv";
import { ONLINE_STATUS_REFRESH_TIME, SHARING_TIMEOUT } from "./src/lib/common";
import EnvironmentPlugin from "vite-plugin-environment";

config();

export default async function (config: ConfigEnv): Promise<UserConfig> {
  return {
    define: {
      "\">PUBLIC_VAPID_KEY<\"": JSON.stringify(process.env.PUBLIC_VAPID_KEY),
      ">ONLINE_STATUS_REFRESH_TIME<": JSON.stringify(ONLINE_STATUS_REFRESH_TIME),
      ">SHARING_TIMEOUT<": JSON.stringify(SHARING_TIMEOUT),
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
