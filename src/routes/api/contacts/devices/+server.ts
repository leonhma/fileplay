import { COOKIE_SIGNING_SECRET } from "$env/static/private";
import { loadKey, loadSignedDeviceID } from "$lib/server/crypto";
import { createKysely } from "$lib/server/db";
import { json } from "@sveltejs/kit";
import dayjs from "dayjs";
import type { RequestHandler } from "./$types";
import { sql } from "kysely";

export const GET: RequestHandler = async ({ cookies, platform }) => {
  // get all devices linked to this account (requires cookie auth)
  const db = createKysely(platform);
  const key = await loadKey(COOKIE_SIGNING_SECRET);
  const { uid } = await loadSignedDeviceID(cookies, key, db);

  try {
    const devices = await sql<{
      cid: number;
      type: string;
      displayName: string;
      peerJsId: string;
      encryptionPublicKey: string;
    }[]>`SELECT "cid", "devices"."type", "devices"."displayName", "devices"."peerJsId", "devices"."encryptionPublicKey" FROM (SELECT "contacts"."cid", "users"."uid" FROM "contacts" INNER JOIN "users" ON "users"."uid" = "contacts"."a" WHERE "contacts"."b" = ${uid} UNION SELECT "contacts"."cid", "users"."uid" FROM "contacts" INNER JOIN "users" ON "users"."uid" = "contacts"."b" WHERE "contacts"."a" = ${uid}) AS U INNER JOIN "devices" ON "U".uid = "devices"."uid" WHERE "devices"."isOnline" = 1 AND "devices"."lastSeenAt" > ${dayjs().unix() - 30} ORDER BY "devices"."displayName"`.execute(db);

    console.log(devices);

    return json(devices, { status: 200 });
  } catch (e: any) {
    console.log(e);

    return new Response(e, { status: 500 });
  }
};