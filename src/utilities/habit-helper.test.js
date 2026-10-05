import {
  addDays,
  balanceLabel,
  dailyWeek,
  recentWeekStarts,
  routineWeek,
  toTarget,
  weekStartOf,
  daySummary,
} from './habit-helper';

// 2026-10-02 is a Friday; its Monday-first week runs 2026-09-28 .. 2026-10-04.
test('weekStartOf finds the Monday, including on Mondays and Sundays', () => {
  expect(weekStartOf('2026-10-02')).toBe('2026-09-28');
  expect(weekStartOf('2026-09-28')).toBe('2026-09-28');
  expect(weekStartOf('2026-10-04')).toBe('2026-09-28');
  expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
});

test('addDays crosses month and year ends', () => {
  expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('recentWeekStarts lists Mondays oldest first, ending with this week', () => {
  expect(recentWeekStarts('2026-10-02', 3)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
});

test('recentWeekStarts skips weeks before the habit existed, but always keeps this week', () => {
  expect(recentWeekStarts('2026-10-02', 3, '2026-09-24')).toEqual(['2026-09-21', '2026-09-28']);
  expect(recentWeekStarts('2026-10-02', 3, '2026-10-02')).toEqual(['2026-09-28']);
  expect(recentWeekStarts('2026-10-02', 3, '2027-01-01')).toEqual(['2026-09-28']);
});

test('dailyWeek counts each day, capped at the target', () => {
  const habit = { target: 5, log: { '2026-09-28': 5, '2026-09-30': 3, '2026-10-02': 9, '2026-09-27': 5 } };
  expect(dailyWeek(habit, '2026-09-28')).toEqual({ counts: [5, 0, 3, 0, 5, 0, 0], done: 13, possible: 35 });
});

test('routineWeek sums only that week, and the balance starts clear next Monday', () => {
  const habit = {
    log: {
      '2026-09-27': { plus: 9, minus: 0 }, // last week's Sunday
      '2026-09-28': { plus: 1, minus: 3 },
      '2026-10-04': { plus: 1, minus: 0 },
    },
  };
  expect(routineWeek(habit, '2026-09-28')).toEqual({ plus: 2, minus: 3, auto: 0, balance: -1 });
  expect(routineWeek(habit, '2026-10-05')).toEqual({ plus: 0, minus: 0, auto: 0, balance: 0 });
});

test.each([
  [-3, 'Owe 3'],
  [0, 'Clear'],
  [4, '+4 ahead'],
])('balanceLabel(%s) is %s', (balance, label) => {
  expect(balanceLabel(balance)).toBe(label);
});

test('toTarget keeps targets whole and within 1..20', () => {
  expect(toTarget(5)).toBe(5);
  expect(toTarget('3')).toBe(3);
  expect(toTarget(2.6)).toBe(3);
  expect(toTarget(0)).toBe(1);
  expect(toTarget(99)).toBe(20);
  expect(toTarget('x')).toBe(1);
});

test('daySummary shows daily counts and routine taps for habits that existed that day', () => {
  const habits = [
    { id: 1, kind: 'daily', name: 'Pray', target: 5, createdOn: '2026-09-01', log: { '2026-10-02': 5 } },
    { id: 2, kind: 'routine', name: 'Urge', createdOn: '2026-09-01', log: { '2026-10-02': { plus: 0, minus: 2 } } },
    { id: 3, kind: 'daily', name: 'Later', target: 1, createdOn: '2026-10-03', log: {} },
  ];
  expect(daySummary(habits, '2026-10-02')).toEqual([
    { id: 1, name: 'Pray', text: '5/5', done: true },
    { id: 2, name: 'Urge', text: '−2', owed: true },
  ]);
});

test('daySummary only flags a routine day when slips outnumber good taps', () => {
  const urge = (log) => [{ id: 1, kind: 'routine', name: 'Urge', createdOn: '2026-09-01', log }];
  expect(daySummary(urge({ '2026-10-02': { plus: 3, minus: 1 } }), '2026-10-02')[0]).toMatchObject({ text: '+3 −1', owed: false });
  expect(daySummary(urge({}), '2026-10-02')[0]).toMatchObject({ text: 'no taps', owed: false });
});
