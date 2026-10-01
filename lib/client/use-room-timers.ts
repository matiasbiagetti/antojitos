'use client';

import { useEffect } from 'react';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { closeRoom, heartbeat } from './api';
import { msUntil } from './clock';

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

export function useRoomTimers(roomId: string, snapshot: PublicSnapshot | null, token: string | null): void {
  useEffect(() => {
    if (!token) return;
    const beat = () => void heartbeat(roomId, token).catch(() => undefined);
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [roomId, token]);

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
  }, [roomId, target]);
}
