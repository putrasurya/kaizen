import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TimerCountdown from './TimerCountdown';
import { StoreProvider } from '../redux/store';

// TimerCountdown drives its own display via a recursive setTimeout(tiktok, 1000)
// loop while play=true, computing elapsed time from real Date deltas — and reports
// back to the store (updateSecondsSpent, incrementReps) rather than owning play
// state itself, so this harness reproduces what TimerItem normally supplies
// (play/setPlay). These tests use real timers and wait for real elapsed time
// rather than faking them, to avoid needing the component's `new Date()` calls to
// stay in lockstep with a fake clock.
function Harness({ seconds, secondsSpent = 0, initialPlay = false }) {
  const [play, setPlay] = useState(initialPlay);
  return (
    <div>
      <span data-testid="play-state">{String(play)}</span>
      <TimerCountdown
        id={1}
        play={play}
        seconds={seconds}
        secondsSpent={secondsSpent}
        setPlay={setPlay}
      />
    </div>
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
  'reaching zero stops playback, buzzes, and increments reps',
  async () => {
    renderCountdown({ seconds: 2, secondsSpent: 0, initialPlay: true });

    await waitFor(() => expect(screen.getByTestId('play-state')).toHaveTextContent('false'), {
      timeout: 10000,
    });

    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByText('0.00')).toBeInTheDocument();
  }
);
