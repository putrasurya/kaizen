import {
  extractToHourMinuteAndSecond,
  extractToHourMinuteAndSecondWithPadZero,
  millisToSeconds,
  secondsToMillis,
} from './time-helper';

describe('extractToHourMinuteAndSecond', () => {
  test('splits seconds into hour, minute, second', () => {
    expect(extractToHourMinuteAndSecond(3725)).toEqual([1, 2, 5]);
  });

  test('returns all zeros for 0 seconds', () => {
    expect(extractToHourMinuteAndSecond(0)).toEqual([0, 0, 0]);
  });

  test('handles exact hour boundaries', () => {
    expect(extractToHourMinuteAndSecond(3600)).toEqual([1, 0, 0]);
  });

  test('handles exact minute boundaries', () => {
    expect(extractToHourMinuteAndSecond(120)).toEqual([0, 2, 0]);
  });
});

describe('extractToHourMinuteAndSecondWithPadZero', () => {
  test('pads single-digit minute and second with a leading zero', () => {
    expect(extractToHourMinuteAndSecondWithPadZero(3665)).toEqual([1, '01', '05']);
  });

  test('does not pad the hour', () => {
    expect(extractToHourMinuteAndSecondWithPadZero(36305)).toEqual([10, '05', '05']);
  });

  test('pads zero minute and second', () => {
    expect(extractToHourMinuteAndSecondWithPadZero(7200)).toEqual([2, '00', '00']);
  });
});

describe('millisToSeconds', () => {
  test('converts and floors partial seconds', () => {
    expect(millisToSeconds(2500)).toBe(2);
  });

  test('converts 0', () => {
    expect(millisToSeconds(0)).toBe(0);
  });
});

describe('secondsToMillis', () => {
  test('converts seconds to milliseconds', () => {
    expect(secondsToMillis(3)).toBe(3000);
  });

  test('converts 0', () => {
    expect(secondsToMillis(0)).toBe(0);
  });
});
