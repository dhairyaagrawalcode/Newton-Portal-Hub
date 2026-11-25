document.addEventListener("DOMContentLoaded", () => {
  // Header & Metrics
  const themeBtn = document.getElementById("themeBtn");
  const sidePanelBtn = document.getElementById("sidePanelBtn");
  const syncBtn = document.getElementById("syncBtn");
  const syncIcon = document.getElementById("syncIcon");

  const metricOverall = document.getElementById("metricOverall");
  const metricDanger = document.getElementById("metricDanger");
  const metricSafe = document.getElementById("metricSafe");

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = {
    alerts: document.getElementById("tabAlertsContent"),
    all: document.getElementById("tabAllContent"),
    tasks: document.getElementById("tabTasksContent"),
  };
  const goalBox = document.getElementById("goalBox");
  const alertsCountBadge = document.getElementById("alertsCountBadge");
  const allCountBadge = document.getElementById("allCountBadge");
  const tasksCountBadge = document.getElementById("tasksCountBadge");

  // Attendance Containers & Goal Controls
  const alertsContainer = document.getElementById("alertsContainer");
  const allSubjectsContainer = document.getElementById("allSubjectsContainer");
  const targetInput = document.getElementById("targetInput");
  const saveBtn = document.getElementById("saveBtn");
  const currentGoalLabel = document.getElementById("currentGoalLabel");
  const goalChips = document.querySelectorAll(".goal-chip");

  // Tasks Elements
  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const taskSubjectSelect = document.getElementById("taskSubjectSelect");
  const taskPrioritySelect = document.getElementById("taskPrioritySelect");
  const taskProgressLabel = document.getElementById("taskProgressLabel");
  const taskProgressFill = document.getElementById("taskProgressFill");
  const filterChips = document.querySelectorAll(".filter-chip");
  const clearDoneBtn = document.getElementById("clearDoneBtn");
  const tasksContainer = document.getElementById("tasksContainer");

  // Footer
  const pulseDot = document.getElementById("pulseDot");
  const statusText = document.getElementById("statusText");
  const syncTime = document.getElementById("syncTime");

  // State
  let currentTargetPct = 85;
  let cachedSubjects = [];
  let cachedHistory = {};
  let whatIfOffsets = {}; // { [hash]: { attendedDelta: number, heldDelta: number } }
  let tasks = [];
  let taskFilter = "all";

  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Helpers
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getLocalDateKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseTimeMinutes(timeStr) {
    if (!timeStr) return 0;
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3] ? m[3].toUpperCase() : "";
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }

  function formatMinutes(totalMin) {
    if (!totalMin || totalMin <= 0) return "0m";
    if (totalMin < 60) return `${totalMin}m`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  function formatRelativeTime(ts) {
    if (!ts) return "Not synced";
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    return `${hrs}h ago`;
  }

  function getClassesNeeded(attended, total, targetX) {
    if (total === 0) return 0;
    const currentPct = (attended / total) * 100;
    if (currentPct >= targetX) return 0;
    if (targetX >= 100) return Infinity;
    return Math.ceil((targetX * total - 100 * attended) / (100 - targetX));
  }

  function getMarginClasses(attended, total, targetX) {
    if (total === 0) return 0;
    const currentPct = (attended / total) * 100;
    if (currentPct < targetX) return 0;
    return Math.floor((100 * attended - targetX * total) / targetX);
  }

  // Theme
  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  themeBtn.addEventListener("click", () => {
    const next =
      document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    chrome.storage.sync.set({ theme: next });
  });

  // Side Panel dock button
  sidePanelBtn.addEventListener("click", async () => {
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
      statusText.innerText = "Side panel unsupported";
      return;
    }
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (e) {
      statusText.innerText = "Open via Chrome Side Panel";
    }
  });

  // Tab switching
  function switchTab(targetTab) {
    tabBtns.forEach((b) => {
      if (b.getAttribute("data-tab") === targetTab) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    Object.entries(tabContents).forEach(([key, el]) => {
      if (el) el.style.display = key === targetTab ? "block" : "none";
    });

    goalBox.style.display =
      targetTab === "alerts" || targetTab === "all" ? "block" : "none";
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  // Goal Target Management
  function updateGoalChips(val) {
    goalChips.forEach((chip) => {
      if (parseInt(chip.getAttribute("data-val"), 10) === val) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });
  }

  function setTarget(val) {
    if (isNaN(val) || val <= 0 || val > 100) return;
    currentTargetPct = val;
    targetInput.value = val;
    currentGoalLabel.innerText = `${val}%`;
    updateGoalChips(val);

    chrome.storage.sync.set({ targetPct: val }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (
          activeTab &&
          activeTab.url &&
          activeTab.url.includes("my.newtonschool.co")
        ) {
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "updateTarget" },
            () => {
              void chrome.runtime.lastError;
            },
          );
        }
      });

      renderSubjects(cachedSubjects);
      saveBtn.innerText = "Saved!";
      setTimeout(() => {
        saveBtn.innerText = "Set";
      }, 900);
    });
  }

  goalChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      setTarget(parseInt(chip.getAttribute("data-val"), 10));
    });
  });

  saveBtn.addEventListener("click", () => {
    setTarget(parseFloat(targetInput.value));
  });

  // Populate Subject Dropdowns (for Tasks)
  function populateSubjectSelects(subjects) {
    const prevTaskVal = taskSubjectSelect.value;

    const optionsHtml = subjects
      .map(
        (s) =>
          `<option value="${escapeHtml(s.hash)}">${escapeHtml(s.name)}</option>`,
      )
      .join("");

    taskSubjectSelect.innerHTML = `<option value="general">General</option>${optionsHtml}`;

    if ([...taskSubjectSelect.options].some((o) => o.value === prevTaskVal)) {
      taskSubjectSelect.value = prevTaskVal;
    }
  }

  // Render Attendance Subjects & Metrics
  function renderSubjects(subjects, timestamp) {
    if (timestamp) {
      syncTime.innerText = `Synced ${formatRelativeTime(timestamp)}`;
    }

    if (!subjects || !subjects.length) {
      metricOverall.innerText = "-";
      metricDanger.innerText = "0";
      metricSafe.innerText = "0";
      alertsCountBadge.innerText = "0";
      allCountBadge.innerText = "0";

      const emptyPortalHtml = `
        <div class="empty-box">
          <div style="font-size: 26px; margin-bottom: 8px;">🎓</div>
          <div style="font-weight: 700; color: var(--text); margin-bottom: 5px; font-size: 14.5px;">No Portal Data Yet</div>
          <div style="margin-bottom: 12px; font-size: 12.5px;">Open your Newton School portal to automatically sync all subjects.</div>
          <a href="https://my.newtonschool.co" target="_blank" style="display:inline-block; background:var(--primary); color:#fff; padding:7px 16px; border-radius:6px; font-size:12px; font-weight:700; text-decoration:none;">Open Portal</a>
        </div>
      `;
      alertsContainer.innerHTML = emptyPortalHtml;
      allSubjectsContainer.innerHTML = emptyPortalHtml;
      return;
    }

    let totalAttended = 0;
    let totalHeld = 0;
    subjects.forEach((s) => {
      totalAttended += s.attended;
      totalHeld += s.held;
    });
    const overallPct =
      totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(1) : "100";
    metricOverall.innerText = `${overallPct}%`;

    const below75 = subjects.filter((s) => s.isBelow75);
    const safeCount = subjects.length - below75.length;

    metricDanger.innerText = below75.length;
    metricSafe.innerText = safeCount;
    alertsCountBadge.innerText = below75.length;
    allCountBadge.innerText = subjects.length;

    // Tab 1: Risk (<75%) with What-If simulator
    if (below75.length > 0) {
      alertsContainer.innerHTML = below75
        .map((s) => {
          const offset = whatIfOffsets[s.hash] || {
            attendedDelta: 0,
            heldDelta: 0,
          };
          const simAtt = Math.max(0, s.attended + offset.attendedDelta);
          const simHeld = Math.max(0, s.held + offset.heldDelta);
          const simPct =
            simHeld > 0
              ? parseFloat(((simAtt / simHeld) * 100).toFixed(1))
              : 100;
          const simNeeded = getClassesNeeded(simAtt, simHeld, 75);
          const pctBar = Math.min(Math.max(simPct, 0), 100);
          const isSim = offset.heldDelta !== 0;

          return `
          <div class="danger-card">
            <div class="card-head-row">
              <span class="card-subj-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
              <span class="pct-pill danger">${simPct}%${isSim ? " *" : ""}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${simPct >= 75 ? "green" : "red"}" style="width: ${pctBar}%;"></div>
              <div class="target-marker" style="left: 75%;" title="75% Minimum"></div>
            </div>
            <div class="card-bottom-row">
              <div class="card-meta-left">
                <span class="count-text">${simAtt}/${simHeld} attended</span>
                <span class="sep-dot">•</span>
                ${
                  simNeeded === 0
                    ? `<span class="status-badge safe">Safe (≥75%)</span>`
                    : `<span class="status-badge danger">Need +${simNeeded}</span>`
                }
              </div>
              <div class="sim-controls">
                <button type="button" class="sim-btn" data-hash="${escapeHtml(s.hash)}" data-act="attend" title="Simulate attending next class">+1 Att</button>
                <button type="button" class="sim-btn" data-hash="${escapeHtml(s.hash)}" data-act="miss" title="Simulate missing next class">+1 Miss</button>
                ${isSim ? `<button type="button" class="sim-btn reset" data-hash="${escapeHtml(s.hash)}" data-act="reset" title="Reset simulator">↺</button>` : ""}
              </div>
            </div>
          </div>`;
        })
        .join("");
    } else {
      alertsContainer.innerHTML = `
        <div class="safe-state-card">
          <div class="safe-icon">🎉</div>
          <div class="safe-title">All Subjects Above 75%!</div>
          <div class="safe-desc">You are maintaining the mandatory attendance requirement across all ${subjects.length} subjects.</div>
        </div>
      `;
    }

    // Tab 2: All Subjects (evaluated strictly against 75% cutoff)
    allSubjectsContainer.innerHTML = subjects
      .map((s) => {
        const pct = Math.min(Math.max(s.percentage, 0), 100);
        const isBelow75 = s.isBelow75;
        const fillClass = isBelow75 ? "red" : "green";
        const pillClass = isBelow75 ? "danger" : "success";

        const needed75 =
          s.held > 0
            ? getClassesNeeded(s.attended, s.held, 75)
            : 0;
        const margin75 =
          s.held > 0 && !isBelow75
            ? getMarginClasses(s.attended, s.held, 75)
            : 0;

        const statusTextHtml = isBelow75
          ? `<span class="bunk-status danger">Need +${needed75 === Infinity ? "∞" : needed75}</span>`
          : `<span class="bunk-status success">${margin75} bunk${margin75 === 1 ? "" : "s"} left</span>`;

        return `
        <div class="subject-row-card">
          <div class="card-head-row">
            <span class="card-subj-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
            <span class="pct-pill ${pillClass}">${s.percentage}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${fillClass}" style="width: ${pct}%;"></div>
            <div class="target-marker" style="left: 75%;" title="75% Cutoff"></div>
          </div>
          <div class="card-bottom-row">
            <span class="count-text">${s.attended}/${s.held} attended</span>
            ${statusTextHtml}
          </div>
        </div>`;
      })
      .join("");
  }

  // What-If click handler (event delegation)
  alertsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".sim-btn");
    if (!btn) return;
    const hash = btn.getAttribute("data-hash");
    const act = btn.getAttribute("data-act");
    const curr = whatIfOffsets[hash] || { attendedDelta: 0, heldDelta: 0 };

    if (act === "attend") {
      whatIfOffsets[hash] = {
        attendedDelta: curr.attendedDelta + 1,
        heldDelta: curr.heldDelta + 1,
      };
    } else if (act === "miss") {
      whatIfOffsets[hash] = {
        attendedDelta: curr.attendedDelta,
        heldDelta: curr.heldDelta + 1,
      };
    } else if (act === "reset") {
      delete whatIfOffsets[hash];
    }
    renderSubjects(cachedSubjects);
  });

  // Tasks Rendering & Logic
  function renderTasks() {
    const pendingCount = tasks.filter((t) => !t.done).length;
    const doneCount = tasks.length - pendingCount;
    tasksCountBadge.innerText = pendingCount;

    taskProgressLabel.innerText = `${doneCount} / ${tasks.length} done`;
    const pct =
      tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
    taskProgressFill.style.width = `${pct}%`;

    if (pct === 100 && tasks.length > 0) {
      taskProgressFill.style.background =
        "linear-gradient(90deg, #10b981, #34d399)";
      taskProgressFill.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.4)";
    } else {
      taskProgressFill.style.background =
        "linear-gradient(90deg, var(--primary), #60a5fa)";
      taskProgressFill.style.boxShadow = "none";
    }

    if (clearDoneBtn) {
      clearDoneBtn.style.display = doneCount > 0 ? "inline-block" : "none";
    }

    const visible = tasks.filter((t) => {
      if (taskFilter === "done") return t.done;
      return true;
    });

    if (visible.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-tasks-card">
          <div class="empty-icon">📝</div>
          <div class="empty-title">${
            tasks.length === 0 ? "No tasks yet" : "No completed tasks yet"
          }</div>
          <div>${
            tasks.length === 0
              ? "Add study goals, lab questions, or assignments above."
              : "Switch to All to view your tasks."
          }</div>
        </div>`;
      return;
    }

    tasksContainer.innerHTML = visible
      .map(
        (t) => `
        <div class="task-item-card ${t.done ? "done" : ""}">
          <label class="custom-checkbox-wrap" title="${t.done ? "Mark as active" : "Mark as done"}">
            <input type="checkbox" class="task-check-hidden task-check" data-id="${escapeHtml(t.id)}" ${t.done ? "checked" : ""} />
            <span class="custom-checkbox-box">
              <svg class="check-icon" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </label>
          <div class="task-body-content">
            <div class="task-title-text">${escapeHtml(t.title)}</div>
            <div class="task-meta-tags">
              <span class="task-tag">${escapeHtml(t.subjectName || "General")}</span>
              ${t.priority === "high" ? `<span class="task-tag priority-high">🔥 High</span>` : ""}
            </div>
          </div>
          <button type="button" class="task-delete-icon-btn" data-del="${escapeHtml(t.id)}" title="Delete task">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="3" x2="13" y2="13"></line>
              <line x1="13" y1="3" x2="3" y2="13"></line>
            </svg>
          </button>
        </div>
      `,
      )
      .join("");
  }

  function saveTasks() {
    chrome.storage.local.set({ productivityTasks: tasks });
    renderTasks();
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;

    const subjectHash = taskSubjectSelect.value;
    const subjectName =
      taskSubjectSelect.options[taskSubjectSelect.selectedIndex]?.text ||
      "General";
    const priority = taskPrioritySelect.value;

    tasks.unshift({
      id: `task_${Date.now()}`,
      title,
      subjectHash,
      subjectName,
      priority,
      done: false,
      createdAt: Date.now(),
    });
    taskInput.value = "";
    saveTasks();
  });

  tasksContainer.addEventListener("change", (e) => {
    if (!e.target.classList.contains("task-check")) return;
    const id = e.target.getAttribute("data-id");
    const item = tasks.find((t) => t.id === id);
    if (item) {
      item.done = e.target.checked;
      saveTasks();
    }
  });

  tasksContainer.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-del");
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
  });

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      taskFilter = chip.getAttribute("data-filter");
      renderTasks();
    });
  });

  clearDoneBtn.addEventListener("click", () => {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
  });

  // Sync with Portal
  function syncWithPortal(force = false) {
    syncIcon.classList.add("spinning");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const isNewton =
        activeTab &&
        activeTab.url &&
        activeTab.url.includes("my.newtonschool.co");

      if (isNewton) {
        statusText.innerText = "Portal Connected";
        pulseDot.classList.remove("offline");

        const sendFetch = (tabId, retried = false) => {
          chrome.tabs.sendMessage(
            tabId,
            { action: force ? "refreshSubjects" : "getSubjects" },
            (response) => {
              if (chrome.runtime.lastError) {
                if (
                  !retried &&
                  chrome.scripting &&
                  chrome.scripting.executeScript
                ) {
                  chrome.scripting.executeScript(
                    { target: { tabId }, files: ["content.js"] },
                    () => {
                      if (chrome.runtime.lastError) {
                        syncIcon.classList.remove("spinning");
                        statusText.innerText =
                          "Please refresh Newton tab to sync";
                        return;
                      }
                      setTimeout(() => sendFetch(tabId, true), 300);
                    },
                  );
                  return;
                }
                syncIcon.classList.remove("spinning");
                statusText.innerText = "Please refresh page to sync";
                return;
              }

              syncIcon.classList.remove("spinning");
              if (response && response.subjects) {
                cachedSubjects = response.subjects;
                populateSubjectSelects(cachedSubjects);
                renderSubjects(
                  cachedSubjects,
                  response.lastUpdated || Date.now(),
                );
              }
            },
          );
        };

        sendFetch(activeTab.id);
      } else {
        syncIcon.classList.remove("spinning");
        statusText.innerText = "Cached mode";
        pulseDot.classList.add("offline");
      }
    });
  }

  syncBtn.addEventListener("click", () => syncWithPortal(true));

  // React to background storage updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.attendanceHistory && changes.attendanceHistory.newValue) {
      cachedHistory = changes.attendanceHistory.newValue;
      renderSubjects(cachedSubjects);
    }
  });

  // Initial Load
  chrome.storage.sync.get(["targetPct", "theme"], (syncData) => {
    if (syncData.theme) {
      applyTheme(syncData.theme);
    }
    if (syncData.targetPct) {
      currentTargetPct = syncData.targetPct;
      targetInput.value = syncData.targetPct;
      currentGoalLabel.innerText = `${syncData.targetPct}%`;
      updateGoalChips(syncData.targetPct);
    }
  });

  chrome.storage.local.get(
    [
      "subjectsAttendance",
      "lastUpdated",
      "attendanceHistory",
      "productivityTasks",
    ],
    (res) => {
      cachedHistory = res.attendanceHistory || {};
      cachedSubjects = res.subjectsAttendance || [];
      tasks = Array.isArray(res.productivityTasks) ? res.productivityTasks : [];

      populateSubjectSelects(cachedSubjects);
      renderSubjects(cachedSubjects, res.lastUpdated);
      renderTasks();
      syncWithPortal(false);
    },
  );
});
