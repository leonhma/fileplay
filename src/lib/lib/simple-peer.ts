import { page } from "$app/stores";
import { decode, encode } from "@msgpack/msgpack";
import SimplePeer, { WEBRTC_SUPPORT, type SignalData } from "simple-peer";
import { get, writable } from "svelte/store";
import type { MaybePromise } from "@sveltejs/kit";

import { concatArrays, type webRTCData } from "$lib/sharing/common";
import { handleData } from "$lib/sharing/main";
import { trpc } from "$lib/trpc/client";

import {
  decryptData,
  encryptData,
  publicKeyJwk,
  updateKey,
} from "./encryption";
import { numberToUint8Array, uint8ArrayToNumber } from "./utils";

const store = writable<Peer>();

export const peer = () => {
  let peerStore = get(store);
  if (peerStore === undefined) {
    peerStore = new Peer();
    store.set(peerStore);
    return peerStore;
  } else {
    return peerStore;
  }
};

class Peer {
  private connections: {
    data: SimplePeer.Instance | "establishing" | "websocket";
    events: EventTarget;
    key?: number; // key index
  }[];

  private keys: {
    data: CryptoKey; // ECDH PublicKey
    counter: number;
    id: 0 | 1; // Own key id
  }[];

  private buffer: Uint8Array[][];

  private fallback: boolean;

  private turn: MaybePromise<{ username: string; password: string }>;

  constructor() {
    this.connections = [];
    this.keys = [];
    this.buffer = [];
    this.fallback = !WEBRTC_SUPPORT;

    if (this.fallback) this.turn = { username: "", password: "" };
    else {
      this.turn =
        window.location.pathname.slice(0, 6) == "/guest"
          ? trpc().guest.getTurnCredentials.query()
          : trpc().authorized.getTurnCredentials.query();
    }
  }

  // WebRTC

  private async connect(
    did: number,
    initiator: boolean,
    events = new EventTarget(),
  ) {
    const establishWebSocket = () => {
      console.log("Establishing WebSocket connection");

      this.connections[did] = {
        data: "websocket",
        events,
      };

      this.sendMessage(
        did,
        {
          type: "update",
          key: publicKeyJwk,
          id: 0,
          initiator: true,
        },
        false,
        true,
      );

      if (this.buffer[did] !== undefined) {
        if (window.location.pathname.slice(0, 6) == "/guest") {
          this.buffer[did].forEach((buffered) => {
            trpc().guest.shareWebRTCData.query({
              did,
              guestTransfer: String(get(page).url.searchParams.get("id")),
              data: { type: "webrtc", data: buffered },
            });
          });
        } else {
          this.buffer[did].forEach((buffered) => {
            trpc().authorized.shareWebRTCData.query({
              did,
              data: { type: "webrtc", data: buffered },
            });
          });
        }
      }
    };

    if (this.fallback === true) establishWebSocket();
    else {
      console.log("Establishing WebRTC connection");

      this.connections[did] = {
        data: "establishing",
        events,
      };

      const peer = new SimplePeer({
        initiator,
        trickle: true,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19305" },
            {
              urls: "turns:turn.wir-sind-frey.de:443",
              username: (await this.turn).username,
              credential: (await this.turn).password,
            },
            {
              urls: "turn:turn.wir-sind-frey.de:5349?transport=tcp",
              username: (await this.turn).username,
              credential: (await this.turn).password,
            },
          ],
        },
      });

      console.log(await this.turn);

      peer.on("signal", (data) => {
        if (window.location.pathname.slice(0, 6) == "/guest")
          trpc().guest.shareWebRTCData.query({
            did,
            guestTransfer: String(get(page).url.searchParams.get("id")),
            data: { type: "signal", data: JSON.stringify(data) },
          });
        else
          trpc().authorized.shareWebRTCData.query({
            did,
            data: { type: "signal", data: JSON.stringify(data) },
          });
      });

      if (initiator) {
        peer.on("connect", () => {
          this.sendMessage(
            did,
            {
              type: "update",
              key: publicKeyJwk,
              id: 0,
              initiator: true,
            },
            false,
            true,
          );
        });
      }

      peer.on("data", async (data) => {
        this.handle(did, data);
      });

      const deletePeer = (err?: Error) => {
        if (!peer.destroyed) peer.destroy();

        if (err !== undefined) {
          console.warn(err);

          if (
            err.message != "User-Initiated Abort, reason=Close called" &&
            this.connections[did] !== undefined
          )
            establishWebSocket();
        } else {
          delete this.connections[did];
        }
      };

      peer.on("close", deletePeer);
      peer.on("error", (err) => deletePeer(err));

      this.connections[did].data = peer;

