let offsetMs = 0;

/** Ajusta el desfase con la hora del servidor (viene en cada respuesta de la API). */
export function updateServerTime(serverTime: number, receivedAt: number = Date.now()): void {
  offsetMs = serverTime - receivedAt;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function msUntil(iso: string): number {
  return Date.parse(iso) - serverNow();
}

export function resetClock(): void {
  offsetMs = 0;
}
