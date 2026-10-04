# Kaizen

A productivity app that pairs weekly timers with quick notes, to help you practice continuous improvement in your daily workflow.

![Kaizen screenshot](./screenshot.png)

## ✨ Features

- **Timers per weekday**: Each timer belongs to a day of the week. Switch days with the day picker; today is selected by default and a dot marks days with a running timer.
- **Copy to days**: Copy a timer's settings to other weekdays in one step (days that already have an identical timer are skipped).
- **Reps**: Each time a timer reaches zero, it buzzes and counts a rep, so you can track how many rounds you've done.
- **Time left**: See the total time remaining across the selected day's timers, plus how many hours are left in today.
- **Reminders**: Quick notes for a weekday that show up again every week on that day.
- **Journal**: A diary entry per date, saved as you type. Each entry shows how your habits went that day, and "Past entries" lists older ones, newest first.
- **Daily habits**: Habits with a set number per day (pray 5×, 8 glasses of water). Tap circles to fill them; earlier days this week can be filled in from the day picker.
- **Routines**: A +/− balance for habits like resisting an urge. A slip (−) is a debt that good taps (+) pay back; the balance starts clear every Monday, with an undo after each tap.
- **Habit history**: A weekly heatmap for daily habits and a weekly owed/ahead bar chart for routines, starting from the week each habit was created.
- **Saved locally**: Timers, notes, habits and journal entries are stored in your browser's localStorage, with automatic migration when the data format changes.
- **Installable PWA**: Works offline and can be installed on desktop or mobile, with a prompt when a new version is available.
- **Responsive**: Larger touch targets and a stacked layout on phones.

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

3. Start the development server:
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
- **State Management**: React Context with `useReducer`, persisted to localStorage
- **Build Tool**: Vite, with `vite-plugin-pwa`
- **Testing**: Vitest, React Testing Library

## 📁 Project Structure

```
src/
├── components/
│   ├── AppTimer.jsx         # Timer list, day picker and time-left summary
│   ├── AppNote.jsx          # Note-taking panel
│   ├── TimerDayPicker.jsx   # Weekday tabs
│   ├── TimerAdd.jsx         # Add-timer form
│   ├── TimerItem.jsx        # A single timer with its controls
│   ├── TimerCountdown.jsx   # Countdown logic and alarm
│   ├── TimerCopy.jsx        # Copy a timer to other days
│   ├── AppUpdatePrompt.jsx  # "New version available" prompt
│   └── ...
├── redux/
│   └── store.jsx            # Context store, reducer, persistence and migrations
├── utilities/               # Day and time helpers
├── App.jsx                  # Main layout
└── index.jsx                # Entry point
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
