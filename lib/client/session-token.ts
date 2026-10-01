export type Session = { participantId: string; token: string };

const key = (roomId: string) => `antojitos:session:${roomId}`;

export function getSession(roomId: string): Session | null {
  try {
    const raw = localStorage.getItem(key(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return typeof parsed.participantId === 'string' && typeof parsed.token === 'string'
      ? { participantId: parsed.participantId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(roomId: string, session: Session): void {
  try {
    localStorage.setItem(key(roomId), JSON.stringify(session));
  } catch {
    // Sin storage (modo privado estricto): la sesión dura lo que la pestaña.
  }
}

export function clearSession(roomId: string): void {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // ignorar
  }
}
