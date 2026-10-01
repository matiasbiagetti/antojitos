'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, getMe, joinRoom, markOpened } from '@/lib/client/api';
import { serverNow } from '@/lib/client/clock';
import { clearSession, getSession, saveSession, type Session } from '@/lib/client/session-token';
import { useRoom } from '@/lib/client/use-room';
import { useRoomTimers } from '@/lib/client/use-room-timers';
import type { MeResponse, PublicSnapshot } from '@/lib/shared/api-types';
import { LobbyScreen } from './LobbyScreen';
import { Logo } from './Logo';
import { NicknameForm } from './NicknameForm';
import { StatusScreen } from './StatusScreen';
import { VotingScreen } from './VotingScreen';

export type PhaseProps = {
  roomId: string;
  session: Session;
  snapshot: PublicSnapshot;
  me: MeResponse;
  isHost: boolean;
};

function useHostChangeNotice(snapshot: PublicSnapshot | null): string | null {
  const previous = useRef<string | null | undefined>(undefined);
  const participants = useRef(snapshot?.participants ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const hostId = snapshot?.hostParticipantId;

  useEffect(() => {
    participants.current = snapshot?.participants ?? [];
  });

  useEffect(() => {
    if (hostId === undefined) return;
    if (previous.current !== undefined && previous.current !== hostId) {
      const nickname = participants.current.find((p) => p.id === hostId)?.nickname;
      if (nickname) {
        setNotice(`Ahora ${nickname} es quien arranca la ronda`);
      }
    }
    previous.current = hostId;
  }, [hostId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  return notice;
}

export function RoomScreen({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<MeResponse | null>(null);
  const room = useRoom(roomId);
  const snapshot = room.status === 'ready' ? room.snapshot : null;

  useEffect(() => {
    const stored = getSession(roomId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable on the client
    setSession(stored);
    if (!stored) void markOpened(roomId).catch(() => undefined);
  }, [roomId]);

  useRoomTimers(roomId, snapshot, session?.token ?? null);
  const hostNotice = useHostChangeNotice(snapshot);

  // `me` (orden de tarjetas, votos propios, rol) se refresca al cambiar de ronda o de fase.
  const meKey = snapshot ? `${snapshot.round?.number ?? 0}:${snapshot.phase}:${snapshot.hostParticipantId}` : '';
  useEffect(() => {
    if (!session || !meKey) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getMe(roomId, session.token)
        .then((value) => {
          if (!cancelled) setMe(value);
        })
        .catch((error) => {
          if (cancelled) return;
          if (error instanceof ApiError && error.code === 'INVALID_TOKEN') {
            clearSession(roomId);
            setSession(null);
            return;
          }
          retry = setTimeout(load, 2000);
        });
    };
    load();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [roomId, session, meKey]);

  if (session === undefined || room.status === 'loading') return <StatusScreen kind="loading" />;
  if (room.status === 'missing' || !snapshot) return <StatusScreen kind="missing" />;
  if (Date.parse(snapshot.expiresAt) <= serverNow()) return <StatusScreen kind="expired" />;

  if (!session) {
    if (snapshot.participants.length >= 15) return <StatusScreen kind="full" />;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
        <Logo size="lg" />
        <p className="text-center text-lg">Te invitaron a decidir qué se come. ¿Cómo te llamamos?</p>
        <NicknameForm
          submitLabel="Entrar"
          onSubmit={async (nickname) => {
            const joined = await joinRoom(roomId, nickname);
            const next = { participantId: joined.participantId, token: joined.token };
            saveSession(roomId, next);
            setSession(next);
          }}
        />
      </main>
    );
  }

  const roundNumber = snapshot.round?.number ?? 0;
  if (!me || (snapshot.phase !== 'lobby' && me.roundNumber !== roundNumber)) return <StatusScreen kind="loading" />;

  const props: PhaseProps = {
    roomId,
    session,
    snapshot,
    me,
    isHost: snapshot.hostParticipantId === session.participantId,
  };

  return (
    <>
      {room.reconnecting && (
        <p className="fixed inset-x-0 top-0 z-50 bg-secondary py-1 text-center text-sm font-bold">Reconectando…</p>
      )}
      {hostNotice && (
        <p role="status" className="fixed inset-x-4 bottom-4 z-50 rounded-2xl bg-ink px-4 py-3 text-center font-bold text-white">
          {hostNotice}
        </p>
      )}
      {renderPhase(props)}
    </>
  );
}

function renderPhase(props: PhaseProps) {
  switch (props.snapshot.phase) {
    case 'lobby':
      return <LobbyScreen {...props} />;
    case 'voting':
      return <VotingScreen key={`voting-${props.me.roundNumber}`} {...props} />;
    default:
      return <StatusScreen kind="loading" />;
  }
}
