const STORAGE_KEYS = {
  users: "training_hub_users_v2",
  progress: "training_hub_progress_v2",
  theme: "training_hub_theme",
  adminSession: "training_hub_admin_session",
  traineeSessionUserId: "training_hub_trainee_session_user",
};

// Change admin credentials here.
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
  activeTraineeId: localStorage.getItem(STORAGE_KEYS.traineeSessionUserId) || "",
  analyticsUserId: "",
  analyticsSearchQuery: "",
};

const els = {
  trainingTabBtn: document.getElementById("trainingTabBtn"),
  adminTabBtn: document.getElementById("adminTabBtn"),
  trainingView: document.getElementById("trainingView"),
  adminView: document.getElementById("adminView"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  traineeLogoutBtn: document.getElementById("traineeLogoutBtn"),
  themeToggle: document.getElementById("themeToggle"),

  traineeGate: document.getElementById("traineeGate"),
  traineeLoginForm: document.getElementById("traineeLoginForm"),
  traineeEmail: document.getElementById("traineeEmail"),
  traineePassword: document.getElementById("traineePassword"),
  traineeGateMessage: document.getElementById("traineeGateMessage"),
  traineeContent: document.getElementById("traineeContent"),
  activeTraineeDisplay: document.getElementById("activeTraineeDisplay"),
  passwordChangePanel: document.getElementById("passwordChangePanel"),
  passwordChangeForm: document.getElementById("passwordChangeForm"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  passwordChangeMessage: document.getElementById("passwordChangeMessage"),
  trainingWorkspace: document.getElementById("trainingWorkspace"),

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
  joineePassword: document.getElementById("joineePassword"),

  videoForm: document.getElementById("videoForm"),
  videoTitle: document.getElementById("videoTitle"),
  videoDescription: document.getElementById("videoDescription"),
  videoFile: document.getElementById("videoFile"),

  joineeList: document.getElementById("joineeList"),
  videoList: document.getElementById("videoList"),
  progressTableBody: document.getElementById("progressTableBody"),
  analyticsSummary: document.getElementById("analyticsSummary"),
  analyticsSearchInput: document.getElementById("analyticsSearchInput"),
  analyticsCards: document.getElementById("analyticsCards"),
  analyticsModal: document.getElementById("analyticsModal"),
  analyticsModalTitle: document.getElementById("analyticsModalTitle"),
  analyticsModalBody: document.getElementById("analyticsModalBody"),
  analyticsModalClose: document.getElementById("analyticsModalClose"),
};

const dbPromise = openDatabase();

init().catch((error) => {
  console.error(error);
  alert("Could not initialize the learning portal in this browser.");
});

async function init() {
  applySavedTheme();
  validateTraineeSession();

  wireHeaderAndViews();
  wireTraineeAuth();
  wirePasswordChange();
  wireTraining();
  wireAdmin();
  wirePlayerTracking();

  state.videos = await getAllVideos();
  renderAll();
}

function validateTraineeSession() {
  if (!state.activeTraineeId) {
    return;
  }

  const activeUser = state.users.find((user) => user.id === state.activeTraineeId);
  if (!activeUser || activeUser.status === "disabled") {
    state.activeTraineeId = "";
    localStorage.removeItem(STORAGE_KEYS.traineeSessionUserId);
  }
}

function wireHeaderAndViews() {
  els.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
  });

  els.trainingTabBtn.addEventListener("click", () => switchView("training"));
  els.adminTabBtn.addEventListener("click", () => switchView("admin"));

  els.adminLogoutBtn.addEventListener("click", () => {
    state.isAdminUnlocked = false;
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    updateAdminVisibility();
    updateNavigationVisibility();
    switchView("training");
  });

  els.traineeLogoutBtn.addEventListener("click", () => {
    state.activeTraineeId = "";
    localStorage.removeItem(STORAGE_KEYS.traineeSessionUserId);
    els.passwordChangeMessage.textContent = "";
    clearPlayer();
    renderTraineeVisibility();
    renderVideoCards();
    renderPlayerStatus();
    updateNavigationVisibility();
    switchView("training");
  });

  updateAdminVisibility();
  renderTraineeVisibility();
  updateNavigationVisibility();
  switchView("training");
}

