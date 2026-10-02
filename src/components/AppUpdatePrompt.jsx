import { useEffect } from "react";
import { Button, notification } from "antd";
import { useRegisterSW } from "virtual:pwa-register/react";

const NOTIFICATION_KEY = "app-update";

// Registers the service worker and, when a new version has been downloaded, asks
// before reloading — an automatic reload would interrupt any running timers.
function AppUpdatePrompt() {
  const [api, contextHolder] = notification.useNotification();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    api.open({
      key: NOTIFICATION_KEY,
      title: "A new version of Kaizen is available",
      description: "Reload to update. Running timers will be paused.",
      duration: 0,
      actions: (
        <Button type="primary" size="small" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
      ),
      onClose: () => setNeedRefresh(false),
    });
  }, [needRefresh, api, setNeedRefresh, updateServiceWorker]);

  return contextHolder;
}

export default AppUpdatePrompt;
