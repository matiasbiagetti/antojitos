'use client';

import { useEffect, useState } from 'react';
import type { PublicSnapshot } from '@/lib/shared/api-types';
import { getBrowserSupabase } from './supabase-browser';

export type RoomState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; snapshot: PublicSnapshot; reconnecting: boolean };

/** Foto pública de la sala: carga inicial + cambios por Realtime. Cada evento trae la foto completa. */
export function useRoom(roomId: string): RoomState {
  const [state, setState] = useState<RoomState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let currentVersion = -1;
    let cancelled = false;
    let retryTimeout: NodeJS.Timeout | null = null;

    const apply = (snapshot: PublicSnapshot) => {
      if (cancelled || snapshot.version <= currentVersion) return;
      currentVersion = snapshot.version;
      setState({ status: 'ready', snapshot, reconnecting: false });
    };

    const load = async () => {
      const { data, error } = await supabase.from('room_public').select('snapshot').eq('room_id', roomId).maybeSingle();
      if (cancelled) return;

      if (error) {
        // On error, keep current state and retry after 2s
        setState((s) => (s.status === 'loading' ? s : s));
        if (!cancelled) {
          retryTimeout = setTimeout(() => {
            if (!cancelled) void load();
          }, 2000);
        }
        return;
      }

      if (data?.snapshot) {
        apply(data.snapshot as PublicSnapshot);
        // Clear reconnecting flag even if version didn't change
        setState((s) => (s.status === 'ready' ? { ...s, reconnecting: false } : s));
      } else {
        // Only set missing when there's no error and no row
        setState((s) => (s.status === 'ready' ? s : { status: 'missing' }));
      }
    };

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_public', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { snapshot?: PublicSnapshot } | null;
          if (row?.snapshot) apply(row.snapshot);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Al (re)conectar se vuelve a pedir la foto completa: no hay nada que reconciliar.
          void load();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState((s) => (s.status === 'ready' ? { ...s, reconnecting: true } : s));
        }
      });

    void load();
    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return state;
}
