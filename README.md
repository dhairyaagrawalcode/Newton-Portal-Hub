# Newton Portal Hub

> A modern, minimal, and powerful Chrome extension crafted for Newton School students to master their attendance, calculate allowable bunks, simulate attendance scenarios, and organize study tasks.

**Author:** Dhairya Agrawal  
**Compatibility:** Google Chrome, Brave, Arc, Edge, and all Chromium-based browsers.

---

## 🌟 Key Features

### 1. 📊 Real-Time Attendance & Stats
* **Overall Metrics**: View total attendance percentage, number of subjects below the 75% mandatory threshold, and safe subjects at a glance.
* **Auto-Sync**: Automatically detects courses and live attendance from the Newton School portal (`my.newtonschool.co`).
* **Offline / Cached Mode**: Never lose your attendance data—stats and tasks remain saved locally in Chrome storage even when offline.

### 2. 🛡️ Risk Management & What-If Simulator
* **Risk Tab**: Instantly filters all subjects currently below 75%.
* **What-If Simulator**: Experiment with upcoming classes without guesswork:
  * Click **`+1 Att`** to see your new percentage if you attend the next lecture.
  * Click **`+1 Miss`** to see the drop if you miss the next lecture.
  * Click **`↺`** to reset the simulation back to live portal numbers.
* **Recovery Guidance**: Displays the exact number of consecutive classes required to return above the 75% safety line (`Need +N classes`).

### 3. 🎯 75% Cutoff & Bunk Calculator
* **Exact Bunk Tracking**: In the **All** tab, safe subjects automatically calculate how many lectures you can afford to miss (`X bunks left`) while strictly remaining at or above the mandatory 75% requirement.
* **75% Visual Indicator**: A subtle, clean vertical marker on each subject's progress track marks the exact 75% threshold.

### 4. 🌐 Website Portal Target Badge
* Configure custom targets (**75%**, **80%**, **85%**, **90%**, or custom) directly at the bottom of the popup.
* The extension injects dynamic, unobtrusive target badges directly into lecture cards on the Newton School web portal (e.g., `• 3 more to attend to reach 85%` or `• Target 85% reached!`).

### 5. ✅ Study Tasks & Productivity
* **Coursework To-Do List**: Add assignments, lab problems, contest questions, and study goals.
* **Subject & Priority Tagging**: Tag tasks to specific subjects or "General", and mark urgent items with `🔥 High` priority.
* **Custom Checkbox**: Smooth, dark-mode native rounded checkbox with checkmark animations.
* **Dynamic Progress Bar**: Modern rounded pill progress bar that transitions from blue to glowing emerald green when 100% of tasks are finished.
* **Filter & Clean**: Filter between **All** and **Done**, and clear completed tasks with a single click.

### 6. 🎨 Modern Minimalist Design & Side Panel
* **Clean Dark & Light Modes**: Seamlessly toggle between dark and light themes with the sun/moon icon.
* **Side Panel Mode**: Open the extension in Chrome's Side Panel (`chrome://side-panel` or via the pin button) to keep your attendance and tasks visible right alongside your lectures and coding workspace.

---

## 🚀 Installation Guide

1. **Clone or Download** this repository to your computer:
   ```bash
   git clone https://github.com/dhairyaagrawalcode/Newton-Portal-Hub
   ```
   *(Or download and extract the ZIP file).*

2. **Open Chrome Extensions Manager**:
   * In Google Chrome, navigate to `chrome://extensions` in the address bar.

3. **Enable Developer Mode**:
   * Toggle the **Developer mode** switch in the top-right corner to **ON**.

4. **Load the Extension**:
   * Click the **Load unpacked** button in the top-left corner.
   * Select the project folder containing `manifest.json` (`Newton Portal Hub`).

5. **Pin the Extension**:
   * Click Chrome's puzzle piece icon (Extensions) in the top-right toolbar and click the **Pin** icon next to **Newton Portal Hub**.

---

## 📖 How to Use

### Step 1: Open Newton School Portal
Log in to your account and open your course dashboard at:
```
https://my.newtonschool.co
```

### Step 2: Open Newton Portal Hub
Click the **Newton Portal Hub** extension icon in your browser toolbar (or open it in the Chrome Side Panel):
* If you are on an active Newton School tab, you will see `● Portal Connected` in the footer.
* The extension automatically synchronizes your live subjects and attendance statistics.
* Click the **Sync** button in the header anytime to force a manual refresh.

### Step 3: Check Risks & Simulate Scenarios
* Switch to the **Risk** tab.
* If any subject is below 75%, it will show up here in red with `Need +N`.
* Use the **`+1 Att`** and **`+1 Miss`** buttons to see how attending or skipping upcoming classes affects your standing.

### Step 4: Check Bunks Remaining
* Switch to the **All** tab.
* Review your subjects. Safe subjects ($\ge 75\%$) will show a green badge indicating exact **bunks left** before dropping below 75%.

### Step 5: Set Portal Target Goals
* Use the **Website Portal Target** box at the bottom of the popup (choose 75%, 80%, 85%, 90% or type a custom number and click **Set**).
* Refresh your Newton School tab to view the updated target badges on your Lecture cards.

### Step 6: Manage Tasks
* Switch to the **Tasks** tab.
* Type your study item in the text field (e.g., `Complete PSP Lab loops question`).
* Choose the subject and priority (`Normal` or `🔥 High`) and click **+ Add** (or press Enter).
* Check off items as you finish them. Click **Clear done** to clean up finished tasks.

---

## 🔒 Permissions & Privacy

This extension respects your privacy:
* **`storage`**: Saves your tasks, target percentage, theme preference, and local attendance snapshot on your computer.
* **`activeTab` / `host_permissions` (`https://my.newtonschool.co/*`)**: Reads your attendance figures from your existing session only when visiting Newton School.
* **`sidePanel`**: Allows opening the extension in Chrome's side panel.
* **`scripting`**: Allows automatic reconnection if the extension is reloaded while the portal tab is open.

> 🛡️ **Zero Tracking**: Your credentials and academic data never leave your browser. All processing, simulations, and storage are done 100% locally on your machine.

---

## 👨‍💻 Author

**Dhairya Agrawal**  
Newton School Student & Developer