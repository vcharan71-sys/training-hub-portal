const STORAGE_KEYS = {
  users: "training_hub_users_v1",
  progress: "training_hub_progress_v1",
  theme: "training_hub_theme",
};

const DB_NAME = "training_hub_db";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";

const state = {
  users: loadUsers(),
  progress: loadProgress(),
  videos: [],
  activeTab: "admin",
  videoSearchQuery: "",
};

const els = {
  themeToggle: document.getElementById("themeToggle"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  adminTab: document.getElementById("adminTab"),
  joineeTab: document.getElementById("joineeTab"),
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
  activeJoineeSelect: document.getElementById("activeJoineeSelect"),
  activeVideoSelect: document.getElementById("activeVideoSelect"),
  videoSearchInput: document.getElementById("videoSearchInput"),
  moduleQuickList: document.getElementById("moduleQuickList"),
  trainingPlayer: document.getElementById("trainingPlayer"),
  videoMeta: document.getElementById("videoMeta"),
  videoStatus: document.getElementById("videoStatus"),
};

const dbPromise = openDatabase();

init().catch((error) => {
  console.error(error);
  alert("Could not initialize the training portal in this browser.");
});

async function init() {
  applySavedTheme();
  wireThemeToggle();
  wireTabs();
  wireForms();
  wirePlayerTracking();

  state.videos = await getAllVideos();
  renderAll();
}

function applySavedTheme() {
  if (localStorage.getItem(STORAGE_KEYS.theme) === "dark") {
    document.body.classList.add("dark");
  }
}

function wireThemeToggle() {
  els.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
  });
}

function wireTabs() {
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      els.tabButtons.forEach((btn) => {
        const isActive = btn.dataset.tab === state.activeTab;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });
      const showAdmin = state.activeTab === "admin";
      els.adminTab.classList.toggle("active", showAdmin);
      els.joineeTab.classList.toggle("active", !showAdmin);
    });
  });
}

function wireForms() {
  els.joineeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = els.joineeName.value.trim();
    const email = els.joineeEmail.value.trim().toLowerCase();

    if (!name || !email) {
      return;
    }

    const exists = state.users.some((user) => user.email === email);
    if (exists) {
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

    const newVideo = {
      id: crypto.randomUUID(),
      title,
      description,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file,
    };

    await saveVideo(newVideo);
    state.videos = await getAllVideos();
    els.videoForm.reset();
    renderAll();
  });

  els.activeJoineeSelect.addEventListener("change", () => {
    restorePlaybackPosition();
    renderVideoStatus();
    renderModuleQuickList();
  });

  els.activeVideoSelect.addEventListener("change", () => {
    loadSelectedVideoIntoPlayer();
    renderModuleQuickList();
  });

  els.videoSearchInput.addEventListener("input", () => {
    state.videoSearchQuery = els.videoSearchInput.value.trim().toLowerCase();
    renderModuleQuickList();
  });
}

function wirePlayerTracking() {
  const savePlaybackProgress = () => {
    const userId = els.activeJoineeSelect.value;
    const videoId = els.activeVideoSelect.value;
    const player = els.trainingPlayer;

    if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
      return;
    }

    const key = progressKey(userId, videoId);
    const current = state.progress[key] || {
      watchedSeconds: 0,
      duration: player.duration,
      completed: false,
      completedAt: null,
      viewCount: 0,
    };

    current.watchedSeconds = Math.max(current.watchedSeconds, player.currentTime);
    current.duration = player.duration;
    current.viewCount = current.viewCount || 0;

    const ratio = current.watchedSeconds / current.duration;
    if (ratio >= 0.9) {
      current.completed = true;
      current.completedAt = current.completedAt || new Date().toISOString();
    }

    state.progress[key] = current;
    saveProgress(state.progress);
    renderVideoStatus();
    renderProgressTable();
  };

  els.trainingPlayer.addEventListener("timeupdate", savePlaybackProgress);
  els.trainingPlayer.addEventListener("ended", () => {
    savePlaybackProgress();
    markVideoEnded();
  });
  els.trainingPlayer.addEventListener("loadedmetadata", () => {
    restorePlaybackPosition();
    renderVideoStatus();
  });
}

