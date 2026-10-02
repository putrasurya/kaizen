import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import "antd/dist/reset.css";
import "./utilities.css";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { StoreProvider } from "./redux/store";
import AppUpdatePrompt from "./components/AppUpdatePrompt";

// Modal.confirm() (used by TimerItem's delete/reset confirmations) is a static
// method that renders into its own root outside the component tree, so it
// doesn't inherit the <ConfigProvider> below — it needs the dark theme set here
// too, or its dialog renders with antd's light-theme default.
ConfigProvider.config({ theme: { algorithm: theme.darkAlgorithm } });

const rootElement = document.getElementById("root");
const app = (
  <React.StrictMode>
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <StoreProvider>
        <App />
      </StoreProvider>
      <AppUpdatePrompt />
    </ConfigProvider>
  </React.StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}

function InitializeAudio() {
  const audio = document.createElement('audio');
  audio.src = `${import.meta.env.VITE_BUZZ_WAV}`;
  audio.autoplay = true;
  audio.hidden = true;
  audio.volume = 0;
  audio.id = "buzzbuzz";
  document.getElementById("root").append(audio);
}

InitializeAudio()

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
