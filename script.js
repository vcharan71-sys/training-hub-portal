const STORAGE_KEYS = {
  users: "training_hub_users_v2",
  progress: "training_hub_progress_v2",
  theme: "training_hub_theme",
  adminSession: "training_hub_admin_session",
};

// Change these two values to your private credentials.
const ADMIN_CREDENTIALS = {
  username: "vcharan71-sys",
  passcode: "AutoMynd@2026",
};

const DB_NAME = "training_hub_db";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";

const state = {
  users: loadUsers(),
  progress: loadProgress(),
  videos: [],
  activeView: "training",
  searchQuery: "",
  isAdminUnlocked: localStorage.getItem(STORAGE_KEYS.adminSession) === "1",
};

const els = {
  trainingTabBtn: document.getElementById("trainingTabBtn"),
  adminTabBtn: document.getElementById("adminTabBtn"),
  trainingView: document.getElementById("trainingView"),
  adminView: document.getElementById("adminView"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  themeToggle: document.getElementById("themeToggle"),

  activeJoineeSelect: document.getElementById("activeJoineeSelect"),
  videoSearchInput: document.getElementById("videoSearchInput"),
  videoCardGrid: document.getElementById("videoCardGrid"),

  trainingPlayer: document.getElementById("trainingPlayer"),
  playerTitle: document.getElementById("playerTitle"),
  videoMeta: document.getElementById("videoMeta"),
  completionCheckbox: document.getElementById("completionCheckbox"),
  completionNote: document.getElementById("completionNote"),
  videoStatus: document.getElementById("videoStatus"),

  adminGate: document.getElementById("adminGate"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminUsername: document.getElementById("adminUsername"),
  adminPasscode: document.getElementById("adminPasscode"),
  adminGateMessage: document.getElementById("adminGateMessage"),
  adminContent: document.getElementById("adminContent"),

  joineeForm: document.getElementById("joineeForm"),
  joineeName: document.getElementById("joineeName"),
  joineeEmail: document.getElementById("joineeEmail"),
  videoForm: document.getElementById("videoForm"),
  videoTitle: document.getElementById("videoTitle"),
  videoDescription: document.getElementById("videoDescription"),
  videoFile: document.getElementById("videoFile"),

  joineeList: document.getElementById("joineeList"),
  videoList: document.getElementById("videoList"),
  progressTableBody: document.getElementById("progressTableBody"),
};

const dbPromise = openDatabase();

init().catch((error) => {
  console.error(error);
  alert("Could not initialize the learning portal in this browser.");
});

async function init() {
  applySavedTheme();
  wireHeaderAndViews();
  wireTraining();
  wireAdmin();
  wirePlayerTracking();

  state.videos = await getAllVideos();
  renderAll();
}

function wireHeaderAndViews() {
  els.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
  });

  els.trainingTabBtn.addEventListener("click", () => {
    switchView("training");
  });

  els.adminTabBtn.addEventListener("click", () => {
    switchView("admin");
  });

  els.adminLogoutBtn.addEventListener("click", () => {
    state.isAdminUnlocked = false;
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    updateAdminVisibility();
    switchView("training");
  });

  updateAdminVisibility();
  switchView("training");
}

function switchView(viewName) {
  state.activeView = viewName;
  const training = viewName === "training";

  els.trainingTabBtn.classList.toggle("active", training);
  els.adminTabBtn.classList.toggle("active", !training);
  els.trainingView.classList.toggle("active", training);
  els.adminView.classList.toggle("active", !training);

  if (!training) {
    updateAdminVisibility();
  }
}

function updateAdminVisibility() {
  els.adminGate.classList.toggle("hidden", state.isAdminUnlocked);
  els.adminContent.classList.toggle("hidden", !state.isAdminUnlocked);
  els.adminLogoutBtn.classList.toggle("hidden", !state.isAdminUnlocked);
}

