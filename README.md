# Kaizen

A private, local-first app for daily improvement: plan your days with todos and timers, build habits, reflect in a journal, and keep a record of the milestones you reach each year. Everything stays on your device, with no account and no server.

![Kaizen screenshot](./screenshot.png)

## ✨ Features

### Plan your day

One **day picker** drives the whole page. Today is selected by default, and a dot marks days with a running timer.

- **Todo**: A checklist per weekday. Ticks only count for this week, so every week starts unchecked again. Edit in place, or copy a todo to other weekdays.
- **Timers**: Countdown timers per weekday. When one reaches zero it buzzes, adds a rep and goes back to full time, ready for the next round. Reps are counted per day ("3 reps today · 1 h 30 min") and only go up; the all-time total is in the tooltip. Edit a timer's title and length, start a round over, copy a timer to other days, and see the total time left for the day plus how many hours are left in today.
- **Pomodoro**: Turn on Pomodoro breaks for a timer: a short break after each focus round and a long one every few rounds (5 / 15 min every 4 rounds by default). Breaks can start by themselves or wait for play, and can be skipped. Finished rounds show as 🍅 with the time focused today, and dots show how far you are from the long break.
- **Focus history**: Each timer has a History button that opens a heatmap of time focused per day (12 weeks on a phone, a year on a computer), with a streak, this week against last week, and how many planned days you did. Days a timer isn't planned on are striped so they never look like misses; a day counts as done with at least one finished round. Timers with the same name on different weekdays share one history, and it stays when a timer is deleted or edited. Only focus time is counted, not breaks.
- **Reminders**: Quick notes for a weekday that come back every week on that day, or for every day (tagged "Every day" and listed first on all days).

### Build habits

- **Daily**: Habits with a set number per day (pray 5×, 8 glasses of water). Tap circles to fill them. Earlier days this week can be filled in from the day picker; later days are locked.
- **Routines**: A +/− balance for things like resisting an urge. A slip (−) is a debt that good taps (+) pay back. The balance covers Monday to Sunday and starts clear each week, with an undo after every tap.
- **Auto tap**: A routine can tap for you every N minutes, up to a max per day: +1 (credit) for something you resist, or −1 (debt) for something you should do regularly. A tap the other way restarts the timer. It keeps counting while the app is closed, because the count is worked out from the time when you open it (no server or background task).
- **History**: A weekly heatmap for daily habits and owed/ahead bars for routines, starting from the week each habit was created.

### Reflect

- **Journal**: A diary entry per date, saved as you type. Each entry shows how your habits went that day. *Past entries* lists older ones, newest first.
- **Milestones** (🏆 in the header): Your own record of the year. Write down what you reached (anything, not only habits: a certification, a first 10K) with its date and an optional note, plus the goals still to come. Marking a goal achieved moves it into the timeline. Switch years to look back; goals not reached in earlier years can be brought into the new year or left where they were.

### Keep it private and safe

- **Privacy lock** (🔒 in the header): An optional 4-digit PIN that hides Kaizen when you open it or come back to it (immediately, after 1 minute or after 5 minutes). The screen is covered as soon as you leave the app, and running timers keep going underneath. After 5 wrong tries each further one means a wait, starting at 30 seconds. A forgotten PIN can't be recovered: the only way back in is erasing all Kaizen data on the device, which you agree to when setting it up.
- **Sync with Google Drive** (☁️ in the header): Sign in with Google to keep Kaizen the same on all your devices. Data goes into a hidden Kaizen folder in your own Drive (scope `drive.appdata`): Kaizen can't see your other files and there's no Kaizen server. It syncs when the app opens or comes back on screen, a few seconds after a change, and every few minutes. The same thing edited on two devices keeps the latest edit, while counts (reps, focus time, routine taps) from both devices add up. Deleted items stay deleted (a backup restored with sync on comes back as new items). Each round's progress and the PIN lock stay on each device. Each device writes its own file in that folder and reads the others', so uploads never overwrite each other. A second device that already has data asks whether to use Drive's data or combine both (the same item on both keeps the higher count); either way its data is kept aside first and can be downloaded as a backup from the sync screen. Google's sign-in lasts about an hour without a server, so after that syncing waits for a tap on "Continue syncing".
- **Backup & restore** (💾 in the header): Download everything as `kaizen-backup-YYYY-MM-DD.json`, and restore it on this or another device. Restoring shows what's in the file and asks before replacing anything, offers Undo afterwards, upgrades older backups, and leaves your PIN as it is.
- **Installable PWA**: Works offline and can be installed on desktop or mobile, with a prompt when a new version is available.
- **Responsive**: A single column with larger touch targets on phones; two columns on wider screens.

## 🔐 How your data is stored

