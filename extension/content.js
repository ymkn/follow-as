"use strict";

(() => {
  const BUTTON_ID = "follow-as-btn";
  let currentUsername = null;
  let currentUserId = null;

  // Extract username from URL
  function getUsernameFromUrl() {
    const match = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})$/);
    if (!match) return null;
    const name = match[1];
    // Exclude known non-profile routes
    const reserved = [
      "home", "explore", "search", "notifications", "messages",
      "settings", "compose", "i", "lists", "bookmarks", "communities",
    ];
    if (reserved.includes(name.toLowerCase())) return null;
    return name;
  }

  // Extract user ID from X.com page (from follow button's data or react fiber)
  function extractUserIdFromPage() {
    // Strategy: find the follow/unfollow button and traverse React fiber to get user data
    const followBtn = document.querySelector(
      '[data-testid$="-follow"], [data-testid$="-unfollow"]'
    );
    if (!followBtn) return null;

    const testId = followBtn.getAttribute("data-testid");
    // data-testid format is "{userId}-follow" or "{userId}-unfollow"
    const idMatch = testId.match(/^(\d+)-(follow|unfollow)$/);
    if (idMatch) return idMatch[1];
    return null;
  }

  function createButton(isFollowing, subAccountUsername) {
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = isFollowing
      ? "faa-btn faa-btn--following"
      : "faa-btn faa-btn--not-following";
    btn.textContent = isFollowing
      ? `@${subAccountUsername} としてフォロー中`
      : `@${subAccountUsername} としてフォロー`;
    btn.dataset.following = isFollowing ? "true" : "false";
    btn.addEventListener("click", handleButtonClick);
    btn.addEventListener("mouseenter", handleMouseEnter);
    btn.addEventListener("mouseleave", handleMouseLeave);
    return btn;
  }

  function handleMouseEnter(e) {
    const btn = e.currentTarget;
    if (btn.dataset.following === "true") {
      btn.textContent = "フォロー解除";
      btn.classList.add("faa-btn--unfollow-hover");
    }
  }

  function handleMouseLeave(e) {
    const btn = e.currentTarget;
    if (btn.dataset.following === "true") {
      btn.classList.remove("faa-btn--unfollow-hover");
      chrome.runtime.sendMessage({ type: "GET_SUB_ACCOUNT" }, (res) => {
        if (res?.subAccount) {
          btn.textContent = `@${res.subAccount.username} としてフォロー中`;
        }
      });
    }
  }

  async function handleButtonClick(e) {
    const btn = e.currentTarget;
    if (!currentUserId || btn.dataset.loading === "true") return;

    btn.dataset.loading = "true";
    btn.disabled = true;

    const isFollowing = btn.dataset.following === "true";
    const msgType = isFollowing ? "UNFOLLOW" : "FOLLOW";

    chrome.runtime.sendMessage(
      { type: msgType, targetUserId: currentUserId, targetUsername: currentUsername },
      (response) => {
        btn.dataset.loading = "false";
        btn.disabled = false;

        if (response?.success) {
          const nowFollowing = !isFollowing;
          btn.dataset.following = nowFollowing ? "true" : "false";
          btn.className = nowFollowing
            ? "faa-btn faa-btn--following"
            : "faa-btn faa-btn--not-following";
          chrome.runtime.sendMessage({ type: "GET_SUB_ACCOUNT" }, (res) => {
            if (res?.subAccount) {
              btn.textContent = nowFollowing
                ? `@${res.subAccount.username} としてフォロー中`
                : `@${res.subAccount.username} としてフォロー`;
            }
          });
        } else {
          console.error("[follow-as] Action failed:", response?.error);
          btn.textContent = "エラー";
          setTimeout(() => {
            chrome.runtime.sendMessage({ type: "GET_SUB_ACCOUNT" }, (res) => {
              if (res?.subAccount) {
                btn.textContent = isFollowing
                  ? `@${res.subAccount.username} としてフォロー中`
                  : `@${res.subAccount.username} としてフォロー`;
              }
            });
          }, 2000);
        }
      }
    );
  }

  let injecting = false;

  function injectButton() {
    if (injecting) return;

    const existing = document.getElementById(BUTTON_ID);
    const username = getUsernameFromUrl();

    if (!username) {
      if (existing) existing.remove();
      return;
    }

    if (username === currentUsername && existing) return;
    if (existing) existing.remove();

    currentUsername = username;
    currentUserId = extractUserIdFromPage();

    if (!currentUserId) return;

    injecting = true;

    // Get state from background
    chrome.runtime.sendMessage(
      { type: "GET_STATE", targetUserId: currentUserId },
      (state) => {
        injecting = false;
        if (!state?.ready) return;

        // Re-check after async gap
        if (document.getElementById(BUTTON_ID)) return;

        const btn = createButton(state.isFollowing, state.subAccount.username);

        // Find the follow button container to place our button next to it
        const followBtn = document.querySelector(
          '[data-testid$="-follow"], [data-testid$="-unfollow"]'
        );
        if (followBtn) {
          const container = followBtn.closest('[data-testid="placementTracking"]')
            || followBtn.parentElement;
          if (container) {
            container.style.display = "flex";
            container.style.gap = "8px";
            container.style.alignItems = "center";
            container.appendChild(btn);
          }
        }
      }
    );
  }

  // Observe DOM changes (X.com is an SPA) — debounced
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      injectButton();
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also inject on navigation
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      currentUsername = null;
      currentUserId = null;
      const existing = document.getElementById(BUTTON_ID);
      if (existing) existing.remove();
      setTimeout(injectButton, 500);
    }
  }, 300);

  // Initial injection
  setTimeout(injectButton, 1000);
})();