function renderAll() {
  renderJoineeList();
  renderVideoLibrary();
  renderJoineeSelect();
  renderVideoSelect();
  renderModuleQuickList();
  loadSelectedVideoIntoPlayer();
  renderProgressTable();
}

function renderJoineeList() {
  if (state.users.length === 0) {
    els.joineeList.innerHTML = "<li>No joinees added yet.</li>";
    return;
  }

  els.joineeList.innerHTML = state.users
    .map(
      (user) =>
        `<li><span class="list-title">${escapeHtml(user.name)}</span><span class="list-sub">${escapeHtml(user.email)}</span></li>`
    )
    .join("");
}

function renderVideoLibrary() {
  if (state.videos.length === 0) {
    els.videoList.innerHTML = "<li>No training videos uploaded yet.</li>";
    return;
  }

  els.videoList.innerHTML = state.videos
    .map((video) => {
      const mb = (video.size / (1024 * 1024)).toFixed(1);
      return `<li><span class="list-title">${escapeHtml(video.title)}</span><span class="list-sub">${escapeHtml(video.fileName)} (${mb} MB)</span></li>`;
    })
    .join("");
}

function renderJoineeSelect() {
  const previous = els.activeJoineeSelect.value;

  if (state.users.length === 0) {
    els.activeJoineeSelect.innerHTML = '<option value="">No joinees available</option>';
    return;
  }

  els.activeJoineeSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.email)})</option>`)
    .join("");

  const stillExists = state.users.some((user) => user.id === previous);
  els.activeJoineeSelect.value = stillExists ? previous : state.users[0].id;
}

function renderVideoSelect() {
  const previous = els.activeVideoSelect.value;

  if (state.videos.length === 0) {
    els.activeVideoSelect.innerHTML = '<option value="">No modules available</option>';
    els.videoMeta.textContent = "Upload a video from Admin Portal to start training.";
    return;
  }

  els.activeVideoSelect.innerHTML = state.videos
    .map((video) => `<option value="${video.id}">${escapeHtml(video.title)}</option>`)
    .join("");

  const stillExists = state.videos.some((video) => video.id === previous);
  els.activeVideoSelect.value = stillExists ? previous : state.videos[0].id;
}

function renderModuleQuickList() {
  if (state.videos.length === 0) {
    els.moduleQuickList.innerHTML = "<li>No modules available.</li>";
    return;
  }

  const selectedId = els.activeVideoSelect.value;
  const filtered = state.videos.filter((video) =>
    video.title.toLowerCase().includes(state.videoSearchQuery)
  );

  if (filtered.length === 0) {
    els.moduleQuickList.innerHTML = "<li>No modules match this search.</li>";
    return;
  }

  els.moduleQuickList.innerHTML = filtered
    .map((video) => {
      const isActive = video.id === selectedId ? "active" : "";
      return `<li class="${isActive}" data-video-id="${video.id}"><span class="list-title">${escapeHtml(video.title)}</span><span class="list-sub">${formatFileSize(video.size)}</span></li>`;
    })
    .join("");

  els.moduleQuickList.querySelectorAll("li[data-video-id]").forEach((item) => {
    item.addEventListener("click", () => {
      els.activeVideoSelect.value = item.dataset.videoId;
      loadSelectedVideoIntoPlayer();
      renderModuleQuickList();
    });
  });
}

function loadSelectedVideoIntoPlayer() {
  const selectedId = els.activeVideoSelect.value;
  if (!selectedId) {
    els.trainingPlayer.removeAttribute("src");
    els.trainingPlayer.load();
    els.videoStatus.textContent = "Progress will appear here once playback starts.";
    return;
  }

  const selectedVideo = state.videos.find((video) => video.id === selectedId);
  if (!selectedVideo) {
    return;
  }

  const oldSrc = els.trainingPlayer.getAttribute("src");
  if (oldSrc && oldSrc.startsWith("blob:")) {
    URL.revokeObjectURL(oldSrc);
  }

  const src = URL.createObjectURL(selectedVideo.blob);
  els.trainingPlayer.src = src;
  els.trainingPlayer.load();

  const text = selectedVideo.description
    ? `${selectedVideo.title}: ${selectedVideo.description}`
    : `${selectedVideo.title}: No description provided.`;
  els.videoMeta.textContent = text;

  renderVideoStatus();
}

function restorePlaybackPosition() {
  const userId = els.activeJoineeSelect.value;
  const videoId = els.activeVideoSelect.value;
  const player = els.trainingPlayer;

  if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
    return;
  }

  const entry = state.progress[progressKey(userId, videoId)];
  if (!entry) {
    return;
  }

  if (entry.completed) {
    player.currentTime = 0;
    return;
  }

  const maxTime = Math.max(player.duration - 1, 0);
  player.currentTime = Math.min(entry.watchedSeconds || 0, maxTime);
}

function markVideoEnded() {
  const userId = els.activeJoineeSelect.value;
  const videoId = els.activeVideoSelect.value;
  const player = els.trainingPlayer;

  if (!userId || !videoId || !Number.isFinite(player.duration) || player.duration <= 0) {
    return;
  }

  const key = progressKey(userId, videoId);
  const current = state.progress[key] || {
    watchedSeconds: player.duration,
    duration: player.duration,
    completed: true,
    completedAt: new Date().toISOString(),
    viewCount: 0,
  };

  current.completed = true;
  current.completedAt = current.completedAt || new Date().toISOString();
  current.duration = player.duration;
  current.watchedSeconds = Math.max(current.watchedSeconds || 0, player.duration);
  current.viewCount = (current.viewCount || 0) + 1;

  state.progress[key] = current;
  saveProgress(state.progress);
  renderVideoStatus();
  renderProgressTable();
}

function renderVideoStatus() {
  const userId = els.activeJoineeSelect.value;
  const videoId = els.activeVideoSelect.value;

  if (!userId || !videoId) {
    els.videoStatus.textContent = "Pick a joinee and module to begin.";
    return;
  }

  const entry = state.progress[progressKey(userId, videoId)];
  if (!entry) {
    els.videoStatus.textContent = "Not started yet.";
    return;
  }

  const duration = entry.duration || els.trainingPlayer.duration || 0;
  const ratio = duration > 0 ? Math.min(100, (entry.watchedSeconds / duration) * 100) : 0;

  if (entry.completed) {
    const times = entry.viewCount || 0;
    els.videoStatus.textContent = `Completed (${ratio.toFixed(0)}%). Watched ${times} time${times === 1 ? "" : "s"}. Rewatch anytime.`;
    return;
  }

  els.videoStatus.textContent = `In progress (${ratio.toFixed(0)}%).`;
}

function renderProgressTable() {
  if (state.users.length === 0) {
    els.progressTableBody.innerHTML = "<tr><td colspan='5'>No joinees available.</td></tr>";
    return;
  }

  const totalVideos = state.videos.length;

  els.progressTableBody.innerHTML = state.users
    .map((user) => {
      const completed = state.videos.filter((video) => {
        const entry = state.progress[progressKey(user.id, video.id)];
        return Boolean(entry && entry.completed);
      }).length;
      const totalViews = state.videos.reduce((sum, video) => {
        const entry = state.progress[progressKey(user.id, video.id)];
        return sum + (entry?.viewCount || 0);
      }, 0);

      const percentage = totalVideos > 0 ? Math.round((completed / totalVideos) * 100) : 0;
      return `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${completed}/${totalVideos}</td>
          <td><span class="progress-pill">${percentage}%</span></td>
          <td>${totalViews}</td>
        </tr>
      `;
    })
    .join("");
}

function progressKey(userId, videoId) {
  return `${userId}::${videoId}`;
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatFileSize(sizeInBytes) {
  const mb = sizeInBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
