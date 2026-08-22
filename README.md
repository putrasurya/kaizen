# Kaizen

A modern productivity application that combines timer management with note-taking functionality to help you practice continuous improvement in your daily workflow.

![Kaizen Demo](./screenshot.png)

## ✨ Features

- **Timer Management**: Create, manage, and track multiple timers for different tasks
- **Note Taking**: Quick and easy note management with add/delete functionality
- **Time Tracking**: Monitor time spent and remaining time for better productivity
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean interface built with Ant Design components
- **Sound Notifications**: Audio alerts to keep you focused

## 🚀 Quick Start

### Prerequisites

- Node.js (^20.19.0 or >=22.12.0)
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
Runs the app in development mode with hot module reloading enabled.

### `npm test`
Runs the test suite once (CI-friendly). Use `npx vitest` for interactive watch mode.

### `npm run build`
Builds the app for production to the `build` folder. The build is optimized and ready for deployment.

## 🏗️ Technology Stack

- **Frontend**: React 19, JSX
- **UI Framework**: Ant Design 6
- **Styling**: CSS Modules, CSS-in-JS (via Ant Design)
- **State Management**: React Context API
- **Build Tool**: Vite
- **Testing**: Vitest, React Testing Library

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AppTimer.jsx    # Timer management component
│   ├── AppNote.jsx     # Note-taking component
│   ├── TimerAdd.jsx    # Add new timer form
│   ├── TimerItem.jsx   # Individual timer display
│   └── ...
├── redux/
│   └── store.jsx       # Application state management
├── App.jsx             # Main application component
└── index.jsx           # Application entry point
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
