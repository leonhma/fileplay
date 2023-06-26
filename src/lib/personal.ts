import { get, writable } from "svelte/store";

export interface IContact {
  cid: number;
  displayName: string;
  avatarSeed: string;
  linkedAt: number;
  isOnline: number;
}

export const contacts = writable<Promise<IContact[]>>();

export async function updateContacts(): Promise<void> {
  await fetch("/api/contacts", {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  }).then(async (res) => contacts.set(await res.json() as any))
}

export const devices = writable<{
  self: {
    did: number;
    type: string;
    displayName: string;
    createdAt: number;
    lastSeenAt: number;
  };
  others: {
    did: number;
    type: string;
    displayName: string;
    createdAt: number;
    lastSeenAt: number;
  }[];
}>();
export const devices_loaded = writable(false);

export async function getDevices(): Promise<{
  self: {
    did: number;
    type: string;
    displayName: string;
    createdAt: number;
    lastSeenAt: number;
  };
  others: {
    did: number;
    type: string;
    displayName: string;
    createdAt: number;
    lastSeenAt: number;
  }[];
}> {
  const res = await fetch("/api/devices", {
    method: "GET",
  });

  const devices_new = await res.json();

  devices.set(devices_new);
  if (!get(devices_loaded)) devices_loaded.set(true);

  return devices_new;
}

export const user = writable<
  Promise<{
    uid: number;
    displayName: string;
    avatarSeed: string;
    createdAt: number;
    lastSeenAt: number;
  }>
>();
export const user_loaded = writable(false);

export async function getUserInfo(): Promise<{
  uid: number;
  displayName: string;
  avatarSeed: string;
  createdAt: number;
  lastSeenAt: number;
}> {
  const res = await fetch("/api/user", {
    method: "GET",
  });

  const user_new = await res.json();

  user.set(user_new);
  if (!get(user_loaded)) user_loaded.set(true);

  return user_new;
}

export const deviceInfos = writable<
  Promise<
    {
      did: number;
      type: string;
      displayName: string;
      peerJsId: string;
      encryptionPublicKey: string;
    }[]
  >
>();
export const deviceInfos_loaded = writable(false);

export async function getDeviceInfos(): Promise<
  {
    did: number;
    type: string;
    displayName: string;
    peerJsId: string;
    encryptionPublicKey: string;
  }[]
> {
  const res = await fetch("/api/contacts/devices", {
    method: "GET",
  });

  const deviceInfos_new = await res.json();

  deviceInfos.set(deviceInfos_new);
  if (!get(deviceInfos_loaded)) deviceInfos_loaded.set(true);

  return deviceInfos_new;
}

export async function updatePeerJS_ID() {
  const sender_uuid = (await import("./peerjs")).sender_uuid;

  // await fetch("/api/devices", {
  //   method: "POST",
  //   body: JSON.stringify({
  //     peerJsId: get(sender_uuid),
  //   }),
  // });
}

export function getContent() {
  getUserInfo();
  updateContacts();
  getDevices();
}
