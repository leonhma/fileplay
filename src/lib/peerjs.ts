import { nanoid } from "nanoid";
import type { DataConnection } from "peerjs";
import Peer from "peerjs";
import { get, writable } from "svelte/store";
import { page } from "$app/stores";
import { notifications } from "./stores/Dialogs";
import {
  decryptFiles,
  decryptFilesWithPassword,
  encryptFiles,
  encryptFilesWithPassword,
} from "./openpgp";
import { updatePeerJS_ID } from "./personal";

let peer: Peer;
export const sender_uuid = writable<string>();

let connections: DataConnection[] = [];

let pending_files: { listen_key: string; files: FileList }[] = [];
export const link = writable("");

export const received_files = writable<{ url: string; name: string }[]>([]);

const openPeer = (uuid?: string) => {
  if (uuid) {
    peer = new Peer(uuid);
  } else peer = new Peer();

  peer.on("open", (id) => {
    sender_uuid.set(id);

    if (localStorage.getItem("loggedIn")) {
      updatePeerJS_ID();
    }
  });
};

export const disconnectPeer = () => {
  peer.disconnect();
};

const listen = () => {
  peer.on("connection", (conn) => {
    connections.push(conn);

    conn.on("data", function (received_data) {
      handleData(received_data, conn);
    });
  });
};

let fileSizes: {uuid: string, fileSizes: number[]}[];

const handleData = (data: any, conn: DataConnection) => {
  if (data.listen_key) {
    let pending: { listen_key: string; files: FileList };
    for (pending of pending_files) {
      if (pending.listen_key == data.listen_key) {
        send(pending.files, conn.peer, pending.listen_key);

        let notification;
        if (pending.files.length == 1) {
          notification = {
            title: "File downloaded",
            content: `The file "${
              Array.from(pending.files)[0].name
            }" was received.`,
          };
        } else {
          notification = {
            title: "Files downloaded",
            content: `The files "${
              Array.from(pending.files)[0].name
            }", ... were received.`,
          };
        }

        notifications.set([...get(notifications), notification]);
        pending_files.splice(pending_files.indexOf(pending), 1);
      }
    }
  } else if (data.fileSizes) {
    fileSizes.push(data.fileSizes);
    // } else if (Array.isArray(data.file) && Array.isArray(data.filename)) {
    //   let decrypted_files;
    //   if (data.encrypted == "publicKey") {
    //     decrypted_files = decryptFiles(data.file);
    //   } else {
    //     decrypted_files = decryptFilesWithPassword(
    //       data.file,
    //       get(page).params.listen_key
    //     );
    //   }
    //   decrypted_files.then((decrypted_files) => {
    //     for (let i = 0; i < decrypted_files.length; i++) {
    //       let url = createFileURL(decrypted_files[i]);
    //       let info = {
    //         url: url,
    //         name: data.filename[i],
    //       };
    //       received_files.set([...get(received_files), info]);
    //     }
    //   });
  }else if(data.file) {

  }
};

const createFileURL = (file: any) => {
  var blob = new Blob([file]);
  var url = URL.createObjectURL(blob);
  return url;
};

export const addPendingFile = (files: FileList) => {
  let listen_key = nanoid(16);
  let pending = {
    listen_key: listen_key,
    files: files,
  };
  pending_files.push(pending);

  link.set(
    "http://" +
      location.hostname +
      ":" +
      location.port +
      "/guest/" +
      get(sender_uuid) +
      "/key/" +
      listen_key
  );
};

export const connectAsListener = (
  reciever_uuid: string,
  listen_key: string
) => {
  peer.on("open", (id) => {
    let conn = peer.connect(reciever_uuid);

    conn.on("open", function () {
      conn.send({
        listen_key: listen_key,
      });
    });

    conn.on("data", function (received_data) {
      handleData(received_data, conn);
    });

    connections.push(conn);
  });
};

export function connected(reciever_uuid: string): DataConnection | false {
  let conn: DataConnection;
  for (conn of connections) {
    if (conn.peer == reciever_uuid) return conn;
  }

  return false;
}

/**
 * Send files to a peer. Either a password or a public key has to be defined.
 * @param files FileList to send
 * @param peerID The id of the peer to send the files to
 * @param password a password to encrypt the files with (optional)
 * @param publicKey a public key to encrypt the files with (optional)
 */
export const send = (
  files: FileList,
  peerID: string,
  password?: string,
  publicKey?: string
) => {
  if (files) {
    let filenames: string[] = [];
    let file: File;
    for (file of Array.from(files)) {
      filenames.push(file.name);
    }

    let encrypted_files;
    if (publicKey !== undefined) {
      encrypted_files = encryptFiles(files, publicKey);
    } else if (password !== undefined) {
      encrypted_files = encryptFilesWithPassword(files, password);
    } else {
      throw new Error("A password or public key has to be defined.");
    }

    encrypted_files.then((encrypted_files) => {
      let connect_return = connected(peerID);
      if (connect_return == false) {
        let conn = peer.connect(peerID);

        conn.on("open", function () {
          // Sending file sizes inside an array to show different progress sizes for bar
          conn.send({
            fileSizes: encryptFiles.prototype.map((val: string) => {
              val.length;
            }),
          });

          // Spicing encrypted file content into ten equal parts since peerjs api doesn't chunk properly
          // Each part has a property identifying its order inside the file
          for (let i = 0; i < encryptFiles.length; i++) {
            const enc_file = encryptFiles.prototype.at(i);
            if (publicKey !== undefined) {
              let lastIndex = 0;
              conn.send({
                length: enc_file.length,
              });
              for (let i = 0; i < enc_file.length; i += enc_file.length / 10) {
                const spliced = enc_file.substring(lastIndex, i);
                lastIndex = i;
                conn.send({
                  file: spliced,
                  filename: filenames[i],
                  encrypted: "publicKey",
                  part: `${i}/10`,
                });
              }
            } else {
              let lastIndex = 0;
              conn.send({
                length: enc_file.length,
              });
              for (let i = 0; i < enc_file.length; i += enc_file.length / 10) {
                const spliced = enc_file.substring(lastIndex, i);
                lastIndex = i;
                conn.send({
                  file: spliced,
                  filename: filenames[i],
                  encrypted: "password",
                  length: enc_file.length,
                  part: `${i}/10`,
                });
              }
            }
          }
          // if (publicKey !== undefined) {
          //   conn.send({
          //     file: Array.from(encrypted_files),
          //     filename: filenames,
          //     encrypted: "publicKey",
          //   });
          // } else {
          //   conn.send({
          //     file: Array.from(encrypted_files),
          //     filename: filenames,
          //     encrypted: "password",
          //   });
          // }
        });

        conn.on("data", function (received_data) {
          handleData(received_data, conn);
        });

        connections.push(conn);
      } else {
        if (publicKey !== undefined) {
          connect_return.send({
            file: Array.from(encrypted_files),
            filename: filenames,
            encrypted: "publicKey",
          });
        } else {
          connect_return.send({
            file: Array.from(encrypted_files),
            filename: filenames,
            encrypted: "password",
          });
        }
      }
    });
  }
};

// not needed this will be handled by the service worker
// export const multiSend = (files: FileList, reciever_uuids: string[], publicKeys: string[]) => {
//   let reciever_uuid: string;
//   for (reciever_uuid of reciever_uuids) {
//     send(files, reciever_uuid, undefined, publicKeys);
//   };
// };

export const setup = (uuid?: string) => {
  openPeer(uuid);
  listen();
};
