/// <reference lib="dom" />

import { browser } from "$app/environment";
import { PUBLIC_FILEPLAY_DOMAIN } from "$env/static/public";
import { writable } from "svelte/store";
import { ONLINE_STATUS_REFRESH_TIME } from "./common";

export const status = writable<"0" | "1" | "2">("0");
export const connectionMode = writable<string | null>();

class Messages {
  implementation?: "websockets" | "webpush";
  message: { [key: string]: ((data: any) => Promise<void> | void)[] } = {};
  notificationclick: {
    [key: string]: ((data: any) => Promise<void> | void)[];
  } = {};
  systemmessage: { [key: string]: ((data: any) => Promise<void> | void)[] } =
    {};
  wsinterval: any;

  constructor() {
    console.warn("Messages constructor has been called on the server side");
  }

  async init() {
    if (!browser) {
      throw new Error("Messages can only be used in the browser");
    }

    console.log("starting messages.ts init");
    status.set("0");

    if (this.wsinterval) clearInterval(this.wsinterval);

    if (!localStorage.getItem("loggedIn")) {
      console.log("not logged in, not initializing messages");
      status.set("0");
      return;
    }

    // broken on most browsers "serviceWorker" in navigator
    if (false) {
      const success: boolean = await new Promise((resolve) => {
        // @ts-ignore
        navigator.serviceWorker.onmessage = (msg) => {
          if (msg.data.type === "push_registered") {
            resolve(msg.data.data.success);
          } else {
            console.log("executing system message during init");
            this.systemmessage[msg.data.type]?.forEach(async (listener) => {
              await listener(msg.data.data);
            });
          }
        };
        setTimeout(() => {
          resolve(false);
        }, 7000); // timeout after 7 seconds and try websockets
        // @ts-ignore
        navigator.serviceWorker.ready.then((registration) => {
          registration.active?.postMessage({ type: "register_push" });
        });
      });
      if (success) {
        console.log("Webpush active");
        this.implementation = "webpush";
        // @ts-ignore
        navigator.serviceWorker.onmessage = async (msg) => {
          console.log("OnMessage: ", msg);
          switch (msg.data.class) {
            case "message":
              console.log("received message from service worker", msg.data);
              this.message[msg.data.type]?.forEach(async (listener) => {
                await listener(msg.data.data);
              });
              break;
            case "notificationclick":
              console.log(
                "received notificationclick from service worker",
                msg.data
              );
              this.notificationclick[msg.data.type]?.forEach(
                async (listener) => {
                  await listener(msg.data.data);
                }
              );
              break;
            default:
              console.log(
                "received system message from service worker",
                msg.data
              );
              this.systemmessage[msg.data.type]?.forEach(async (listener) => {
                await listener(msg.data.data);
              });
              break;
          }
        };
        status.set("1");
        connectionMode.set("WebPush");
        return;
      }
    }

    const keepalive = async () => {
      await fetch(
        `/api/keepalive?code=${localStorage.getItem("keepAliveCode")}`,
        {
          method: "GET",
        }
      ).then((res) => {
        if (!res.ok) {
          console.log("res for keepalive is not ok");
          status.set("2");
          if (res.status === 401) {
            console.log("got 401 from keepalive");
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("keepAliveCode");
            window.location.reload();
          }
        }
      });
    };
    // probe keepalive  for authentication
    await keepalive();
    const ws = new WebSocket(`wss://${PUBLIC_FILEPLAY_DOMAIN}/websocket`);
    // the websocket id in the database is set when calling /websocket
    ws.onmessage = (msg) => {
      console.log("received message from websocket", msg);
      this.dispatchMessage(JSON.parse(msg.data));
    };

    const wsres = await new Promise<boolean>((resolve) => {
      ws.onopen = () => {
        console.log("websocket opened");
        resolve(true);
      };
      ws.onerror = () => {
        console.log("error connecting to websocket");
        status.set("2");
        resolve(false);
      };
    });

    ws.onerror = (ev) => {
      console.log("error connecting to websocket");
      console.log(ev);
      status.set("2");
    };

    ws.onclose = (ev) => {
      console.log("websocket closed");
      console.log(ev);
      status.set("2");
    };

    if (wsres) {
      this.wsinterval = setInterval(keepalive, ONLINE_STATUS_REFRESH_TIME);
      console.log("keepalive started");
      status.set("1");
      connectionMode.set("WebSocket");
      return;
    }

    // error if not already returned
    status.set("2");
  }

  dispatchNotificationClick(data: any) {
    console.log("dispatching notificationclick", data);
    this.notificationclick[data.type]?.forEach(async (listener) => {
      await listener(data.data);
    });
  }

  dispatchMessage(data: any) {
    console.log("dispatching message", data);
    this.message[data.type]?.forEach(async (listener) => {
      await listener(data.data);
    });
  }

  onmessage(type: string, listener: (data: any) => Promise<void> | void) {
    if (!this.message[type]) {
      this.message[type] = [];
    }
    this.message[type].push(listener);
  }

  onnotificationclick(
    type: string,
    listener: (data: any) => Promise<void> | void
  ) {
    if (!this.notificationclick[type]) {
      this.notificationclick[type] = [];
    }
    this.notificationclick[type].push(listener);
  }

  onsystemmessage(type: string, listener: (data: any) => Promise<void> | void) {
    if (!this.systemmessage[type]) {
      this.systemmessage[type] = [];
    }
    this.systemmessage[type].push(listener);
  }
}

export const default_messages = new Messages();

default_messages.onsystemmessage("update_status", (data) => {
  status.set(data.status);
});

default_messages.onsystemmessage("retry_messages_init", () => {
  default_messages.init();
});
