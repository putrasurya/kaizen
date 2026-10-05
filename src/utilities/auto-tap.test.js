import { freezeAuto, liveAuto, routineDay, toAutoSettings, withAutoSettings } from './auto-tap';

// Local times on Tue 2026-10-06 (and around it).
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m).getTime();

const routine = (auto, log = {}) => ({ id: 1, kind: 'routine', name: 'Urge', createdOn: '2026-10-01', log, auto });
const plusHourly = (overrides = {}) => ({
  direction: 'plus', everyMinutes: 60, maxPerDay: 8, since: at(5, 0), frozenThrough: '2026-10-04', ...overrides,
});

test('earns one tap per whole interval since midnight, as of now', () => {
  const habit = routine(plusHourly());
  expect(liveAuto(habit, '2026-10-06', at(6, 5, 30))).toMatchObject({ field: 'autoPlus', count: 5, total: 5, next: at(6, 6) });
  expect(routineDay(habit, '2026-10-06', at(6, 5, 30))).toMatchObject({ plus: 0, autoPlus: 5, totalPlus: 5 });
});

test('the daily max caps it, and there is no "next" once reached', () => {
  const habit = routine(plusHourly({ maxPerDay: 3 }));
  expect(liveAuto(habit, '2026-10-06', at(6, 23))).toMatchObject({ count: 3, next: null });
});

test('a full past day the app never saw is still counted', () => {
  const habit = routine(plusHourly({ maxPerDay: 30 }));
  expect(liveAuto(habit, '2026-10-05', at(6, 9)).count).toBe(24);
});

test('starts from when auto was turned on, not midnight', () => {
  const habit = routine(plusHourly({ since: at(6, 9, 30), frozenThrough: '2026-10-05' }));
  expect(liveAuto(habit, '2026-10-06', at(6, 12))).toMatchObject({ count: 2, next: at(6, 12, 30) });
  expect(liveAuto(habit, '2026-10-05', at(6, 12))).toBeNull();
});

test('an opposite tap restarts the clock; same-direction taps do not', () => {
  const log = { '2026-10-06': { plus: 1, minus: 1, plusAt: [at(6, 2, 10)], minusAt: [at(6, 3, 30)] } };
  const habit = routine(plusHourly(), log);
  // 00:00-03:30 -> 3, slip at 03:30 -> 03:30-06:00 -> 2 (the 03:00 hour is lost)
  expect(liveAuto(habit, '2026-10-06', at(6, 6))).toMatchObject({ count: 5, next: at(6, 6, 30) });
  expect(routineDay(habit, '2026-10-06', at(6, 6))).toMatchObject({ totalPlus: 6, totalMinus: 1 });
});

test('auto minus works the same way the other way round', () => {
  const log = { '2026-10-06': { plus: 1, plusAt: [at(6, 10)] } };
  const habit = routine({ ...plusHourly(), direction: 'minus', everyMinutes: 90, maxPerDay: 8 }, log);
  // 00:00-10:00 -> 6, drank at 10:00 -> 10:00-12:00 -> 1
  expect(routineDay(habit, '2026-10-06', at(6, 12))).toMatchObject({ autoMinus: 7, totalMinus: 7, totalPlus: 1 });
});

test('future days and frozen days get nothing live', () => {
  const habit = routine(plusHourly());
  expect(liveAuto(habit, '2026-10-07', at(6, 12))).toBeNull();
  expect(liveAuto(habit, '2026-10-04', at(6, 12))).toBeNull();
});

test('changing settings keeps what the old ones earned, and the new ones start now', () => {
  const habit = routine(plusHourly({ maxPerDay: 10 }));
  const changed = withAutoSettings(habit, { direction: 'plus', everyMinutes: 30, maxPerDay: 10 }, at(6, 4));

  expect(changed.log['2026-10-05']).toEqual({ plus: 0, minus: 0, autoPlus: 10 });
  expect(changed.log['2026-10-06']).toEqual({ plus: 0, minus: 0, autoPlus: 4 });
  expect(changed.auto).toMatchObject({ everyMinutes: 30, since: at(6, 4), frozenThrough: '2026-10-05' });
  // 4 saved + 04:00-06:00 at 30 min = 4 more = 8, under the max of 10
  expect(routineDay(changed, '2026-10-06', at(6, 6)).autoPlus).toBe(8);
  // later the max of 10 still holds for the whole day
  expect(routineDay(changed, '2026-10-06', at(6, 20)).autoPlus).toBe(10);
});

test('turning auto off keeps today\'s auto taps so far and stops there', () => {
  const off = withAutoSettings(routine(plusHourly()), null, at(6, 3, 15));
  expect(off.auto).toBeNull();
  expect(routineDay(off, '2026-10-06', at(6, 20))).toMatchObject({ autoPlus: 3 });
});

test('saving the same settings again changes nothing', () => {
  const habit = routine(plusHourly());
  expect(withAutoSettings(habit, { direction: 'plus', everyMinutes: 60, maxPerDay: 8 }, at(6, 9))).toBe(habit);
});

test('freezeAuto is idempotent', () => {
  const once = freezeAuto(routine(plusHourly()), at(6, 2));
  expect(freezeAuto(once, at(6, 2)).log).toEqual(once.log);
});

test('toAutoSettings keeps values in range, and "off" is null', () => {
  expect(toAutoSettings({ direction: 'minus', everyMinutes: '1', maxPerDay: 500 })).toEqual({ direction: 'minus', everyMinutes: 5, maxPerDay: 100 });
  expect(toAutoSettings({ direction: 'sideways' })).toBeNull();
  expect(toAutoSettings(null)).toBeNull();
});

test('crossing midnight resets the daily count', () => {
  const habit = routine(plusHourly({ maxPerDay: 2 }));
  expect(liveAuto(habit, '2026-10-06', at(6, 23, 59)).count).toBe(2);
  expect(liveAuto(habit, '2026-10-07', at(7, 0, 30))).toMatchObject({ count: 0, next: at(7, 1) });
});

test('right after switching on, or right after a slip, the next tap is a full interval away', () => {
  const justOn = routine(plusHourly({ since: at(6, 9), frozenThrough: '2026-10-05' }));
  expect(liveAuto(justOn, '2026-10-06', at(6, 9))).toMatchObject({ count: 0, next: at(6, 10) });

  const log = { '2026-10-06': { minus: 1, minusAt: [at(6, 9, 20)] } };
  expect(liveAuto(routine(plusHourly({ maxPerDay: 20 }), log), '2026-10-06', at(6, 9, 20))).toMatchObject({ count: 9, next: at(6, 10, 20) });
});
