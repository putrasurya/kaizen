import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { StoreProvider } from './redux/store';
import { mockViewportWidth } from './test-utils/mockViewport';

function renderApp() {
  const user = userEvent.setup();
  const view = render(
    <StoreProvider>
      <App />
    </StoreProvider>
  );
  return { user, ...view };
}

describe("App", () => {
  test('renders the Kaizen title, day picker, timer list, todo list, note list and footer together', () => {
    renderApp();

    expect(screen.getByText(/Kaizen/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Day of the week' })).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();
    expect(screen.getByText(/Add Timer/i)).toBeInTheDocument();
    expect(screen.getByText(/Putra Surya/i)).toBeInTheDocument();
  });

  test('there is exactly one day picker for the whole page', () => {
    renderApp();
    expect(screen.getAllByRole('radiogroup', { name: 'Day of the week' })).toHaveLength(1);
  });
});

describe("App shared day", () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  // Only Date is faked; userEvent and antd need real timers. 2026-10-02 is a Friday.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 3,
      embeds: [],
      timers: [
        { id: 1, day: 'fri', title: 'Friday Focus', seconds: 3600, initial: 3600, secondsSpent: 0, reps: 0 },
        { id: 2, day: 'tue', title: 'Tuesday Gym', seconds: 3600, initial: 3600, secondsSpent: 0, reps: 0 },
      ],
      todos: [
        { id: 1, day: 'fri', text: 'Friday chore', doneOn: null },
        { id: 2, day: 'tue', text: 'Tuesday chore', doneOn: null },
      ],
      notes: [
        { id: 1, day: 'fri', content: 'Friday note' },
        { id: 2, day: 'tue', content: 'Tuesday note' },
      ],
    }));
  });
  afterEach(() => vi.useRealTimers());

  test('picking a day switches timers, todos and notes together', async () => {
    const { user } = renderApp();

    expect(screen.getByText('Friday Focus')).toBeVisible();
    expect(screen.getByText('Friday chore')).toBeInTheDocument();
    expect(screen.getByText('Friday note')).toBeInTheDocument();
    expect(screen.queryByText('Tuesday chore')).not.toBeInTheDocument();
    expect(screen.queryByText('Tuesday note')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Tue$/ }).closest('label'));

    expect(screen.getByText('Tuesday Gym')).toBeVisible();
    expect(screen.getByText('Friday Focus')).not.toBeVisible();
    expect(screen.getByText('Tuesday chore')).toBeInTheDocument();
    expect(screen.queryByText('Friday chore')).not.toBeInTheDocument();
    expect(screen.getByText('Tuesday note')).toBeInTheDocument();
    expect(screen.queryByText('Friday note')).not.toBeInTheDocument();
  });
});

describe("App layout order", () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  // The single phone column follows source order (antd's lg order classes only
  // apply from 992px up), so the DOM order is the phone order.
  test('on a phone the order is day picker, Pomodoro timer, Todo, Journal, Reminders', () => {
    restoreViewport = mockViewportWidth(360);
    renderApp();

    const picker = screen.getByRole('radiogroup', { name: 'Day of the week' });
    const timers = screen.getByRole('region', { name: 'Pomodoro timer' });
    const todos = screen.getByRole('region', { name: 'Todo' });
    const journal = screen.getByRole('region', { name: 'Journal' });
    const notes = screen.getByText('Reminders');
    const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(picker, timers)).toBe(true);
    expect(follows(timers, todos)).toBe(true);
    expect(follows(todos, journal)).toBe(true);
    expect(follows(journal, notes)).toBe(true);

    // No column reorders below lg.
    const columns = [...screen.getByTestId('sections').children];
    for (const col of columns) {
      expect([...col.classList].some((c) => /^ant-col-(xs|sm|md)-order/.test(c))).toBe(false);
    }
  });

  test('from lg up, todos + journal + reminders form the left column and timers the right', () => {
    restoreViewport = mockViewportWidth(1280);
    renderApp();

    const [timersCol, listsCol] = screen.getByTestId('sections').children;
    expect(within(timersCol).getByRole('region', { name: 'Pomodoro timer' })).toBeInTheDocument();
    expect(timersCol).toHaveClass('ant-col-lg-order-2', 'ant-col-lg-12');
    expect(within(listsCol).getByRole('region', { name: 'Todo' })).toBeInTheDocument();
    expect(within(listsCol).getByRole('region', { name: 'Journal' })).toBeInTheDocument();
    expect(within(listsCol).getByText('Reminders')).toBeInTheDocument();
    expect(listsCol).toHaveClass('ant-col-lg-order-1', 'ant-col-lg-12');
  });
});

describe("App responsive gutter", () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  // The Row's negative side margin is half the horizontal gutter and has to match
  // App.module.css's container padding (16px on phones, 25px otherwise), or the
  // page scrolls sideways.
  test.each([
    [360, '-16px'],
    [1280, '-25px'],
  ])('at %ipx wide the column row inline margin is %s', (width, margin) => {
    restoreViewport = mockViewportWidth(width);
    renderApp();

    const row = screen.getByTestId('sections');
    expect(row).toHaveClass('ant-row');
    // antd 6 sets this as the logical `margin-inline` property, which jsdom's
    // CSSStyleDeclaration doesn't expand, so check the inline style text.
    expect(row.getAttribute('style')).toContain(`margin-inline: ${margin}`);
  });
});
