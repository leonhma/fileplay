/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { getDicebearUrl, ONLINE_STATUS_REFRESH_TIME } from "$lib/common";
import dayjs from "dayjs";
import Peer from "peerjs";
import {
  pageCache,
  imageCache,
  staticResourceCache,
  googleFontsCache,
} from "workbox-recipes";
import { generateKey } from "openpgp/lightweight";

pageCache();

googleFontsCache();

staticResourceCache();

imageCache();

declare let self: ServiceWorkerGlobalScope;

const broadcast = new BroadcastChannel("sw");

async function registerPushSubscription(): Promise<boolean> {
  if (Notification.permission !== "granted") return false;
  try {
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: ">PUBLIC_VAPID_KEY<",
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ pushSubscription: subscription }),
    });
    if (!res.ok) return false;

    console.log("Subscribed to push notifications");
    return true;
  } catch {
    return false;
  }
}

// handle messages from client
broadcast.addEventListener("message", async (event) => {
  if (event.data) {
    console.log("Message from client", event.data);
    switch (event.data.type) {
      // skip waiting to activate new service worker
      case "skip_waiting":
        self.skipWaiting();
        break;
      // register push notifications (called after setup, otherwise already initialized)
      case "register_push":
        registerPushSubscription().then((success) => {
          if (success) console.log("registered subscription");
          else console.log("Failed to register push notifications");
        });
        break;
      default:
        console.log("Unknown message type", event.data.type);
    }
  }
});

async function deleteNotifications(tag: string) {
  await self.registration.getNotifications({ tag }).then((notifications) => {
    notifications.forEach((notification) => notification.close());
  });
}

// handle push notifications
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    // todo handle single notifications
    switch (data.type) {
      case "sharing_request":
        console.log("displaying sharing request notification");
        self.registration.showNotification("Sharing request", {
          actions: [
            {
              title: "Accept",
              action: "send_share_accept",
            },
            {
              title: "Reject",
              action: "send_share_reject",
            },
          ],
          data,
          body: `${data.sender} wants to share files with you. Click to accept.`,
          icon: getDicebearUrl(data.avatarSeed, 192),
          tag: data.tag,
        });
        // delete notification on timeout
        setTimeout(async () => {
          await deleteNotifications(data.tag);
        }, dayjs.unix(data.expires).diff(dayjs(), "millisecond"));
        break;
      case "sharing_cancel":
        console.log("canceling own sharing notification");
        event.waitUntil(deleteNotifications(data.tag));
        break;
      case "share_accepted":
        console.log("got push other device accepted sharing request");
        // TODO forward to client
        break;
      case "share_rejected":
        console.log("got push other device rejected sharing request");
        // TODO forward to client
        break;
      default:
        // maybe foward all other messages to client
        console.log("Unknown notification type", data.type);
    }
  }
});

// handle push notification clicks
self.addEventListener("notificationclick", async (event) => {
  switch (event.action) {
    case "send_share_accept":
      console.log("Accepting sharing request...");
      // TODO forward to client, post to /share/accept

      break;
    case "send_share_reject":
      console.log("Rejecting sharing request...");
      await fetch("/api/share/answer", {
        method: "DELETE",
        body: JSON.stringify({
          sid: event.notification.data.sid,
        }),
      });
      break;
    default:
      console.log("Unknown notification action", event.action);
  }
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    // try to register push notifications
    registerPushSubscription().then((success) => {
      if (success) console.log("registered subscription");
      else console.log("Failed to register push notifications");
    })
  );
});

// TODO
// - handle web share target requests
// - handle file management
// - register push notifications                          DONE
// - send push notifications subscription to server       DONE
// - send keepalive requests to server                    DONE
// - handle push messages, show notifications             DONE
// - handle push notification clicks (accept, reject)     DONE
// - handle file sending
// - after files are received, show a notification if app is closed or in app list -> open in web share api
// - show in app notifications
