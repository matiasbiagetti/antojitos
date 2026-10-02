'use client';

import { useEffect, useRef, useState } from 'react';
import { startRound, updateConfig } from '@/lib/client/api';
import { createLatestWinsSaver } from '@/lib/client/latest-wins-saver';
import { messageFor } from '@/lib/client/messages';
import { ROUND_SECONDS_OPTIONS, type RoomConfig, type RoundSeconds } from '@/lib/domain/types';
import { VISIBILITY_LABELS } from './VisibilitySummary';

function sameConfig(a: RoomConfig, b: RoomConfig): boolean {
  return (
    a.roundSeconds === b.roundSeconds &&
    VISIBILITY_LABELS.every(({ key }) => a.visibility[key] === b.visibility[key])
  );
}

export function HostControls({
  roomId,
  token,
  config,
  participantCount,
}: {
  roomId: string;
  token: string;
  config: RoomConfig;
  participantCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Estado local optimista: los cambios se ven al instante; el servidor se entera en segundo plano.
  const [local, setLocal] = useState(config);
  const snapshotConfig = useRef(config);
  // Ultima config confirmada por el servidor (para ignorar ecos realtime viejos).
  const [lastSent, setLastSent] = useState<RoomConfig | null>(null);
  const [saver] = useState(() =>
    createLatestWinsSaver<RoomConfig>(async (next) => {
      await updateConfig(roomId, token, next);
    }),
  );

  // Solo se sincroniza desde el snapshot cuando no hay cambios pendientes (evita parpadeo con el eco realtime).
  const [seenConfig, setSeenConfig] = useState(config);
  if (config !== seenConfig) {
    setSeenConfig(config);
    if (!saver.pending() && (lastSent === null || sameConfig(lastSent, config))) {
      setLocal(config);
    }
  }
  useEffect(() => {
    snapshotConfig.current = config;
  }, [config]);

  function change(next: RoomConfig) {
    setLocal(next);
    setError(null);
    saver.save(next).then(
      () => setLastSent(next),
      (err) => {
        setError(messageFor(err));
        setLastSent(null);
        setLocal(snapshotConfig.current);
      },
    );
  }

  async function start() {
    setStarting(true);
    try {
      // Si hay cambios de configuración en vuelo, esperamos a que terminen para no arrancar con config vieja.
      // Si ese guardado falla, change() ya mostró el error y revirtió: no arrancamos.
      do {
        if (!(await saver.idle())) {
          setStarting(false);
          return;
        }
      } while (saver.pending());
      setError(null);
      await startRound(roomId, token);
    } catch (err) {
      setError(messageFor(err));
      setStarting(false);
    }
  }

  const canStart = participantCount >= 2;

  return (
    <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-extrabold">Configuración (solo vos la ves)</h2>
      <ul className="space-y-2">
        <li>
          <label className="flex min-h-11 items-center gap-3 text-ink/60">
            <input type="checkbox" checked disabled className="size-6 accent-primary" />
            La categoría ganadora (siempre)
          </label>
        </li>
        {VISIBILITY_LABELS.map(({ key, label }) => (
          <li key={key}>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={local.visibility[key]}
                disabled={starting}
                onChange={(e) => change({ ...local, visibility: { ...local.visibility, [key]: e.target.checked } })}
                className="size-6 accent-primary"
              />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center justify-between gap-3">
        <span>Duración de la ronda</span>
        <select
          value={local.roundSeconds}
          disabled={starting}
          onChange={(e) => change({ ...local, roundSeconds: Number(e.target.value) as RoundSeconds })}
          className="rounded-xl border-2 border-ink/10 bg-white px-3 py-2"
        >
          {ROUND_SECONDS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} s
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void start()}
        disabled={!canStart || starting}
        className="w-full rounded-2xl bg-primary px-4 py-4 text-xl font-extrabold text-white shadow-md disabled:opacity-50"
      >
        Empezar
      </button>
      {!canStart && <p className="text-center text-sm text-ink/70">Esperando que se sume alguien más…</p>}
    </section>
  );
}
