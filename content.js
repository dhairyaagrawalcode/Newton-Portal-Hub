// Newton School Attendance Tracker - Content Script

function getClassesNeeded(attended, total, targetX) {
  if (total === 0) return 0;
  const currentPct = (attended / total) * 100;
  if (currentPct >= targetX) return 0;
  if (targetX >= 100) return Infinity;

  // Formula: (A + N) / (T + N) >= X / 100 => N >= (X*T - 100*A) / (100 - X)
  return Math.ceil((targetX * total - 100 * attended) / (100 - targetX));
}

function getMarginClasses(attended, total, targetX = 75) {
  if (total === 0) return 0;
  const currentPct = (attended / total) * 100;
  if (currentPct < targetX) return 0;

  // Formula: A / (T + M) >= X / 100 => M <= (100*A - X*T) / X
  return Math.floor((100 * attended - targetX * total) / targetX);
}

function getAuthToken() {
  try {
    const raw = localStorage.getItem("auth-token");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
    } catch (e) {}
    return raw;
  } catch (e) {
    return null;
  }
}

let cachedSubjects = null;
let isFetching = false;
let lastFetchTime = 0;

// Fetches subject stats in the background for the popup without modifying website UI
async function fetchAllSubjectsAttendance(force = false) {
  if (!chrome.runtime?.id) {
    return cachedSubjects;
  }

  const now = Date.now();
  if (!force && cachedSubjects && now - lastFetchTime < 30000) {
    return cachedSubjects;
  }

  if (isFetching) return cachedSubjects;
  isFetching = true;

  try {
    const token = getAuthToken();
    if (!token) {
      isFetching = false;
      return null;
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    };

    const match = window.location.pathname.match(/\/course\/([^/]+)/);
    const courseHash = match ? match[1] : sessionStorage.getItem("nst_active_course_hash");
    if (!courseHash) {
      isFetching = false;
      return null;
    }
    sessionStorage.setItem("nst_active_course_hash", courseHash);

    // Resolve semester admin course hash
    let semesterHash = courseHash;
    try {
      const redRes = await fetch(
        `${window.location.origin}/api/v1/course/h/${encodeURIComponent(courseHash)}/course_redirection_details/`,
        { headers }
      );
      if (redRes.ok) {
        const redData = await redRes.json();
        semesterHash = redData?.admin_course?.hash || courseHash;
      }
    } catch (err) {
      // Redirection details are optional; fall back to courseHash
      console.debug("[AttendanceTracker] Redirection lookup bypassed:", err);
    }

    // Fetch learning courses for semester
    const coursesRes = await fetch(
      `${window.location.origin}/api/v2/course/h/${encodeURIComponent(semesterHash)}/learning_course/all/?pagination=false`,
      { headers }
    );
    if (!coursesRes.ok) {
      isFetching = false;
      return null;
    }

    const coursesList = await coursesRes.json();
    if (!Array.isArray(coursesList)) {
      isFetching = false;
      return null;
    }

    // Fetch individual performance for each course
    const results = await Promise.all(
      coursesList.map(async (c) => {
        const name = c.short_display_name || c.title || c.hash;
        try {
          const perfRes = await fetch(
            `${window.location.origin}/api/v2/course/h/${encodeURIComponent(c.hash)}/self_performance/`,
            { headers }
          );
          if (perfRes.ok) {
            const perf = await perfRes.json();
            const held = perf.total_lectures;
            const attended = perf.total_lectures_attended;

            if (typeof held === "number" && typeof attended === "number") {
              const pct = held > 0 ? (attended / held) * 100 : 100;
              const roundedPct = parseFloat(pct.toFixed(1));
              const isBelow75 = held > 0 && roundedPct < 75;
              const needed75 = held > 0 ? getClassesNeeded(attended, held, 75) : 0;
              const margin75 = held > 0 && !isBelow75 ? getMarginClasses(attended, held, 75) : 0;

              return {
                hash: c.hash,
                name,
                held,
                attended,
                percentage: roundedPct,
                isBelow75,
                needed75,
                margin75
              };
            }
          }
        } catch (e) {
          console.debug(`[AttendanceTracker] Failed stats for ${name}:`, e);
        }
        return null;
      })
    );

    const validSubjects = results.filter(Boolean);
    cachedSubjects = validSubjects;
    lastFetchTime = Date.now();

    // Cache in Chrome storage for the popup & notify background for snapshots/badge
    if (chrome.runtime?.id) {
      chrome.storage.local.set({
        subjectsAttendance: validSubjects,
        lastUpdated: lastFetchTime
      });

      try {
        chrome.runtime.sendMessage(
          { action: "attendanceUpdated", subjects: validSubjects },
          () => {
            void chrome.runtime.lastError;
          }
        );
      } catch (e) {}
    }

    return validSubjects;
  } catch (err) {
    console.debug("[AttendanceTracker] Failed fetching attendance:", err);
    return null;
  } finally {
    isFetching = false;
  }
}

