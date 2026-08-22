import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import "antd/dist/antd.less";
import "./utilities.less";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { StoreProvider } from "./redux/store";

const rootElement = document.getElementById("root");
const app = (
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}

function InitializeAudio() {
  const audio = document.createElement('audio');
  audio.src = `${process.env.REACT_APP_BUZZ_WAV}`;
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
