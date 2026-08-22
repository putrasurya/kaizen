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
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Harness initial={initial} />
    </StoreProvider>
  );
  return user;
}

test('renders reps count and total elapsed time from initial * reps', async () => {
  const user = renderHarness(90);

  await user.click(screen.getByText('addTimer'));
  await user.click(screen.getByText('incrementReps'));
  await user.click(screen.getByText('incrementReps'));
  await user.click(screen.getByText('incrementReps'));

  // 90s * 3 reps = 270s = 0:4:30
  expect(screen.getByText('3 Reps | 0:4:30')).toBeInTheDocument();
});

test('clicking reset resets the reps counter to zero', async () => {
  const user = renderHarness(90);

  await user.click(screen.getByText('addTimer'));
  await user.click(screen.getByText('incrementReps'));
  expect(screen.getByText(/1 Reps/)).toBeInTheDocument();

  await user.click(screen.getByText('reset'));

  expect(screen.getByText(/0 Reps/)).toBeInTheDocument();
});
