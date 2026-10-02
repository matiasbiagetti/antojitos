'use client';

import { useState } from 'react';
import type { PhaseProps } from './RoomScreen';
import { Avatar } from './Avatar';
import { HostControls } from './HostControls';
import { Logo } from './Logo';
import { TakeHostBanner } from './TakeHostBanner';
import { VisibilitySummary } from './VisibilitySummary';

export function LobbyScreen({ roomId, session, snapshot, isHost, canTakeHost }: PhaseProps) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const host = snapshot.participants.find((p) => p.id === snapshot.hostParticipantId);

  async function share() {
    const url = `${window.location.origin}/j/${roomId}`;
    if (navigator.share) {
      await navigator.share({ title: 'Antojitos', text: '¿Qué se come? Sumate:', url }).catch(() => undefined);
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setManualUrl(url);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <Logo />
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">
          Participantes ({snapshot.participants.length}/15)
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {snapshot.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-secondary/20 py-1 pl-1 pr-3 font-semibold">
              <Avatar id={p.avatarId} size={24} />
              {p.nickname}
              {p.id === snapshot.hostParticipantId && ' 👑'}
              {p.id === session.participantId && ' (vos)'}
            </li>
          ))}
        </ul>
      </section>
      <button
        type="button"
        onClick={() => void share()}
        className="rounded-2xl border-2 border-primary px-4 py-3 font-extrabold text-primary"
      >
        {copied ? '¡Link copiado!' : 'Compartir link'}
      </button>
      {manualUrl && (
        <input
          readOnly
          value={manualUrl}
          aria-label="Link de la sala"
          onFocus={(e) => e.currentTarget.select()}
          className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-sm"
        />
      )}
      <VisibilitySummary config={snapshot.config} />
      {isHost ? (
        <HostControls
          roomId={roomId}
          token={session.token}
          config={snapshot.config}
          participantCount={snapshot.participants.length}
        />
      ) : canTakeHost ? (
        <TakeHostBanner roomId={roomId} token={session.token} hostNickname={host?.nickname ?? 'El anfitrión'} />
      ) : (
        <p className="text-center text-ink/70">Esperando que {host?.nickname ?? 'el anfitrión'} arranque la ronda…</p>
      )}
    </main>
  );
}
