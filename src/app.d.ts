// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env?: {
        COOKIE_SIGNING_SECRET: string;
        COTURN_AUTH_SECRET: string;
        PRIVATE_VAPID_KEY: string;
        PUBLIC_VAPID_KEY: string;
        GCM_KEY: string;
        WS_PORT: string;
      };
    }
  }
}

export {};
