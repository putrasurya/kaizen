// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Modal } from 'antd';

// antd 6's CSS-in-JS style injection adds real per-interaction overhead (a form
// field click can take several real seconds on a loaded machine), enough to
// brush against Jest's 5000ms default per-test timeout under full-suite
// contention even though nothing is actually hung.
jest.setTimeout(20000);

// The jsdom version bundled with this project's Jest doesn't implement
// MessageChannel, which antd 6's Form internals (@rc-component/form) use to
// schedule field-watcher notifications. Node's own worker_threads.MessageChannel
// works but uses real OS-level message ports that don't reliably fire (or tear
// down) inside jsdom's test environment, causing tests to hang — this minimal
// setTimeout-based polyfill is enough for same-thread postMessage/onmessage use.
if (typeof globalThis.MessageChannel === 'undefined') {
  class FakeMessagePort {
    postMessage(data) {
      setTimeout(() => this._other?.onmessage?.({ data }), 0);
    }
  }
  globalThis.MessageChannel = class FakeMessageChannel {
    constructor() {
      this.port1 = new FakeMessagePort();
      this.port2 = new FakeMessagePort();
      this.port1._other = this.port2;
      this.port2._other = this.port1;
    }
  };
}

// jsdom doesn't implement ResizeObserver, which antd 6's Typography ellipsis
// measurement (used by TimerItem's title) relies on.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// antd's responsiveObserve reads window.matchMedia at module-import time, so this
// must run in setupFiles (before any test file's imports), not in a per-test
// beforeAll. This is a plain function, not jest.fn(): CRA's jest preset sets
// resetMocks: true, which strips mockImplementation() off every jest.fn() before
// each test — including ones configured once here in setupFilesAfterEnv.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement media playback; TimerCountdown's Buzz() calls .play() on
// the #buzzbuzz audio element when a countdown completes. Kept as jest.fn() (reset
// before each test, but that's fine here — production code never uses the return
// value, tests only assert it was called).
window.HTMLMediaElement.prototype.play = jest.fn();
window.HTMLMediaElement.prototype.pause = jest.fn();

// Mirrors src/index.js's InitializeAudio(), which normally creates this element at
// app startup. Components render in isolation in tests, so provide it globally.
beforeEach(() => {
  if (!document.getElementById('buzzbuzz')) {
    const audio = document.createElement('audio');
    audio.id = 'buzzbuzz';
    audio.hidden = true;
    document.body.appendChild(audio);
  }
});

afterEach(() => {
  document.getElementById('buzzbuzz')?.remove();
  // Modal.confirm()/Modal.method() (used by TimerItem's delete/reset confirmations)
  // mount into their own DOM node appended to document.body, outside the React root
  // that Testing Library's automatic cleanup unmounts — so they leak into later tests
  // unless explicitly destroyed here. Its DOM node removal is still driven by a CSS
  // close transition that never completes under jsdom (no real transitionend
  // events), so a hidden/stale confirm dialog node can briefly coexist with a new
  // one — tests should locate "their" dialog by its title text, not assume it's the
  // only one with role="dialog".
  Modal.destroyAll();
});
