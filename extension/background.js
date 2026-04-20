"use strict";

const HOST_NAME = "com.follow_as.host";

let port = null;
let pendingRequests = new Map();
let requestId = 0;

// Sub-account state
let subAccount = null; // { id, name, username }
let followingSet = new Set(); // Set of user IDs the sub-account follows

function connectNativeHost() {
  port = chrome.runtime.connectNative(HOST_NAME);

  port.onMessage.addListener((msg) => {
    const id = msg._requestId;
    if (id !== undefined && pendingRequests.has(id)) {
      const { resolve } = pendingRequests.get(id);
      pendingRequests.delete(id);
      delete msg._requestId;
      resolve(msg);
    }
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message || "Native host disconnected";
    for (const { reject } of pendingRequests.values()) {
      reject(new Error(error));
    }
    pendingRequests.clear();
    port = null;
  });
}

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!port) {
      connectNativeHost();
    }
    const id = ++requestId;
    message._requestId = id;
    pendingRequests.set(id, { resolve, reject });
    port.postMessage(message);
  });
}

async function initialize() {
  try {
    // Get sub-account info
    const meResult = await sendNativeMessage({ action: "get_me" });
    if (!meResult.success) {
      console.error("[follow-as] Failed to get sub-account info:", meResult.error);
      return;
    }
    subAccount = meResult.data;
    console.log(`[follow-as] Sub-account: @${subAccount.username} (${subAccount.id})`);

    // Fetch following list
    await refreshFollowingList();
  } catch (e) {
    console.error("[follow-as] Initialization failed:", e);
  }
}

async function refreshFollowingList() {
  const result = await sendNativeMessage({
    action: "get_following",
    params: { userId: subAccount.id },
  });
  if (!result.success) {
    console.error("[follow-as] Failed to fetch following list:", result.error);
    return;
  }
  followingSet = new Set((result.data || []).map((u) => u.id));
  console.log(`[follow-as] Cached ${followingSet.size} following`);
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    const { targetUserId } = msg;
    sendResponse({
      ready: subAccount !== null,
      subAccount,
      isFollowing: followingSet.has(targetUserId),
    });
    return false;
  }

  if (msg.type === "FOLLOW") {
    handleFollow(msg.targetUserId, msg.targetUsername).then(sendResponse);
    return true; // async
  }

  if (msg.type === "UNFOLLOW") {
    handleUnfollow(msg.targetUserId, msg.targetUsername).then(sendResponse);
    return true; // async
  }

  if (msg.type === "REFRESH") {
    refreshFollowingList().then(() => {
      sendResponse({ success: true, count: followingSet.size });
    }).catch((e) => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  if (msg.type === "GET_SUB_ACCOUNT") {
    sendResponse({ subAccount, followingCount: followingSet.size });
    return false;
  }
});

async function handleFollow(targetUserId, targetUsername) {
  try {
    const result = await sendNativeMessage({
      action: "follow",
      params: { targetUsername },
    });
    if (result.success) {
      followingSet.add(targetUserId);
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleUnfollow(targetUserId, targetUsername) {
  try {
    const result = await sendNativeMessage({
      action: "unfollow",
      params: { targetUsername },
    });
    if (result.success) {
      followingSet.delete(targetUserId);
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Initialize on service worker start
initialize();
