import EventEmitter from "events";
import { get } from "svelte/store";
import type { TRPCError } from "@trpc/server";
import type { Observer } from "@trpc/server/observable";

import { connections, guests } from "./stores";

export const getEventEmitter = (did: number) => {
  if (did < 0) {
    if (get(guests)[Math.abs(did)] === undefined) {
      guests.update((guests) => {
        guests[Math.abs(did)] = new EventEmitter();
        return guests;
      });
    }
    return get(guests)[Math.abs(did)];
  } else {
    if (get(connections)[did] === undefined) {
      connections.update((connections) => {
        connections[did] = new EventEmitter();
        return connections;
      });
    }
    return get(connections)[did];
  }
};

export const getWebRTCData = async (
  emit: Observer<{ from: number; data: string }, TRPCError>,
  deviceID: number,
) => {
  const ee = getEventEmitter(deviceID);
  ee.removeAllListeners("webrtc-data");

  const data = async (from: number, data: string) => {
    emit.next({ from, data });
  };

  // Listener
  ee.on("webrtc-data", data);

  return async () => {
    ee.off("webrtc-data", data);
  };
};
