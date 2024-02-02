import type { EventEmitter } from "events";
import { writable } from "svelte/store";

// Main
export const timers = writable<NodeJS.Timeout[]>([]);

// Guest
export const guestSecret = writable<CryptoKey>(); // changed on every restart
export const filetransfers = writable<{ id: string; did: number }[]>([]);
