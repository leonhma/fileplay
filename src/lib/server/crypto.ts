import { error, type Cookies } from "@sveltejs/kit";
import { arrayBufferToHex, hexToArrayBuffer } from "./utils";

export async function saveSignedDeviceID(
  did: number,
  cookies: Cookies,
  key: CryptoKey
): Promise<void> {
  const id = did.toString();
  const signature = await sign(id, key);
  cookies.set("id", id);
  cookies.set("id_sig", signature);
}

export async function loadSignedDeviceID(
  cookies: Cookies,
  key: CryptoKey
): Promise<number> {
  const did = cookies.get("id");
  const signature = cookies.get("id_sig");
  if (!did || !signature) throw error(401, "Not authenticated");
  if (!(await verify(did, signature, key))) throw error(401, "Wrong authentication signature");
  return parseInt(did);
}

export async function sign(data: string, key: CryptoKey): Promise<string> {
  const dataBuffer = new TextEncoder().encode(data);
  return arrayBufferToHex(await crypto.subtle.sign("HMAC", key, dataBuffer));
}

export async function verify(
  data: string,
  signature: string,
  key: CryptoKey
): Promise<boolean> {
  const dataBuffer = new TextEncoder().encode(data);
  const signatureBuffer = hexToArrayBuffer(signature);
  return crypto.subtle.verify("HMAC", key, signatureBuffer, dataBuffer);
}

export async function loadKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
}
