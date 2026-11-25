// Newton Productivity & Attendance Tracker - Background Service Worker

const FOCUS_ALARM = "nst_focus_complete";
const BADGE_ALARM = "nst_badge_tick";

function getLocalDateKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeOverallPct(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return null;
  let totalAttended = 0;
  let totalHeld = 0;
  for (const s of subjects) {
    if (typeof s.attended === "number" && typeof s.held === "number") {
      totalAttended += s.attended;
      totalHeld += s.held;
    }
  }
  if (totalHeld === 0) return 100;
  return parseFloat(((totalAttended / totalHeld) * 100).toFixed(1));
}

// Record daily attendance snapshot (last 30 days) and notify on new <75% drops
async function recordAttendanceSnapshot(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return;

  const today = getLocalDateKey();
  const data = await chrome.storage.local.get([
    "attendanceHistory",
    "lastNotifiedBelow75"
  ]);
  const history = data.attendanceHistory || {};
  const prevNotified = new Set(data.lastNotifiedBelow75 || []);

  const subjectMap = {};
  const currentBelow75 = [];
  for (const s of subjects) {
    subjectMap[s.hash] = s.percentage;
    if (s.isBelow75) currentBelow75.push(s);
  }

  history[today] = {
    overallPct: computeOverallPct(subjects),
    subjects: subjectMap,
    updatedAt: Date.now()
  };

  // Prune older than 30 days
  const keys = Object.keys(history).sort();
  while (keys.length > 30) {
    const oldest = keys.shift();
    delete history[oldest];
  }

  // Notify for newly below-75% subjects
  const newlyAtRisk = currentBelow75.filter((s) => !prevNotified.has(s.hash));
  if (newlyAtRisk.length > 0) {
    const names = newlyAtRisk.map((s) => s.name).slice(0, 2).join(", ");
    const extra = newlyAtRisk.length > 2 ? ` +${newlyAtRisk.length - 2} more` : "";
    chrome.notifications.create(`risk_${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Attendance Alert (<75%)",
      message: `${names}${extra} dropped below 75%. Check your recovery plan.`
    });
  }

  await chrome.storage.local.set({
    attendanceHistory: history,
    lastNotifiedBelow75: currentBelow75.map((s) => s.hash)
  });
}

// Update extension toolbar badge based on focus timer or at-risk count
async function updateActionBadge() {
  const data = await chrome.storage.local.get(["focusState", "subjectsAttendance"]);
  const focus = data.focusState;

  if (focus && focus.status === "running" && focus.endTime) {
    const remMs = Math.max(0, focus.endTime - Date.now());
    const remMin = Math.ceil(remMs / 60000);
    await chrome.action.setBadgeText({ text: remMin > 0 ? `${remMin}m` : "0m" });
    await chrome.action.setBadgeBackgroundColor({
      color: focus.mode === "break" ? "#10b981" : "#2563eb"
    });
    return;
  }

  const subjects = data.subjectsAttendance || [];
  const dangerCount = subjects.filter((s) => s.isBelow75).length;
  if (dangerCount > 0) {
    await chrome.action.setBadgeText({ text: String(dangerCount) });
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function completeFocusSession() {
  const data = await chrome.storage.local.get(["focusState", "studySessions"]);
  const focus = data.focusState;
  if (!focus || focus.status !== "running") return;

  const sessions = Array.isArray(data.studySessions) ? data.studySessions : [];
  const minutes = Math.round((focus.durationSec || 1500) / 60);

  if (focus.mode === "focus" && minutes > 0) {
    sessions.push({
      id: `sess_${Date.now()}`,
      subjectHash: focus.subjectHash || "general",
      subjectName: focus.subjectName || "General Study",
      minutes,
      timestamp: Date.now(),
      dateKey: getLocalDateKey()
    });
    // Keep last 200 sessions
    if (sessions.length > 200) {
      sessions.splice(0, sessions.length - 200);
    }
  }

  const title =
    focus.mode === "break" ? "Break Complete!" : "Focus Session Complete!";
  const message =
    focus.mode === "break"
      ? "Break is over. Ready for your next focus block?"
      : `Logged ${minutes}m for ${focus.subjectName || "General Study"}. Great work!`;

  chrome.notifications.create(`focus_${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message
  });

  await chrome.alarms.clear(FOCUS_ALARM);
  await chrome.alarms.clear(BADGE_ALARM);

  await chrome.storage.local.set({
    studySessions: sessions,
    focusState: {
      status: "idle",
      mode: focus.mode || "focus",
      subjectHash: focus.subjectHash || "general",
      subjectName: focus.subjectName || "General Study",
      durationSec: focus.durationSec || 1500,
      remainingSec: focus.durationSec || 1500,
      endTime: null
    }
  });

  await updateActionBadge();
}

chrome.runtime.onInstalled.addListener(() => {
  updateActionBadge();
});

chrome.runtime.onStartup.addListener(() => {
  updateActionBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FOCUS_ALARM) {
    completeFocusSession();
  } else if (alarm.name === BADGE_ALARM) {
    updateActionBadge();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.subjectsAttendance || changes.focusState) {
    updateActionBadge();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === "attendanceUpdated" && Array.isArray(msg.subjects)) {
    recordAttendanceSnapshot(msg.subjects).then(() => {
      updateActionBadge();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === "startFocus") {
    const durationSec = msg.durationSec || 1500;
    const endTime = Date.now() + durationSec * 1000;
    const nextState = {
      status: "running",
      mode: msg.mode || "focus",
      subjectHash: msg.subjectHash || "general",
      subjectName: msg.subjectName || "General Study",
      durationSec: msg.totalDurationSec || durationSec,
      remainingSec: durationSec,
      endTime
    };

    chrome.storage.local.set({ focusState: nextState }, async () => {
      await chrome.alarms.clear(FOCUS_ALARM);
      await chrome.alarms.clear(BADGE_ALARM);
      chrome.alarms.create(FOCUS_ALARM, { when: endTime });
      chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
      await updateActionBadge();
      sendResponse({ ok: true, focusState: nextState });
    });
    return true;
  }

  if (msg.action === "pauseFocus") {
    chrome.storage.local.get(["focusState"], async (data) => {
      const focus = data.focusState;
      if (!focus || focus.status !== "running") {
        sendResponse({ ok: false });
        return;
      }
      const remainingSec = Math.max(
        1,
        Math.ceil((focus.endTime - Date.now()) / 1000)
      );
      const nextState = {
        ...focus,
        status: "paused",
        remainingSec,
        endTime: null
      };
      await chrome.alarms.clear(FOCUS_ALARM);
      await chrome.alarms.clear(BADGE_ALARM);
      await chrome.storage.local.set({ focusState: nextState });
      await updateActionBadge();
      sendResponse({ ok: true, focusState: nextState });
    });
    return true;
  }

  if (msg.action === "resetFocus") {
    const durationSec = msg.durationSec || 1500;
    const nextState = {
      status: "idle",
      mode: msg.mode || "focus",
      subjectHash: msg.subjectHash || "general",
      subjectName: msg.subjectName || "General Study",
      durationSec,
      remainingSec: durationSec,
      endTime: null
    };
    chrome.alarms.clear(FOCUS_ALARM, () => {
      chrome.alarms.clear(BADGE_ALARM, () => {
        chrome.storage.local.set({ focusState: nextState }, async () => {
          await updateActionBadge();
          sendResponse({ ok: true, focusState: nextState });
        });
      });
    });
    return true;
  }
});
