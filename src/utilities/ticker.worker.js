// Ticks once a second from a worker: browsers slow down timers in background
// tabs (down to once a minute after a while), but much less so in workers,
// and a background tab is exactly when its title matters.
setInterval(() => postMessage(Date.now()), 1000);