function wireTraining() {
  els.activeJoineeSelect.addEventListener("change", () => {
    restorePlaybackPosition();
    renderVideoCards();
    renderPlayerStatus();
  });

  els.videoSearchInput.addEventListener("input", () => {
    state.searchQuery = els.videoSearchInput.value.trim().toLowerCase();
    renderVideoCards();
  });

  els.completionCheckbox.addEventListener("change", () => {
    const userId = els.activeJoineeSelect.value;
    const videoId = currentVideoId();
    if (!userId || !videoId) {
      return;
    }

    const key = progressKey(userId, videoId);
    const entry = state.progress[key] || createEmptyProgressEntry();

    if (els.completionCheckbox.checked && !isEligibleForManualCompletion(entry)) {
      els.completionCheckbox.checked = false;
      return;
    }

    entry.manualCompleted = els.completionCheckbox.checked;
    entry.completedAt = entry.manualCompleted ? new Date().toISOString() : null;
    state.progress[key] = entry;
    saveProgress(state.progress);

    renderVideoCards();
    renderPlayerStatus();
    renderProgressTable();
  });
}

function wireAdmin() {
  els.adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = els.adminUsername.value.trim();
    const passcode = els.adminPasscode.value;

    const usernameMatch = username === ADMIN_CREDENTIALS.username;
    const passcodeMatch = passcode === ADMIN_CREDENTIALS.passcode;

    if (!usernameMatch || !passcodeMatch) {
      els.adminGateMessage.textContent = "Invalid credentials. Please try again.";
      return;
    }

    state.isAdminUnlocked = true;
    localStorage.setItem(STORAGE_KEYS.adminSession, "1");
    els.adminGateMessage.textContent = "";
    els.adminLoginForm.reset();
    updateAdminVisibility();
    renderAdminData();
  });

  els.joineeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = els.joineeName.value.trim();
    const email = els.joineeEmail.value.trim().toLowerCase();
    if (!name || !email) {
      return;
    }

    if (state.users.some((user) => user.email === email)) {
      alert("A joinee with this email already exists.");
      return;
    }

    state.users.push({
      id: crypto.randomUUID(),
      name,
      email,
      joinedAt: new Date().toISOString(),
    });

    saveUsers(state.users);
    els.joineeForm.reset();
    renderAll();
  });

  els.videoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = els.videoTitle.value.trim();
    const description = els.videoDescription.value.trim();
    const file = els.videoFile.files?.[0];
    if (!title || !file) {
      return;
    }

    await saveVideo({
      id: crypto.randomUUID(),
      title,
      description,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file,
    });

    state.videos = await getAllVideos();
    els.videoForm.reset();
    renderAll();
  });
}

function wirePlayerTracking() {
  els.trainingPlayer.addEventListener("timeupdate", () => {
    const userId = els.activeJoineeSelect.value;
    const videoId = currentVideoId();
    const player = els.trainingPlayer;

    if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
      return;
    }

    const key = progressKey(userId, videoId);
    const entry = state.progress[key] || createEmptyProgressEntry();

    entry.watchedSeconds = Math.max(entry.watchedSeconds, player.currentTime);
    entry.duration = player.duration;
    entry.lastWatchedAt = new Date().toISOString();

    state.progress[key] = entry;
    saveProgress(state.progress);
    updateCompletionControls(entry);
    renderPlayerStatus();
  });

  els.trainingPlayer.addEventListener("ended", () => {
    const userId = els.activeJoineeSelect.value;
    const videoId = currentVideoId();
    const player = els.trainingPlayer;

    if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
      return;
    }

    const key = progressKey(userId, videoId);
    const entry = state.progress[key] || createEmptyProgressEntry();

    entry.watchedSeconds = Math.max(entry.watchedSeconds, player.duration);
    entry.duration = player.duration;
    entry.viewCount = (entry.viewCount || 0) + 1;
    entry.lastWatchedAt = new Date().toISOString();

    state.progress[key] = entry;
    saveProgress(state.progress);

    updateCompletionControls(entry);
    renderVideoCards();
    renderPlayerStatus();
    renderProgressTable();
  });

  els.trainingPlayer.addEventListener("loadedmetadata", () => {
    restorePlaybackPosition();
    renderPlayerStatus();
  });
}

function renderAll() {
  renderJoineeSelect();
  renderVideoCards();
  renderAdminData();

  if (!currentVideoId() && state.videos.length > 0) {
    selectVideo(state.videos[0].id);
  } else {
    refreshPlayerPanel();
  }
}

