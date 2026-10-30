import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampHour,
  disableDailyReminder,
  enableDailyReminder,
  haptic,
  isNative,
  setHapticsEnabled,
  shareText,
} from '../src/native/native';

afterEach(() => {
  vi.unstubAllGlobals();
  setHapticsEnabled(true);
});

describe('native bridge on the web', () => {
  it('is not native in tests', () => {
    expect(isNative()).toBe(false);
  });
  it('uses navigator.vibrate when haptics are on and stays silent when off', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    await haptic('success');
    expect(vibrate).toHaveBeenCalledWith([18, 40, 30]);
    vibrate.mockClear();
    setHapticsEnabled(false);
    await haptic('success');
    expect(vibrate).not.toHaveBeenCalled();
  });
  it('reminders are unavailable on the web and cancelling is harmless', async () => {
    expect(await enableDailyReminder(19)).toEqual({ ok: false, reason: 'web' });
    await expect(disableDailyReminder()).resolves.toBeUndefined();
  });
  it('clamps the reminder hour', () => {
    expect(clampHour(25)).toBe(23);
    expect(clampHour(-3)).toBe(0);
    expect(clampHour(NaN)).toBe(19);
    expect(clampHour(7.6)).toBe(8);
  });
  it('share falls back to the clipboard, then to "unavailable"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareText('t', 'merhaba')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('merhaba');
    vi.stubGlobal('navigator', {});
    expect(await shareText('t', 'x')).toBe('unavailable');
  });
});
