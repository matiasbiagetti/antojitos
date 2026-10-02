'use client';

import { useEffect, useState } from 'react';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { closeRoom, heartbeat } from './api';
import { msUntil, onClockChange } from './clock';

const HEARTBEAT_MS = 10_000;
const CLOSE_GRACE_MS = 250;
const CLOSE_RETRY_MS = 2_000;

/** Momento en que hay que pedirle al servidor que cierre la fase actual. */
export function dueAt(snapshot: PublicSnapshot): string | null {
  const round = snapshot.round;
  if (!round) return null;
  if (snapshot.phase === 'voting') return round.deadline;
  if (snapshot.phase === 'runoff') return round.runoffDeadline ?? null;
  if (snapshot.phase === 'roulette') return round.roulette?.endsAt ?? null;
  return null;
}

export function useRoomTimers(
  roomId: string,
  snapshot: PublicSnapshot | null,
  token: string | null,
): { canTakeHost: boolean } {
  const [clockVersion, setClockVersion] = useState(0);
  const [canTakeHost, setCanTakeHost] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const beat = () =>
      void heartbeat(roomId, token)
        .then((res) => {
          if (!cancelled) setCanTakeHost(res.canTakeHost);
        })
        .catch(() => {
          if (!cancelled) setCanTakeHost(false);
        });
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    // Al volver a la pestaña el intervalo pudo estar frenado: avisar enseguida.
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', beat);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', beat);
    };
  }, [roomId, token]);

  useEffect(() => {
    const unsubscribe = onClockChange(() => {
      setClockVersion((v) => v + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const target = snapshot ? dueAt(snapshot) : null;
  useEffect(() => {
    if (!target) return;
    const fire = () => void closeRoom(roomId).catch(() => undefined);
    const wait = Math.max(0, msUntil(target)) + CLOSE_GRACE_MS;
    const first = setTimeout(fire, wait);
    const retry = setTimeout(fire, wait + CLOSE_RETRY_MS);
    return () => {
      clearTimeout(first);
      clearTimeout(retry);
    };
  }, [roomId, target, clockVersion]);

  return { canTakeHost: token ? canTakeHost : false };
}
