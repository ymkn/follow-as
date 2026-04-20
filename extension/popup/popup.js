"use strict";

const accountNameEl = document.getElementById("account-name");
const followingCountEl = document.getElementById("following-count");
const refreshBtn = document.getElementById("refresh-btn");
const statusEl = document.getElementById("status");

function loadState() {
  chrome.runtime.sendMessage({ type: "GET_SUB_ACCOUNT" }, (res) => {
    if (res?.subAccount) {
      accountNameEl.textContent = `@${res.subAccount.username}`;
      followingCountEl.textContent = `${res.followingCount} 人`;
    } else {
      accountNameEl.textContent = "未接続";
      accountNameEl.classList.add("error");
      statusEl.textContent = "Native Host に接続できません";
      statusEl.classList.add("error");
    }
  });
}

refreshBtn.addEventListener("click", () => {
  refreshBtn.disabled = true;
  statusEl.textContent = "再取得中...";
  statusEl.classList.remove("error");

  chrome.runtime.sendMessage({ type: "REFRESH" }, (res) => {
    refreshBtn.disabled = false;
    if (res?.success) {
      followingCountEl.textContent = `${res.count} 人`;
      statusEl.textContent = "更新完了";
      setTimeout(() => { statusEl.textContent = ""; }, 2000);
    } else {
      statusEl.textContent = `エラー: ${res?.error || "不明"}`;
      statusEl.classList.add("error");
    }
  });
});

loadState();