function wireTraineeAuth() {
  els.traineeLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = els.traineeEmail.value.trim().toLowerCase();
    const password = els.traineePassword.value;

    const matchedUser = state.users.find((user) => user.email === email && user.password === password);
    if (!matchedUser) {
      els.traineeGateMessage.textContent = "Invalid trainee credentials. Please try again.";
      return;
    }

    if (matchedUser.status === "disabled") {
      els.traineeGateMessage.textContent = "This employee account is disabled in the GitHub testing build.";
      return;
    }

    state.isAdminUnlocked = false;
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    state.activeTraineeId = matchedUser.id;
    localStorage.setItem(STORAGE_KEYS.traineeSessionUserId, matchedUser.id);
    els.passwordChangeMessage.textContent = "";
    els.traineeGateMessage.textContent = matchedUser.mustChangePassword
      ? "Temporary password accepted. Please create a new password to continue."
      : "";
    els.traineeLoginForm.reset();

    renderTraineeVisibility();
    updateAdminVisibility();
    updateNavigationVisibility();
    renderVideoCards();

    if (!currentVideoId() && state.videos.length > 0) {
      selectVideo(state.videos[0].id);
    } else {
      refreshPlayerPanel();
    }

    switchView("training");
  });
}

function wirePasswordChange() {
  els.passwordChangeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const activeUser = getActiveTrainee();
    if (!activeUser) {
      return;
    }

    const nextPassword = els.newPassword.value.trim();
    const confirmPassword = els.confirmPassword.value.trim();

    if (nextPassword.length < 8) {
      els.passwordChangeMessage.textContent = "Use at least 8 characters for the new password.";
      return;
    }

    if (nextPassword !== confirmPassword) {
      els.passwordChangeMessage.textContent = "The passwords do not match.";
      return;
    }

    activeUser.password = nextPassword;
    activeUser.mustChangePassword = false;
    saveUsers(state.users);

    els.passwordChangeMessage.textContent = "Password updated. You can now use the training modules below.";
    els.passwordChangeForm.reset();
    renderTraineeVisibility();
    renderVideoCards();
    refreshPlayerPanel();
  });
}

function switchView(viewName) {
  if (viewName === "admin" && !state.isAdminUnlocked) {
    viewName = "training";
  }

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

function updateNavigationVisibility() {
  const traineeLoggedIn = Boolean(getActiveTrainee());

  els.adminTabBtn.classList.toggle("hidden", traineeLoggedIn);
  els.trainingTabBtn.classList.toggle("hidden", state.isAdminUnlocked && !traineeLoggedIn);
}

function renderTraineeVisibility() {
  const activeUser = getActiveTrainee();
  const isLoggedIn = Boolean(activeUser);
  const mustChangePassword = Boolean(activeUser?.mustChangePassword);

  els.traineeGate.classList.toggle("hidden", isLoggedIn);
  els.traineeContent.classList.toggle("hidden", !isLoggedIn);
  els.traineeLogoutBtn.classList.toggle("hidden", !isLoggedIn);
  els.passwordChangePanel.classList.toggle("hidden", !mustChangePassword);
  els.trainingWorkspace.classList.toggle("hidden", mustChangePassword);
  if (!mustChangePassword) {
    els.passwordChangeMessage.textContent = "";
  }
  els.activeTraineeDisplay.value = activeUser
    ? `${activeUser.name} (${activeUser.email})${activeUser.status === "disabled" ? " - disabled" : ""}`
    : "";
}

function wireTraining() {
  els.videoSearchInput.addEventListener("input", () => {
    state.searchQuery = els.videoSearchInput.value.trim().toLowerCase();
    renderVideoCards();
  });

  els.completionCheckbox.addEventListener("change", () => {
    const userId = state.activeTraineeId;
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
    renderAnalyticsPanel();
  });
}

function wireAdmin() {
  els.adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = els.adminUsername.value.trim();
    const passcode = els.adminPasscode.value;

    if (username !== ADMIN_CREDENTIALS.username || passcode !== ADMIN_CREDENTIALS.passcode) {
      els.adminGateMessage.textContent = "Invalid credentials. Please try again.";
      return;
    }

    state.isAdminUnlocked = true;
    localStorage.setItem(STORAGE_KEYS.adminSession, "1");
    state.activeTraineeId = "";
    localStorage.removeItem(STORAGE_KEYS.traineeSessionUserId);
    els.adminGateMessage.textContent = "";
    els.adminLoginForm.reset();
    els.passwordChangeMessage.textContent = "";

    updateAdminVisibility();
    renderTraineeVisibility();
    updateNavigationVisibility();
    renderAdminData();
    switchView("admin");
  });

  els.joineeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = els.joineeName.value.trim();
    const email = els.joineeEmail.value.trim().toLowerCase();
    const password = els.joineePassword.value.trim();

    if (!name || !email || !password) {
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
      password,
      status: "active",
      mustChangePassword: true,
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

  els.analyticsSearchInput.addEventListener("input", () => {
    state.analyticsSearchQuery = els.analyticsSearchInput.value.trim().toLowerCase();
    renderAnalyticsPanel();
  });

  els.analyticsModalClose.addEventListener("click", closeAnalyticsModal);
  els.analyticsModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closeAnalyticsModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.analyticsModal.classList.contains("hidden")) {
      closeAnalyticsModal();
    }
  });
}

