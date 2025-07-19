# Kaizen

A modern productivity application that combines timer management with note-taking functionality to help you practice continuous improvement in your daily workflow.

## ✨ Features

- **Timer Management**: Create, manage, and track multiple timers for different tasks
- **Note Taking**: Quick and easy note management with add/delete functionality
- **Time Tracking**: Monitor time spent and remaining time for better productivity
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean interface built with Ant Design components
- **Sound Notifications**: Audio alerts to keep you focused

## 🚀 Quick Start

### Prerequisites

- Node.js (>=18.0.0 <19.0.0)
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

Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## 🛠️ Available Scripts

### `npm start`
Runs the app in development mode with hot reloading enabled.

### `npm test`
Launches the test runner in interactive watch mode.

### `npm run build`
Builds the app for production to the `build` folder. The build is optimized and ready for deployment.

### `npm run eject`
**⚠️ Note: This is a one-way operation. Once you eject, you can't go back!**

Removes the single build dependency and copies all configuration files for full control.

## 🏗️ Technology Stack

- **Frontend**: React 17, JSX
- **UI Framework**: Ant Design 4.16
- **Styling**: CSS Modules, Less
- **State Management**: React Context API
- **Build Tool**: CRACO (Create React App Configuration Override)
- **Testing**: Jest, React Testing Library

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
│   └── store.js        # Application state management
├── App.jsx             # Main application component
└── index.js            # Application entry point
```

## 🐳 Docker Support

The project includes a Dockerfile for containerized deployment:

```bash
# Build the Docker image
docker build -t kaizen .

# Run the container
docker run -p 3000:3000 kaizen
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

- Built with [Create React App](https://github.com/facebook/create-react-app)
- UI components by [Ant Design](https://ant.design/)
- Icons by [Ant Design Icons](https://github.com/ant-design/ant-design-icons)

---

*Kaizen (改善) - Japanese philosophy of continuous improvement in productivity and efficiency.*
