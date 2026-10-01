'use client';

import { useState } from 'react';
import type { PhaseProps } from './RoomScreen';
import { HostControls } from './HostControls';
import { Logo } from './Logo';
import { VisibilitySummary } from './VisibilitySummary';

export function LobbyScreen({ roomId, session, snapshot, isHost }: PhaseProps) {
  const [copied, setCopied] = useState(false);
  const host = snapshot.participants.find((p) => p.id === snapshot.hostParticipantId);

  async function share() {
    const url = `${window.location.origin}/j/${roomId}`;
    if (navigator.share) {
      await navigator.share({ title: 'Antojitos', text: '¿Qué se come? Sumate:', url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <li key={p.id} className="rounded-full bg-secondary/20 px-3 py-1 font-semibold">
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
      <VisibilitySummary config={snapshot.config} />
      {isHost ? (
        <HostControls
          roomId={roomId}
          token={session.token}
          config={snapshot.config}
          participantCount={snapshot.participants.length}
        />
      ) : (
        <p className="text-center text-ink/70">Esperando que {host?.nickname ?? 'el anfitrión'} arranque la ronda…</p>
      )}
    </main>
  );
}