function wirePlayerTracking() {
  els.trainingPlayer.addEventListener("timeupdate", () => {
    const userId = state.activeTraineeId;
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
    const userId = state.activeTraineeId;
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
    renderAnalyticsPanel();
  });

  els.trainingPlayer.addEventListener("loadedmetadata", () => {
    restorePlaybackPosition();
    renderPlayerStatus();
  });
}

function renderAll() {
  renderTraineeVisibility();
  renderVideoCards();
  renderAdminData();

  if (state.activeTraineeId && !currentVideoId() && state.videos.length > 0) {
    selectVideo(state.videos[0].id);
  } else {
    refreshPlayerPanel();
  }
}

function renderVideoCards() {
  if (!state.activeTraineeId) {
    els.videoCardGrid.innerHTML = "";
    return;
  }

  if (state.videos.length === 0) {
    els.videoCardGrid.innerHTML = '<article class="panel">No training videos uploaded yet.</article>';
    return;
  }

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
      const entry = state.progress[progressKey(state.activeTraineeId, video.id)] || createEmptyProgressEntry();
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
  if (!state.activeTraineeId) {
    return;
  }

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
  if (!state.activeTraineeId) {
    clearPlayerMessages();
    return;
  }

  const videoId = currentVideoId();
  const video = state.videos.find((item) => item.id === videoId);

  if (!video) {
    clearPlayerMessages();
    return;
  }

  els.playerTitle.textContent = video.title;
  els.videoMeta.textContent = video.description || "No description provided.";

  const entry = state.progress[progressKey(state.activeTraineeId, video.id)] || createEmptyProgressEntry();
  updateCompletionControls(entry);
  renderPlayerStatus();
}

function clearPlayerMessages() {
  els.playerTitle.textContent = "Select a module";
  els.videoMeta.textContent = state.activeTraineeId
    ? "Choose a card to start watching."
    : "Login as trainee to access your modules.";
  els.completionCheckbox.checked = false;
  els.completionCheckbox.disabled = true;
  els.completionNote.textContent = "Watch until near the end to enable completion checkbox.";
  els.videoStatus.textContent = "Progress will appear here once playback starts.";
}

function clearPlayer() {
  const oldSrc = els.trainingPlayer.getAttribute("src");
  if (oldSrc && oldSrc.startsWith("blob:")) {
    URL.revokeObjectURL(oldSrc);
  }
  els.trainingPlayer.removeAttribute("src");
  els.trainingPlayer.removeAttribute("data-video-id");
  els.trainingPlayer.load();
}

function updateCompletionControls(entry) {
  const enabled = isEligibleForManualCompletion(entry);
  els.completionCheckbox.disabled = !enabled;
  els.completionCheckbox.checked = Boolean(entry.manualCompleted);
  els.completionNote.textContent = enabled
    ? "You can now check completion for this module."
    : "Watch at least 90% of the video to enable completion checkbox.";
}

function renderPlayerStatus() {
  const userId = state.activeTraineeId;
  const videoId = currentVideoId();

  if (!userId || !videoId) {
    els.videoStatus.textContent = "Select a module to begin.";
    return;
  }

  const entry = state.progress[progressKey(userId, videoId)] || createEmptyProgressEntry();
  const duration = entry.duration || els.trainingPlayer.duration || 0;
  const ratio = duration > 0 ? Math.min(100, (entry.watchedSeconds / duration) * 100) : 0;

  if (entry.manualCompleted) {
    const completionDate = entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "just now";
    els.videoStatus.textContent = `Completed by trainee. Progress ${ratio.toFixed(0)}%. Last completion: ${completionDate}.`;
    return;
  }

  els.videoStatus.textContent = `In progress ${ratio.toFixed(0)}%. Full watches: ${entry.viewCount || 0}.`;
}

