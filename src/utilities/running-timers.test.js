import { formatClock, tabTitle } from './running-timers';

const NOW = 1_000_000;
const at = (seconds) => NOW + seconds * 1000;

test.each([
  [0, '0:00'], [9, '0:09'], [1453, '24:13'], [3900, '1:05:00'],
])('formatClock(%i) is %s', (s, text) => expect(formatClock(s)).toBe(text));

test('shows the running timer, rounding up like the card does', () => {
  const timers = new Map([[1, { title: 'Deep work', phase: 'focus', endsAt: at(1452.4) }]]);
  expect(tabTitle(timers, NOW)).toBe('24:13 Deep work · Kaizen');
});

test('breaks say so, and the one ending soonest leads when several run', () => {
  const timers = new Map([
    [1, { title: 'Deep work', phase: 'focus', endsAt: at(1500) }],
    [2, { title: 'Reading', phase: 'long', endsAt: at(272) }],
  ]);
  expect(tabTitle(timers, NOW)).toBe('4:32 Long break · Reading +1 · Kaizen');
});

test('with the privacy lock on, names stay out of the tab', () => {
  const timers = new Map([[1, { title: 'Deep work', phase: 'focus', endsAt: at(60) }]]);
  expect(tabTitle(timers, NOW, { hideNames: true })).toBe('1:00 · Kaizen');
  const onBreak = new Map([[1, { title: 'Deep work', phase: 'break', endsAt: at(60) }]]);
  expect(tabTitle(onBreak, NOW, { hideNames: true })).toBe('1:00 Break · Kaizen');
});

test('nothing running means no special title', () => {
  expect(tabTitle(new Map(), NOW)).toBeNull();
});