- All data lives in your browser's **localStorage**. There's no account, no Kaizen server and no tracking.
- Each browser and device has its own copy. Turn on **Sync with Google Drive** to keep them in step (a copy then also lives in your Drive's hidden app folder), or use **Backup & restore** to move data by hand.
- Clearing site data in the browser deletes everything. Keep a recent backup.
- With sync on, a device whose data is wiped (or erased after a forgotten PIN) gets it back by signing in to Google again. That also means anyone who can use your Google account on a device can get your Kaizen data.
- Use Kaizen in one tab at a time: tabs don't see each other's changes, so the last one to save wins (with or without sync).
- Data is **not encrypted**, and neither are backup files. The privacy lock keeps out people who pick up your device; it isn't encryption. Only a salted PBKDF2 hash of the PIN is stored, never the PIN itself.
- The saved format is versioned and migrated automatically when the app updates, so older data and older backups keep working.

## 🗺️ Roadmap

- **Notifications**: in-app first, then push reminders ([#47](https://github.com/putrasurya/kaizen/issues/47))
- **Unlock with fingerprint or face** ([#51](https://github.com/putrasurya/kaizen/issues/51))
- **Timers that keep running** through a browser reload ([#12](https://github.com/putrasurya/kaizen/issues/12))

## 🚀 Quick Start

### Prerequisites

- Node.js ^22.22.2, ^24.15.0, or >=26.0.0 (required by the test environment, jsdom)
- npm (>=8.0.0)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/putrasurya/kaizen.git
cd kaizen
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) To try Google Drive sync, create `.env.local` with a Google OAuth client ID (Web application, with `http://localhost:5173` as an authorized JavaScript origin and the Drive API enabled):
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```
Without it, the sync button is simply hidden. Deployments set the same variable (Vercel project settings; a GitHub Actions variable for the workflow build).

4. Start the development server:
```bash
npm start
```

Open [http://localhost:5173](http://localhost:5173) to view the app in your browser.

## 🛠️ Available Scripts

### `npm start`
Runs the app in development mode with hot module reloading.

### `npm test`
Runs the test suite once (CI-friendly). Use `npx vitest` for interactive watch mode.

### `npm run build`
Builds the app for production into the `build` folder, including the PWA service worker.

## 🏗️ Technology Stack

- **Frontend**: React 19, JSX
- **UI Framework**: Ant Design 6
- **Styling**: CSS Modules, CSS-in-JS (via Ant Design)
- **State Management**: React Context with `useReducer`, persisted to localStorage with versioned migrations
- **Security**: Web Crypto API (PBKDF2) for the privacy lock PIN
- **Build Tool**: Vite, with `vite-plugin-pwa`
- **Testing**: Vitest, React Testing Library

## 📁 Project Structure

```
src/
├── components/
│   ├── DayPicker.jsx          # Weekday picker that drives every section
│   ├── AppTodo.jsx            # Weekly todo checklist
│   ├── AppTimer.jsx           # Timer list and time-left summary
│   ├── TimerItem.jsx          # A single timer: rounds, reps, Pomodoro breaks
│   ├── TimerForm.jsx          # Add / edit timer dialog
│   ├── TimerHistory.jsx       # Per-timer focus heatmap
│   ├── TimerCountdown.jsx     # Countdown clock (keeps time in the background)
│   ├── AppNote.jsx            # Reminders
│   ├── AppHabits.jsx          # Daily habits and Routines (incl. auto tap status)
│   ├── HabitForm.jsx          # Add/edit a habit, auto tap settings
│   ├── HabitHistory.jsx       # Weekly heatmap and owed/ahead bars
│   ├── AppJournal.jsx         # Journal entry per date, past entries
│   ├── Milestones.jsx         # Yearly milestones and goals
│   ├── LockScreen.jsx         # Privacy lock screen and "forgot PIN"
│   ├── PrivacySettings.jsx    # Set up, change or turn off the PIN
│   ├── PinPad.jsx             # 4-digit PIN pad
│   ├── BackupSettings.jsx     # Download and restore backups
│   ├── AppUpdatePrompt.jsx    # "New version available" prompt
│   └── ...
├── redux/
│   ├── store.jsx              # App state, reducer, persistence, migrations, backups
│   ├── day.jsx                # Selected day and today's date
│   └── privacy.jsx            # Lock state, hide on leave, re-lock timing
├── sync/
│   ├── engine.js              # Records changes and merges two devices' copies
│   ├── cycle.js               # One sync: read Drive, merge, apply, write back
│   ├── drive.js               # The sync file in Drive's hidden app folder
│   ├── google-auth.js         # Google sign-in (token flow, no server)
│   └── SyncProvider.jsx       # When to sync, status for the UI
├── utilities/
│   ├── auto-tap.js            # Auto tap counts, worked out from time
│   ├── habit-helper.js        # Week math, balances, day summaries
│   ├── privacy-lock.js        # PIN hashing, wait times, erase
│   ├── day-helper.js          # Weekday and date helpers
│   ├── focus.js               # Focus log: time and rounds per day, streaks
│   ├── time-helper.js         # Time formatting
│   └── useNow.js              # Re-render on a clock tick and on focus
├── App.jsx                    # Main layout and header buttons
└── index.jsx                  # Entry point
```

## 🐳 Docker Support

The project includes a Dockerfile for containerized deployment:

```bash
# Build the Docker image
docker build -t kaizen:v1.0 .

# Run the container
docker run -p 8080:80 kaizen:v1.0
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Vite](https://vite.dev/)
- UI components by [Ant Design](https://ant.design/)
- Icons by [Ant Design Icons](https://github.com/ant-design/ant-design-icons)

---

*Kaizen (改善) - Japanese philosophy of continuous improvement in productivity and efficiency.*
