import { useEffect } from "react";
import { tabTitle, useRunningTimers } from "../utilities/running-timers";
import { usePrivacy } from "../redux/privacy";

// While a timer runs, the browser tab shows its countdown, so it can be
// followed from another tab. Renders nothing.
function onEverySecond(callback) {
  if (typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("../utilities/ticker.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = callback;
      return () => worker.terminate();
    } catch {
      // No workers here: plain interval below.
    }
  }
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function TabTitle() {
  const timers = useRunningTimers();
  // With the privacy lock on, the tab shows the time but not what it's for.
  const { enabled: hideNames } = usePrivacy();

  useEffect(() => {
    const original = document.title;
    if (!timers.size) return undefined;
    const update = () => {
      document.title = tabTitle(timers, Date.now(), { hideNames }) ?? original;
    };
    update();
    const stop = onEverySecond(update);
    return () => {
      stop();
      document.title = original;
    };
  }, [timers, hideNames]);

  return null;
}

export default TabTitle;
