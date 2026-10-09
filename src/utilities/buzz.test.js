import { buzz, getAlarm } from './buzz';

test('the alarm is created on <body> when missing, so a finished timer can always buzz', () => {
  document.getElementById('buzzbuzz')?.remove();
  buzz();
  const audio = document.getElementById('buzzbuzz');
  expect(audio).not.toBeNull();
  expect(audio.parentElement).toBe(document.body);
  expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
});

test('a refused play() never throws', async () => {
  window.HTMLMediaElement.prototype.play.mockReturnValueOnce(Promise.reject(new Error('NotAllowedError')));
  expect(() => buzz()).not.toThrow();
  await Promise.resolve();
});

test('getAlarm reuses the same element', () => {
  expect(getAlarm()).toBe(getAlarm());
});
