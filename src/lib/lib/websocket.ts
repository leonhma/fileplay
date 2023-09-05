import { get, writable } from "svelte/store";
import { PUBLIC_FILEPLAY_DOMAIN } from "$env/static/public";
import { ONLINE_STATUS_REFRESH_TIME } from "./common";

const createWebSocketListeners = () => {
  socketStore.update((websocket) => {
    websocket.onopen = () => {
      websocket.send("isOnline");
    };
    websocket.onclose = () => {
      status.set("0");
      websocketCounter.update((counter) => (counter = counter + 1));
      if (get(websocketCounter) < 3) {
        console.log("WebSocket connection closed, retrying in 5 seconds.");
        setTimeout(() => {
          socketStore.set(createWebSocket());
        }, 5000);
      } else {
        clearInterval(get(interval));
        console.log("WebSocket connection closed.");
      }
    };
    websocket.onmessage = (event) => {
      if (event.data == "1" || event.data == "2") {
        status.set(event.data);
      } else {
        console.log(event.data);
      }
    };
    return websocket;
  });
};

const createWebSocket = () => {
  const websocket = new WebSocket(`wss://${PUBLIC_FILEPLAY_DOMAIN}/websocket`);
  createWebSocketListeners();

  return websocket;
};

const createInterval = () => {
  interval.set(
    setInterval(() => {
      if (
        get(socketStore).readyState == 3 ||
        get(socketStore).readyState == 2
      ) {
        socketStore.set(createWebSocket());
      } else {
        socketStore.update((websocket) => {
          websocket.send("ping");
          return websocket;
        });
      }
    }, ONLINE_STATUS_REFRESH_TIME * 1000),
  );
};

const createSocketStore = () => {
  createInterval();
  return createWebSocket();
};

const websocketCounter = writable(0);
const interval = writable<NodeJS.Timeout>();

export const socketStore = writable<WebSocket>(createSocketStore());
export const status = writable<"0" | "1" | "2">("0");