      return peer;
    }
  }

  closeConnections() {
    this.connections.forEach((conn) => {
      if (
        conn.data !== undefined &&
        conn.data !== "websocket" &&
        conn.data !== "establishing"
      )
        conn.data.destroy();
    });
    this.buffer = [];
    this.connections = [];
  }

  private sendMessages(did: number) {
    if (this.buffer[did] === undefined || this.buffer[did].length <= 0) return;

    const peer = this.connections[did];

    if (peer === undefined) {
      this.connect(did, true);
    } else if (
      peer.data !== undefined &&
      peer.data !== "websocket" &&
      peer.data !== "establishing"
    ) {
      peer.data.write(this.buffer[did][0], undefined, () =>
        this.sendMessages(did),
      );

      this.buffer = this.buffer.slice(1);
    }
  }

  async sendMessage(
    did: number,
    data: webRTCData,
    encrypt = true,
    immediately = false,
  ) {
    console.log("Sending message to " + did);

    const sendOverTrpc = (data: Uint8Array) => {
      if (window.location.pathname.slice(0, 6) == "/guest") {
        trpc().guest.shareWebRTCData.query({
          did,
          guestTransfer: String(get(page).url.searchParams.get("id")),
          data: { type: "webrtc", data },
        });
      } else {
        trpc().authorized.shareWebRTCData.query({
          did,
          data: { type: "webrtc", data },
        });
      }
    };

    const addToBuffer = (chunk: Uint8Array) => {
      if (this.buffer[did] === undefined) this.buffer[did] = [];
      if (immediately) {
        this.buffer[did].unshift(chunk);
      } else {
        this.buffer[did].push(chunk);
      }
    };

    const peer = this.connections[did];

    if (peer === undefined || (encrypt && peer.key === undefined)) {
      const events = peer === undefined ? new EventTarget() : peer.events;

      if (encrypt) {
        const send = async () => {
          events.removeEventListener("encrypted", send);

          const chunk = concatArrays([
            numberToUint8Array(1, 1),
            await encryptData(encode(data), did),
          ]);

          if (
            this.fallback ||
            (peer !== undefined && peer.data == "websocket")
          ) {
            sendOverTrpc(chunk);
          } else {
            addToBuffer(chunk);
            this.sendMessages(did);
          }
        };

        events.addEventListener("encrypted", send);
        if (peer === undefined) this.connect(did, true, events);
      } else {
        const chunk = concatArrays([numberToUint8Array(0, 1), encode(data)]);
        if (this.fallback || (peer !== undefined && peer.data == "websocket")) {
          if (peer === undefined) this.connect(did, true, events);
          sendOverTrpc(chunk);
        } else {
          addToBuffer(chunk);
          if (peer === undefined) this.connect(did, true, events);
        }
      }
    } else {
      let chunk: Uint8Array;
      if (encrypt) {
        chunk = concatArrays([
          numberToUint8Array(1, 1),
          await encryptData(encode(data), did),
        ]);
      } else {
        chunk = concatArrays([numberToUint8Array(0, 1), encode(data)]);
      }

      if (this.fallback || (peer !== undefined && peer.data == "websocket")) {
        sendOverTrpc(chunk);
      } else {
        addToBuffer(chunk);

        if (this.buffer[did].length === 1) {
          this.sendMessages(did);
        }
      }
    }
  }

  async signal(did: number, data: SignalData) {
    const peer = this.connections[did];

    if (
      peer !== undefined &&
      peer.data !== undefined &&
      peer.data !== "websocket" &&
      peer.data !== "establishing"
    ) {
      peer.data.signal(data);
    } else if (peer === undefined) {
      // todo (maybe wrap instance in promise)
      (await this.connect(did, false))?.signal(data);
    }
  }

  clearBuffer(did?: number) {
    if (did === undefined) this.buffer = [];
    else this.buffer[did] = [];
  }

  // Encryption

  async handle(did: number, data: Uint8Array) {
    console.log(data, typeof data);

    const handleDecoded = async (data: webRTCData) => {
      if (data.type == "update") {
        if (this.connections[did] === undefined) this.connect(did, false);
        const id = await updateKey(did, data.key, data.id === 0 ? 1 : 0);
        if (data.initiator) {
          this.sendMessage(
            did,
            { type: "update", key: publicKeyJwk, id },
            false,
            true,
          );
        }
      } else {
        handleData(data, did);
      }
    };

    if (uint8ArrayToNumber(data.slice(0, 1)) === 1) {
      const conn = this.connections[did];
      if (conn === undefined) return;

      if (conn.key !== undefined) {
        handleDecoded(
          decode(await decryptData(data.slice(1), did)) as webRTCData,
        );
      } else {
        const decrypt = async () => {
          handleDecoded(
            decode(await decryptData(data.slice(1), did)) as webRTCData,
          );
          conn.events.removeEventListener("encrypted", decrypt);
        };

        conn.events.addEventListener("encrypted", decrypt);
      }
    } else {
      handleDecoded(decode(data.slice(1)) as webRTCData);
    }
  }

  getKey(did: number) {
    const peer = this.connections[did];

    if (peer !== undefined && peer.key !== undefined) {
      const key = this.keys[peer.key];
      return { data: key.data, id: key.id };
    } else {
      throw new Error("Encryption: No encrypted connection to this device");
    }
  }

  setKey(did: number, key: CryptoKey, id: 0 | 1) {
    const peer = this.connections[did];

    if (peer !== undefined) {
      let index = this.keys.findIndex((k) => k.data == key);

      if (index === -1) {
        index = this.keys.push({ data: key, counter: 0, id }) - 1;
      }

      this.connections[did].key = index;

      peer.events.dispatchEvent(new Event("encrypted"));
      return this.keys[index].id;
    } else {
      throw new Error("Encryption: No connection to this device");
    }
  }

  private sendKey(did: number) {}

  increaseCounter(did: number) {
    const peer = this.connections[did];

    if (peer !== undefined && peer.key !== undefined) {
      return ++this.keys[peer.key].counter;
    } else {
      throw new Error("Encryption: No encrypted connection to this device");
    }
  }

  getId(did: number) {
    const peer = this.connections[did];

    if (peer !== undefined && peer.key !== undefined) {
      return this.keys[peer.key].id;
    } else {
      throw new Error("Encryption: No encrypted connection to this device");
    }
  }
}
