/**
 * Order Manager notification sounds (files in /public/sounds).
 * notification_original.mp3 is kept in the folder as archive only — not selectable.
 */

export const NOTIFICATION_SOUND_STORAGE_KEY = "orderManagerNotificationSoundId";

export const NOTIFICATION_SOUND_OPTIONS = [
  {
    id: "sound1",
    label: "Sound 1",
    file: "notification.mp3",
  },
  {
    id: "sound2",
    label: "Sound 2",
    file: "notification_original_enhance.mp3",
  },
];

const DEFAULT_SOUND_ID = "sound1";

export function getNotificationSoundOption(soundId) {
  return (
    NOTIFICATION_SOUND_OPTIONS.find((o) => o.id === soundId) ||
    NOTIFICATION_SOUND_OPTIONS[0]
  );
}

export function getNotificationSoundId() {
  if (typeof window === "undefined") return DEFAULT_SOUND_ID;
  const stored = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY);
  if (stored && NOTIFICATION_SOUND_OPTIONS.some((o) => o.id === stored)) {
    return stored;
  }
  return DEFAULT_SOUND_ID;
}

export function setNotificationSoundId(soundId) {
  if (typeof window === "undefined") return;
  const option = getNotificationSoundOption(soundId);
  localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, option.id);
  window.dispatchEvent(
    new CustomEvent("order-manager-notification-sound-changed", {
      detail: { soundId: option.id },
    }),
  );
}

export function getNotificationSoundUrl(soundId) {
  const option = getNotificationSoundOption(
    soundId ?? getNotificationSoundId(),
  );
  return `/sounds/${option.file}`;
}
