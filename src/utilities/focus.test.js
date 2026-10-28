import { addFocus, focusKey, level, plannedDays, renameFocus, secondsBetween, streak } from './focus';

const log = (entries) =>
  entries.reduce((focus, [date, seconds, rounds]) => addFocus(focus, { date, title: 'Deep work', seconds, rounds }), {});
const WEEKDAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri']);
const KEY = 'deep work';

test('focusKey groups names regardless of case and spaces at the ends', () => {
  expect(focusKey('  Deep Work ')).toBe('deep work');
});

test('addFocus adds up time and rounds and ignores nothing-to-add', () => {
  let focus = addFocus({}, { date: '2026-10-26', title: 'Deep work', seconds: 600 });
  focus = addFocus(focus, { date: '2026-10-26', title: 'deep work', seconds: 900, rounds: 1 });
  expect(addFocus(focus, { date: '2026-10-26', title: 'Deep work' })).toBe(focus);
  expect(focus).toEqual({ '2026-10-26': { 'deep work': { title: 'deep work', seconds: 1500, rounds: 1 } } });
});

test('renameFocus merges into a name that already has history', () => {
  const focus = {
    '2026-10-26': { a: { title: 'A', seconds: 60, rounds: 1 }, b: { title: 'B', seconds: 30, rounds: 0 } },
    '2026-10-27': { a: { title: 'A', seconds: 10, rounds: 0 } },
  };
  expect(renameFocus(focus, 'A', 'B')).toEqual({
    '2026-10-26': { b: { title: 'B', seconds: 90, rounds: 1 } },
    '2026-10-27': { b: { title: 'B', seconds: 10, rounds: 0 } },
  });
});

test('plannedDays are the weekdays a timer with that name exists on', () => {
  const timers = [{ day: 'mon', title: 'Deep work' }, { day: 'wed', title: 'deep work ' }, { day: 'fri', title: 'Reading' }];
  expect([...plannedDays(timers, KEY)].sort()).toEqual(['mon', 'wed']);
});

describe('streak (today is Wed 28 Oct, planned Mon to Fri)', () => {
  test('skips the unplanned weekend, and an unfinished today does not break it', () => {
    // Thu 22, Fri 23, (weekend), Mon 26, Tue 27 done; today nothing yet.
    const focus = log([['2026-10-22', 1500, 1], ['2026-10-23', 1500, 1], ['2026-10-26', 1500, 1], ['2026-10-27', 1500, 1]]);
    expect(streak(focus, KEY, WEEKDAYS, '2026-10-28')).toBe(4);
  });

  test('a missed planned day ends it, and an extra (unplanned) day done counts', () => {
    // Fri 23 missed; Sat 24 done (extra); Mon 26 and today done.
    const focus = log([['2026-10-22', 1500, 1], ['2026-10-24', 600, 1], ['2026-10-26', 1500, 1], ['2026-10-27', 900, 1], ['2026-10-28', 300, 1]]);
    expect(streak(focus, KEY, WEEKDAYS, '2026-10-28')).toBe(4);
  });

  test('time without a finished round does not count as done', () => {
    const focus = log([['2026-10-27', 1200, 0]]);
    expect(streak(focus, KEY, WEEKDAYS, '2026-10-28')).toBe(0);
  });

  test('is 0 with no history', () => {
    expect(streak({}, KEY, WEEKDAYS, '2026-10-28')).toBe(0);
  });
});

test('secondsBetween sums a date range', () => {
  const focus = log([['2026-10-26', 600, 0], ['2026-10-27', 900, 1], ['2026-10-30', 60, 0]]);
  expect(secondsBetween(focus, KEY, '2026-10-26', '2026-10-28')).toBe(1500);
});

test.each([
  [0, 0], [60, 1], [29 * 60, 1], [30 * 60, 2], [60 * 60, 3], [119 * 60, 3], [2 * 3600, 4],
])('level(%i) is %i', (seconds, expected) => {
  expect(level(seconds)).toBe(expected);
});