// Clean up any previously injected extra UI elements if still present
function cleanExtraInjectedUI() {
  const existingAlert = document.getElementById("nst-75-attendance-alert");
  if (existingAlert) existingAlert.remove();

  const existingBadges = document.querySelectorAll(".nst-sidebar-badge");
  existingBadges.forEach((b) => b.remove());
}

// Only modifies the Lecture card (identical to original version)
function updateAttendanceOnPage() {
  cleanExtraInjectedUI();

  if (!chrome.runtime?.id) return;

  try {
    chrome.storage.sync.get(["targetPct"], (data) => {
      if (chrome.runtime.lastError || !chrome.runtime?.id) return;
      const targetPct = data.targetPct || 90;

      const allDivs = document.querySelectorAll("div");

      allDivs.forEach((card) => {
        const text = card.innerText;

        // Match ONLY the Lecture card and explicitly ignore Contests, Quizzes, and Assignments
        if (
          text &&
          text.includes("Lecture") &&
          !text.includes("Contests") &&
          !text.includes("Quizzes") &&
          !text.includes("My Assignments") &&
          /\(\d+\/\d+\)/.test(text)
        ) {
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
          let node;

          while ((node = walker.nextNode())) {
            if (/\(\d+\/\d+\)/.test(node.innerText) && node.children.length === 0) {
              const match = node.innerText.match(/(\d+)\/(\d+)/);
              if (!match) continue;

              const attended = parseInt(match[1]);
              const total = parseInt(match[2]);
              const needed = getClassesNeeded(attended, total, targetPct);

              let badge = node.querySelector(".attendance-target-badge");
              if (!badge) {
                badge = document.createElement("span");
                badge.className = "attendance-target-badge";
                badge.style.marginLeft = "8px";
                badge.style.padding = "2px 6px";
                badge.style.borderRadius = "4px";
                badge.style.fontSize = "12px";
                badge.style.fontWeight = "600";
                badge.style.display = "inline-block";
                node.appendChild(badge);
              }

              if (needed === 0) {
                badge.innerText = `• Target ${targetPct}% reached!`;
                badge.style.backgroundColor = "#d1fae5";
                badge.style.color = "#065f46";
              } else if (needed === Infinity) {
                badge.innerText = `• Impossible to reach ${targetPct}%`;
                badge.style.backgroundColor = "#fee2e2";
                badge.style.color = "#991b1b";
              } else {
                badge.innerText = `• ${needed} more to attend to reach ${targetPct}%`;
                badge.style.backgroundColor = "#e0e7ff";
                badge.style.color = "#3730a3";
              }
            }
          }
        }
      });
    });
  } catch (e) {
    // Ignore context invalidation errors during reloads
  }
}

// Debounced updates for page changes
let debounceTimeout = null;
function debouncedUpdate() {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    updateAttendanceOnPage();
  }, 400);
}

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  const isOurMutation = mutations.every(
    (m) => m.target.classList && m.target.classList.contains("attendance-target-badge")
  );
  if (isOurMutation) return;

  debouncedUpdate();
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateTarget") {
    updateAttendanceOnPage();
    sendResponse({ status: "ok" });
  } else if (request.action === "refreshSubjects" || request.action === "getSubjects") {
    fetchAllSubjectsAttendance(request.action === "refreshSubjects").then((subjects) => {
      sendResponse({ subjects, lastUpdated: lastFetchTime });
    });
    return true; // Keep channel open for async response
  }
});

// Single Page Navigation listener
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    updateAttendanceOnPage();
    fetchAllSubjectsAttendance(true);
  }
}, 1000);

// Initial execution
setTimeout(() => {
  updateAttendanceOnPage();
  fetchAllSubjectsAttendance(true);
}, 1200);
