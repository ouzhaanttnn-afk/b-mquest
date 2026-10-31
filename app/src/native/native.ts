import { Capacitor } from '@capacitor/core';

/**
 * Thin bridge to the iPhone's own features (haptics, local notifications,
 * share sheet). Every call degrades to a web fallback or a no-op, so the
 * browser build and the tests never depend on a device.
 */

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

let hapticsEnabled = true;
export const setHapticsEnabled = (on: boolean): void => {
  hapticsEnabled = on;
};
export const isHapticsEnabled = (): boolean => hapticsEnabled;

const WEB_PATTERN: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 15,
  success: [18, 40, 30],
  error: [30, 50, 30],
};

export async function haptic(kind: HapticKind): Promise<void> {
  if (!hapticsEnabled) return;
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'error') await Haptics.notification({ type: NotificationType.Error });
      else await Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(WEB_PATTERN[kind]);
    }
  } catch {
    // Haptics are a nicety; never break the game for them.
  }
}

export const REMINDER_ID = 4101;

export const REMINDER_TEXT = {
  title: 'BIM QUEST',
  body: 'Bugünkü görevin seni bekliyor. Serini bozma!',
};

export interface ReminderResult {
  ok: boolean;
  reason?: 'web' | 'denied' | 'error';
}

/** Schedules a repeating daily reminder. Asks for permission on first use. */
export async function enableDailyReminder(hour: number): Promise<ReminderResult> {
  if (!isNative()) return { ok: false, reason: 'web' };
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return { ok: false, reason: 'denied' };
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: REMINDER_TEXT.title,
          body: REMINDER_TEXT.body,
          schedule: { on: { hour: clampHour(hour), minute: 0 }, allowWhileIdle: true },
        },
      ],
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disableDailyReminder(): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    // Nothing scheduled, nothing to cancel.
  }
}

export const clampHour = (h: number): number =>
  Number.isFinite(h) ? Math.min(23, Math.max(0, Math.round(h))) : 19;

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

/** Opens the native share sheet; on the web uses navigator.share or the clipboard. */
export async function shareText(title: string, text: string): Promise<ShareOutcome> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // Cancelled by the player or blocked: treat as nothing happened.
  }
  return 'unavailable';
}
