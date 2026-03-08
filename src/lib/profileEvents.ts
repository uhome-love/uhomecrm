// Simple event bus for profile updates (avatar changes, etc.)
const PROFILE_UPDATED_EVENT = "profile-updated";

export function emitProfileUpdated() {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
}

export function onProfileUpdated(callback: () => void) {
  window.addEventListener(PROFILE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, callback);
}
