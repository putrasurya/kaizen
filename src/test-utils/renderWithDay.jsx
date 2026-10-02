import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../redux/store';
import { DayProvider } from '../redux/day';
import DayPicker from '../components/DayPicker';

// The day picker lives at page level (App) and drives every section, so a
// section under test is rendered with the shared day state and the picker.
export function renderWithDay(ui) {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <DayProvider>
        <DayPicker />
        {ui}
      </DayProvider>
    </StoreProvider>
  );
  return user;
}

export function dayRadio(name) {
  return screen.getByRole('radio', { name });
}

// Segmented hides its radio inputs; the wrapping label is the click target.
export async function pickDay(user, name) {
  await user.click(dayRadio(name).closest('label'));
}
