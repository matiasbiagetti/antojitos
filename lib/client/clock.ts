let offsetMs = 0;
const listeners: Set<() => void> = new Set();

/** Ajusta el desfase con la hora del servidor (viene en cada respuesta de la API). */
export function updateServerTime(serverTime: number, receivedAt: number = Date.now()): void {
  const newOffset = serverTime - receivedAt;
  const delta = Math.abs(newOffset - offsetMs);
  offsetMs = newOffset;
  if (delta > 500) {
    listeners.forEach((listener) => listener());
  }
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function msUntil(iso: string): number {
  return Date.parse(iso) - serverNow();
}

export function resetClock(): void {
  offsetMs = 0;
  listeners.clear();
}

export function onClockChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
