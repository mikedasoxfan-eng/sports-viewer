/**
 * Simple pub/sub event bus for cross-component communication.
 */

const channels = new Map();

export function on(event, callback) {
  if (!channels.has(event)) {
    channels.set(event, new Set());
  }
  channels.get(event).add(callback);
  return () => channels.get(event).delete(callback);
}

export function emit(event, data) {
  const set = channels.get(event);
  if (set) {
    for (const cb of set) {
      try { cb(data); } catch (e) { console.error(`Event error [${event}]:`, e); }
    }
  }
}

export function off(event, callback) {
  channels.get(event)?.delete(callback);
}
