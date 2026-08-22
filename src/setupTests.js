// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Modal } from 'antd';

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
