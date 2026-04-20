#!/usr/bin/env node
"use strict";

const { execFile } = require("child_process");
const path = require("path");

// Native Messaging protocol: 4-byte length prefix (little-endian) + JSON payload

function readMessage() {
  return new Promise((resolve, reject) => {
    const header = Buffer.alloc(4);
    let bytesRead = 0;

    const readHeader = () => {
      const chunk = process.stdin.read(4 - bytesRead);
      if (!chunk) {
        process.stdin.once("readable", readHeader);
        return;
      }
      chunk.copy(header, bytesRead);
      bytesRead += chunk.length;
      if (bytesRead < 4) {
        process.stdin.once("readable", readHeader);
        return;
      }
      const length = header.readUInt32LE(0);
      if (length === 0) {
        resolve(null);
        return;
      }
      readBody(length);
    };

    const readBody = (length) => {
      let body = Buffer.alloc(0);
      const readChunk = () => {
        const chunk = process.stdin.read(length - body.length);
        if (!chunk) {
          process.stdin.once("readable", readChunk);
          return;
        }
        body = Buffer.concat([body, chunk]);
        if (body.length < length) {
          process.stdin.once("readable", readChunk);
          return;
        }
        try {
          resolve(JSON.parse(body.toString("utf-8")));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      };
      readChunk();
    };

    process.stdin.once("readable", readHeader);
  });
}

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const body = Buffer.from(json, "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(header);
  process.stdout.write(body);
}

function runXurl(args) {
  return new Promise((resolve, reject) => {
    execFile("xurl", args, { timeout: 30000, shell: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function handleMessage(msg) {
  const { action, params } = msg;

  try {
    switch (action) {
      case "get_me": {
        const raw = await runXurl(["/2/users/me"]);
        const data = JSON.parse(raw);
        return { success: true, data: data.data };
      }

      case "get_following": {
        const userId = params.userId;
        let allFollowing = [];
        let paginationToken = null;

        do {
          const args = [`/2/users/${userId}/following?max_results=1000`];
          if (paginationToken) {
            args[0] += `&pagination_token=${paginationToken}`;
          }
          const raw = await runXurl(args);
          const result = JSON.parse(raw);
          if (result.data) {
            allFollowing = allFollowing.concat(result.data);
          }
          paginationToken = result.meta?.next_token || null;
        } while (paginationToken);

        return { success: true, data: allFollowing };
      }

      case "follow": {
        const { targetUsername } = params;
        const raw = await runXurl(["follow", `@${targetUsername}`]);
        return { success: true, data: { following: true } };
      }

      case "unfollow": {
        const { targetUsername } = params;
        const raw = await runXurl(["unfollow", `@${targetUsername}`]);
        return { success: true, data: { following: false } };
      }

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  process.stdin.resume();

  while (true) {
    const msg = await readMessage();
    if (msg === null) break;
    const reqId = msg._requestId;
    delete msg._requestId;
    const response = await handleMessage(msg);
    if (reqId !== undefined) {
      response._requestId = reqId;
    }
    sendMessage(response);
  }
}

main().catch((e) => {
  sendMessage({ success: false, error: e.message });
  process.exit(1);
});
