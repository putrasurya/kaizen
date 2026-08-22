import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import TimerItemReps from './TimerItemReps';
import { store, StoreProvider } from '../redux/store';

function Harness({ initial }) {
  const ctx = useContext(store);
  const timer = ctx.timers[0];

  return (
    <div>
      <button onClick={() => ctx.addTimer('Focus', initial)}>addTimer</button>
      {timer && <button onClick={() => ctx.incrementReps(timer.id)}>incrementReps</button>}
      {timer && <TimerItemReps timer={timer} />}
    </div>
  );
}

function renderHarness(initial = 90) {
  return render(
    <StoreProvider>
      <Harness initial={initial} />
    </StoreProvider>
  );
}

test('renders reps count and total elapsed time from initial * reps', () => {
  renderHarness(90);

  userEvent.click(screen.getByText('addTimer'));
  userEvent.click(screen.getByText('incrementReps'));
  userEvent.click(screen.getByText('incrementReps'));
  userEvent.click(screen.getByText('incrementReps'));

  // 90s * 3 reps = 270s = 0:4:30
  expect(screen.getByText('3 Reps | 0:4:30')).toBeInTheDocument();
});

test('clicking reset resets the reps counter to zero', () => {
  renderHarness(90);

  userEvent.click(screen.getByText('addTimer'));
  userEvent.click(screen.getByText('incrementReps'));
  expect(screen.getByText(/1 Reps/)).toBeInTheDocument();

  userEvent.click(screen.getByText('reset'));

  expect(screen.getByText(/0 Reps/)).toBeInTheDocument();
});