function renderJoineeSelect() {
  const previous = els.activeJoineeSelect.value;

  if (state.users.length === 0) {
    els.activeJoineeSelect.innerHTML = '<option value="">No employees added</option>';
    return;
  }

  els.activeJoineeSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.email)})</option>`)
    .join("");

  const exists = state.users.some((u) => u.id === previous);
  els.activeJoineeSelect.value = exists ? previous : state.users[0].id;
}

function renderVideoCards() {
  if (state.videos.length === 0) {
    els.videoCardGrid.innerHTML = '<article class="panel">No training videos uploaded yet.</article>';
    return;
  }

  const selectedUserId = els.activeJoineeSelect.value;
  const selectedVideoId = currentVideoId();

  const filtered = state.videos.filter((video) => {
    if (!state.searchQuery) {
      return true;
    }
    const text = `${video.title} ${video.description || ""}`.toLowerCase();
    return text.includes(state.searchQuery);
  });

  if (filtered.length === 0) {
    els.videoCardGrid.innerHTML = '<article class="panel">No modules match this search.</article>';
    return;
  }

  els.videoCardGrid.innerHTML = filtered
    .map((video, index) => {
      const entry = state.progress[progressKey(selectedUserId, video.id)] || createEmptyProgressEntry();
      const completedMark = entry.manualCompleted ? '<span class="done-badge">✓</span>' : "";
      const activeStyle = selectedVideoId === video.id ? ' style="outline: 2px solid #1496da;"' : "";
      return `
        <article class="video-card"${activeStyle}>
          <div class="card-thumb">
            ▶
            ${completedMark}
          </div>
          <div class="card-body">
            <p class="card-title">${escapeHtml(video.title)}</p>
            <div class="card-meta">Module ${index + 1} • ${formatFileSize(video.size)} • Watched ${entry.viewCount || 0}x</div>
            <button class="watch-btn" data-video-id="${video.id}" type="button">Watch Now</button>
          </div>
        </article>
      `;
    })
    .join("");

  els.videoCardGrid.querySelectorAll("[data-video-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectVideo(btn.dataset.videoId);
    });
  });
}

function selectVideo(videoId) {
  const video = state.videos.find((item) => item.id === videoId);
  if (!video) {
    return;
  }

  const oldSrc = els.trainingPlayer.getAttribute("src");
  if (oldSrc && oldSrc.startsWith("blob:")) {
    URL.revokeObjectURL(oldSrc);
  }

  els.trainingPlayer.src = URL.createObjectURL(video.blob);
  els.trainingPlayer.dataset.videoId = video.id;
  els.trainingPlayer.load();

  refreshPlayerPanel();
  renderVideoCards();
}

function refreshPlayerPanel() {
  const videoId = currentVideoId();
  const video = state.videos.find((item) => item.id === videoId);

  if (!video) {
    els.playerTitle.textContent = "Select a module";
    els.videoMeta.textContent = "Choose a card to start watching.";
    els.completionCheckbox.checked = false;
    els.completionCheckbox.disabled = true;
    els.completionNote.textContent = "Watch until near the end to enable completion checkbox.";
    els.videoStatus.textContent = "Progress will appear here once playback starts.";
    return;
  }

  els.playerTitle.textContent = video.title;
  els.videoMeta.textContent = video.description || "No description provided.";

  const selectedUserId = els.activeJoineeSelect.value;
  const entry = state.progress[progressKey(selectedUserId, video.id)] || createEmptyProgressEntry();
  updateCompletionControls(entry);
  renderPlayerStatus();
}

function updateCompletionControls(entry) {
  const enabled = isEligibleForManualCompletion(entry);
  els.completionCheckbox.disabled = !enabled;
  els.completionCheckbox.checked = Boolean(entry.manualCompleted);

  if (enabled) {
    els.completionNote.textContent = "You can now check completion for this module.";
  } else {
    els.completionNote.textContent = "Watch at least 90% of the video to enable completion checkbox.";
  }
}

function renderPlayerStatus() {
  const userId = els.activeJoineeSelect.value;
  const videoId = currentVideoId();

  if (!userId || !videoId) {
    els.videoStatus.textContent = "Select employee and module to begin.";
    return;
  }

  const entry = state.progress[progressKey(userId, videoId)] || createEmptyProgressEntry();
  const duration = entry.duration || els.trainingPlayer.duration || 0;
  const ratio = duration > 0 ? Math.min(100, (entry.watchedSeconds / duration) * 100) : 0;

  if (entry.manualCompleted) {
    const completionDate = entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "just now";
    els.videoStatus.textContent = `Completed by employee. Progress ${ratio.toFixed(0)}%. Last completion: ${completionDate}.`;
    return;
  }

  els.videoStatus.textContent = `In progress ${ratio.toFixed(0)}%. Full watches: ${entry.viewCount || 0}.`;
}

function restorePlaybackPosition() {
  const userId = els.activeJoineeSelect.value;
  const videoId = currentVideoId();
  const player = els.trainingPlayer;

  if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
    return;
  }

  const entry = state.progress[progressKey(userId, videoId)];
  if (!entry) {
    return;
  }

  const maxSeek = Math.max(player.duration - 1, 0);
  player.currentTime = Math.min(entry.watchedSeconds || 0, maxSeek);
}

function renderAdminData() {
  renderJoineeList();
  renderVideoLibrary();
  renderProgressTable();
}

function renderJoineeList() {
  if (state.users.length === 0) {
    els.joineeList.innerHTML = "<li>No joinees added yet.</li>";
    return;
  }

  els.joineeList.innerHTML = state.users
    .map((user) => `<li><strong>${escapeHtml(user.name)}</strong><br /><span>${escapeHtml(user.email)}</span></li>`)
    .join("");
}

function renderVideoLibrary() {
  if (state.videos.length === 0) {
    els.videoList.innerHTML = "<li>No training videos uploaded yet.</li>";
    return;
  }

  els.videoList.innerHTML = state.videos
    .map(
      (video, index) =>
        `<li><strong>Module ${index + 1}: ${escapeHtml(video.title)}</strong><br /><span>${escapeHtml(video.fileName)} • ${formatFileSize(video.size)}</span></li>`
    )
    .join("");
}

function renderProgressTable() {
  if (state.users.length === 0) {
    els.progressTableBody.innerHTML = "<tr><td colspan='5'>No joinees available.</td></tr>";
    return;
  }

  const totalVideos = state.videos.length;

  els.progressTableBody.innerHTML = state.users
    .map((user) => {
      let completedCount = 0;
      let totalViews = 0;
      let latestCompletion = null;

      state.videos.forEach((video) => {
        const entry = state.progress[progressKey(user.id, video.id)];
        if (!entry) {
          return;
        }

        totalViews += entry.viewCount || 0;
        if (entry.manualCompleted) {
          completedCount += 1;
          if (entry.completedAt && (!latestCompletion || entry.completedAt > latestCompletion)) {
            latestCompletion = entry.completedAt;
          }
        }
      });

      return `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${completedCount}/${totalVideos}</td>
          <td>${totalViews}</td>
          <td>${latestCompletion ? new Date(latestCompletion).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function currentVideoId() {
  return els.trainingPlayer.dataset.videoId || "";
}

function isEligibleForManualCompletion(entry) {
  const duration = entry.duration || 0;
  if (duration <= 0) {
    return false;
  }
  const ratio = (entry.watchedSeconds || 0) / duration;
  return ratio >= 0.9 || (entry.viewCount || 0) > 0;
}

function createEmptyProgressEntry() {
  return {
    watchedSeconds: 0,
    duration: 0,
    viewCount: 0,
    manualCompleted: false,
    completedAt: null,
    lastWatchedAt: null,
  };
}

function progressKey(userId, videoId) {
  return `${userId}::${videoId}`;
}

function applySavedTheme() {
  if (localStorage.getItem(STORAGE_KEYS.theme) === "dark") {
    document.body.classList.add("dark");
  }
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.users);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progress);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveVideo(video) {
  const db = await dbPromise;
  await runTransaction(db, VIDEO_STORE, "readwrite", (store) => store.put(video));
}

async function getAllVideos() {
  const db = await dbPromise;
  const videos = await runTransaction(db, VIDEO_STORE, "readonly", (store) => store.getAll());
  return videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function runTransaction(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

function formatFileSize(sizeInBytes) {
  const mb = sizeInBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