function restorePlaybackPosition() {
  const userId = state.activeTraineeId;
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
  renderAnalyticsPanel();
}

function renderJoineeList() {
  if (state.users.length === 0) {
    els.joineeList.innerHTML = "<li>No joinees added yet.</li>";
    return;
  }

  els.joineeList.innerHTML = state.users
    .map(
      (user) =>
        `
          <li>
            <article class="employee-card">
              <div class="employee-card-header">
                <div>
                  <strong>${escapeHtml(user.name)}</strong><br />
                  <span>${escapeHtml(user.email)}</span>
                </div>
                <div class="employee-card-actions">
                  <span class="pill ${user.status === "active" ? "pill-active" : "pill-disabled"}">${escapeHtml(user.status)}</span>
                  ${
                    user.mustChangePassword
                      ? '<span class="pill pill-temp">Temporary password in use</span>'
                      : ""
                  }
                </div>
              </div>
              <div>Testing password: <strong>${escapeHtml(user.password)}</strong></div>
              <div class="employee-inline-fields">
                <input data-reset-password="${user.id}" type="text" placeholder="New temporary password" minlength="8" />
                <button class="secondary-btn" data-reset-user="${user.id}" type="button">Reset Password</button>
                <button class="${user.status === "active" ? "danger-btn" : "secondary-btn"}" data-toggle-user="${user.id}" type="button">
                  ${user.status === "active" ? "Disable Access" : "Enable Access"}
                </button>
              </div>
            </article>
          </li>
        `
    )
    .join("");

  els.joineeList.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = state.users.find((item) => item.id === button.dataset.toggleUser);
      if (!user) {
        return;
      }

      user.status = user.status === "active" ? "disabled" : "active";

      if (user.status === "disabled" && state.activeTraineeId === user.id) {
        state.activeTraineeId = "";
        localStorage.removeItem(STORAGE_KEYS.traineeSessionUserId);
        clearPlayer();
      }

      saveUsers(state.users);
      updateNavigationVisibility();
      renderAll();
    });
  });

  els.joineeList.querySelectorAll("[data-reset-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.dataset.resetUser;
      const passwordInput = els.joineeList.querySelector(`[data-reset-password="${userId}"]`);
      const user = state.users.find((item) => item.id === userId);

      if (!user || !passwordInput) {
        return;
      }

      const nextPassword = passwordInput.value.trim();
      if (nextPassword.length < 8) {
        alert("Use at least 8 characters for the temporary password.");
        return;
      }

      user.password = nextPassword;
      user.mustChangePassword = true;
      user.status = "active";
      saveUsers(state.users);

      if (state.activeTraineeId === user.id) {
        state.activeTraineeId = "";
        localStorage.removeItem(STORAGE_KEYS.traineeSessionUserId);
        clearPlayer();
      }

      updateNavigationVisibility();
      renderAll();
      alert(`Temporary password reset for ${user.name}.`);
    });
  });
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
    els.progressTableBody.innerHTML = "<tr><td colspan='6'>No joinees available.</td></tr>";
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
          <td>${escapeHtml(user.status)}</td>
          <td>${completedCount}/${totalVideos}</td>
          <td>${totalViews}</td>
          <td>${latestCompletion ? new Date(latestCompletion).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderAnalyticsPanel() {
  if (state.users.length === 0) {
    els.analyticsSummary.innerHTML = "";
    els.analyticsCards.innerHTML = '<div class="analytics-empty">No analytics available yet. Add an employee first.</div>';
    return;
  }

  const analytics = state.users.map(getEmployeeAnalyticsData);
  const totalEmployees = analytics.length;
  const totalCompletions = analytics.reduce((sum, item) => sum + item.completed, 0);
  const totalVideos = state.videos.length;
  const averageCompletion = totalEmployees > 0 ? Math.round(analytics.reduce((sum, item) => sum + item.rate, 0) / totalEmployees) : 0;

  els.analyticsSummary.innerHTML = `
    <article class="analytics-stat blue">
      <p class="metric-label">Total Employees</p>
      <p class="metric-value">${totalEmployees}</p>
    </article>
    <article class="analytics-stat cyan">
      <p class="metric-label">Total Completions</p>
      <p class="metric-value">${totalCompletions}</p>
    </article>
    <article class="analytics-stat orange">
      <p class="metric-label">Average Completion</p>
      <p class="metric-value">${averageCompletion}%</p>
    </article>
    <article class="analytics-stat green">
      <p class="metric-label">Total Videos</p>
      <p class="metric-value">${totalVideos}</p>
    </article>
  `;

  const filtered = analytics.filter((item) => {
    if (!state.analyticsSearchQuery) {
      return true;
    }

    const haystack = `${item.user.name} ${item.user.email}`.toLowerCase();
    return haystack.includes(state.analyticsSearchQuery);
  });

  if (filtered.length === 0) {
    els.analyticsCards.innerHTML = '<div class="analytics-empty">No employees match that search.</div>';
    return;
  }

  els.analyticsCards.innerHTML = filtered
    .map((item) => {
      const latestCompletion = item.completions[0];
      return `
        <article class="analytics-employee-card">
          <div class="analytics-employee-head">
            <div>
              <h3 class="analytics-employee-name">${escapeHtml(item.user.name)}</h3>
              <p class="analytics-employee-email">${escapeHtml(item.user.email)}</p>
            </div>
            <div class="analytics-percent">${item.rate}%</div>
          </div>

          <div class="analytics-progress" aria-hidden="true">
            <div class="analytics-progress-bar" style="width: ${item.rate}%"></div>
          </div>

          <p class="analytics-copy">${item.completed} of ${item.totalModules} videos completed</p>

          <div class="analytics-recent">
            <h3>Recent Completions</h3>
            ${
              latestCompletion
                ? renderCompletionItem(latestCompletion)
                : '<p class="analytics-copy">No completed modules yet.</p>'
            }
          </div>

          <button class="analytics-details-btn" data-analytics-user="${item.user.id}" type="button">View Full Details</button>
        </article>
      `;
    })
    .join("");

  els.analyticsCards.querySelectorAll("[data-analytics-user]").forEach((button) => {
    button.addEventListener("click", () => {
      openAnalyticsModal(button.dataset.analyticsUser);
    });
  });
}

function getEmployeeAnalyticsData(user) {
  const totalModules = state.videos.length;
  const completions = state.videos
    .map((video) => {
      const entry = state.progress[progressKey(user.id, video.id)] || createEmptyProgressEntry();
      return {
        video,
        entry,
      };
    })
    .filter((item) => item.entry.manualCompleted)
    .sort((a, b) => new Date(b.entry.completedAt || 0) - new Date(a.entry.completedAt || 0));

  const completed = completions.length;
  const rate = totalModules > 0 ? Math.round((completed / totalModules) * 100) : 0;

  return {
    user,
    totalModules,
    completed,
    rate,
    completions,
  };
}

function renderCompletionItem(item) {
  const title = item.video.fileName || item.video.title;
  return `
    <div class="completion-item">
      <span class="completion-dot">✓</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="completion-meta">${escapeHtml(item.video.title || "")}</div>
        <div class="completion-meta">${item.entry.completedAt ? `Completed: ${new Date(item.entry.completedAt).toLocaleString()}` : ""}</div>
      </div>
    </div>
  `;
}

function openAnalyticsModal(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    return;
  }

  const analytics = getEmployeeAnalyticsData(user);
  els.analyticsModalTitle.textContent = `${user.name} - Completion History`;
  els.analyticsModalBody.innerHTML = analytics.completions.length
    ? analytics.completions
        .map(
          (item) => `
            <article class="modal-completion-card">
              ${renderCompletionItem(item)}
            </article>
          `
        )
        .join("")
    : '<div class="analytics-empty">No completion history yet for this employee.</div>';

  els.analyticsModal.classList.remove("hidden");
}

function closeAnalyticsModal() {
  els.analyticsModal.classList.add("hidden");
}

function getActiveTrainee() {
  return state.users.find((user) => user.id === state.activeTraineeId) || null;
}

function currentVideoId() {
  return els.trainingPlayer.dataset.videoId || "";
}

function isEligibleForManualCompletion(entry) {
  const playerDuration = Number.isFinite(els.trainingPlayer.duration) ? els.trainingPlayer.duration : 0;
  const duration = Math.max(entry.duration || 0, playerDuration);
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
    const users = raw ? JSON.parse(raw) : [];
    return users.map((user) => ({
      id: user.id || crypto.randomUUID(),
      name: user.name || "Unnamed",
      email: (user.email || "").toLowerCase(),
      password: user.password || "Trainee@123",
      status: user.status === "disabled" ? "disabled" : "active",
      mustChangePassword: Boolean(user.mustChangePassword),
      joinedAt: user.joinedAt || new Date().toISOString(),
    }));
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
