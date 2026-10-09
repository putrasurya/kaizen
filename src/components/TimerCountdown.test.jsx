import { useContext, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TimerCountdown from './TimerCountdown';
import { StoreProvider, store } from '../redux/store';

// TimerCountdown is a clock: it reports progress (onProgress) and reaching zero
// (onFinish); the timer card decides what happens next. This harness plays the
// card's part: it stops on finish and counts finishes.
function Harness({ seconds, secondsSpent = 0, initialPlay = false, onFinish }) {
  const [play, setPlay] = useState(initialPlay);
  const [finished, setFinished] = useState(0);
  return (
    <div>
      <span data-testid="play-state">{String(play)}</span>
      <span data-testid="finished">{finished}</span>
      <TimerCountdown
        play={play}
        seconds={seconds}
        secondsSpent={secondsSpent}
        onFinish={() => {
          setFinished((n) => n + 1);
          setPlay(false);
          onFinish?.();
        }}
      />
    </div>
  );
}

// Progress saved to the store, like TimerItem does.
function Live({ initialPlay = true, withToggle = false }) {
  const { timers, updateSecondsSpent } = useContext(store);
  const [play, setPlay] = useState(initialPlay);
  return (
    <>
      {withToggle && <button onClick={() => setPlay((p) => !p)}>toggle</button>}
      <TimerCountdown
        play={play}
        seconds={600}
        secondsSpent={timers[0].secondsSpent}
        onProgress={(secs) => updateSecondsSpent(1, secs)}
        onFinish={() => setPlay(false)}
      />
    </>
  );
}

function renderCountdown(props) {
  return render(
    <StoreProvider>
      <Harness {...props} />
    </StoreProvider>
  );
}

test('shows the remaining time derived from seconds/secondsSpent on mount', () => {
  renderCountdown({ seconds: 3665, secondsSpent: 0 });
  // 3665s = 1h 1m 5s remaining, rendered as "1.01" plus a small ".05".
  expect(screen.getByText('1.01')).toBeInTheDocument();
  expect(screen.getByText('.05')).toBeInTheDocument();
});

test('a paused timer that has partly run shows what is left on mount (e.g. after the app was reloaded)', () => {
  // 25 of 60 minutes used: 35 minutes left, not 0.00.00.
  renderCountdown({ seconds: 3600, secondsSpent: 1500 });
  expect(screen.getByText('0.35')).toBeInTheDocument();
  expect(screen.getByText('.00')).toBeInTheDocument();
});

test('while paused, the display follows saved progress when it changes', () => {
  const view = renderCountdown({ seconds: 600, secondsSpent: 0 });
  expect(screen.getByText('0.10')).toBeInTheDocument();
  view.rerender(
    <StoreProvider>
      <Harness seconds={600} secondsSpent={125} />
    </StoreProvider>
  );
  expect(screen.getByText('0.07')).toBeInTheDocument();
  expect(screen.getByText('.55')).toBeInTheDocument();
});

test('a finished timer shows zero', () => {
  renderCountdown({ seconds: 600, secondsSpent: 600 });
  expect(screen.getByText('0.00')).toBeInTheDocument();
  expect(screen.getByTestId('play-state')).toHaveTextContent('false');
});

test(
  'ticks the display down while playing',
  async () => {
    renderCountdown({ seconds: 30, secondsSpent: 0, initialPlay: true });
    // hour/minute ("0.00") and seconds (".30", in a nested <small>) are separate
    // elements — RTL's getByText matches an element's own direct text nodes only.
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText('.30')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('.30')).not.toBeInTheDocument(), {
      timeout: 10000,
    });

    // Within a few real seconds it should have ticked down by a handful of
    // seconds, not jumped arbitrarily or gone back up.
    const secondsText = screen.getByText(/^\.\d+$/).textContent;
    const remaining = Number(secondsText.slice(1));
    expect(remaining).toBeLessThan(30);
    expect(remaining).toBeGreaterThan(20);
  }
);

test(
  'reaching zero reports the finish once',
  async () => {
    renderCountdown({ seconds: 2, secondsSpent: 0, initialPlay: true });

    await waitFor(() => expect(screen.getByTestId('play-state')).toHaveTextContent('false'), {
      timeout: 10000,
    });

    expect(screen.getByTestId('finished')).toHaveTextContent('1');
    expect(screen.getByText('0.00')).toBeInTheDocument();
  }
);

describe('in the background', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;
  const T0 = new Date(2026, 9, 10, 9, 0, 0).getTime();
  let visibility = 'visible';

  beforeAll(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  });
  beforeEach(() => {
    // The clock and timeouts are both faked, so the countdown's own ticks
    // only run when the test advances time: like a throttled hidden tab.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    visibility = 'visible';
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 8, notes: [], todos: [], habits: [], journal: {}, embeds: [], milestones: [],
      timers: [{ id: 1, day: 'sat', title: 'Focus', seconds: 600, secondsSpent: 0, initial: 600, reps: 0 }],
    }));
  });
  afterEach(() => {
    visibility = 'visible';
    vi.useRealTimers();
  });

  const setVisible = (visible) => {
    visibility = visible ? 'visible' : 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
  };
  const savedSpent = () => JSON.parse(window.localStorage.getItem(KEY)).timers[0].secondsSpent;

  test('coming back redraws the right time straight away, without waiting for a slowed-down tick', () => {
    renderCountdown({ seconds: 600, secondsSpent: 0, initialPlay: true });
    expect(screen.getByText('0.10')).toBeInTheDocument();

    setVisible(false);
    vi.setSystemTime(T0 + 125 * 1000); // 2 min 5 s pass; no tick runs
    setVisible(true);

    expect(screen.getByText('0.07')).toBeInTheDocument();
    expect(screen.getByText('.55')).toBeInTheDocument();
  });

  test('progress is saved when the app goes to the background', () => {
    render(<StoreProvider><Live /></StoreProvider>);

    vi.setSystemTime(T0 + 65 * 1000);
    setVisible(false);
    expect(savedSpent()).toBe(65);
  });

  test('progress is saved at least once a minute while running, even if ticks were skipped', () => {
    render(<StoreProvider><Live /></StoreProvider>);

    // Throttled: the next tick only runs 97 s later, skipping the 60 s mark.
    vi.setSystemTime(T0 + 97 * 1000);
    act(() => vi.advanceTimersByTime(1100)); // the pending tick finally runs
    expect(savedSpent()).toBe(98);
  });

  test('pausing and playing again quickly never makes the display jump back', () => {
    render(<StoreProvider><Live initialPlay={false} withToggle /></StoreProvider>);
    const toggle = screen.getByText('toggle');

    fireEvent.click(toggle); // play
    act(() => vi.advanceTimersByTime(30 * 1000 + 100));
    expect(screen.getByText('0.09')).toBeInTheDocument();
    expect(screen.getByText('.30')).toBeInTheDocument();

    fireEvent.click(toggle); // pause
    fireEvent.click(toggle); // play again right away
    for (let i = 0; i < 3; i++) {
      act(() => vi.advanceTimersByTime(1000));
      const left = Number(screen.getByText(/^\.\d+$/).textContent.slice(1));
      expect(left).toBeLessThanOrEqual(30);
      expect(left).toBeGreaterThanOrEqual(26);
      expect(screen.getByText('0.09')).toBeInTheDocument();
    }
  });
});
