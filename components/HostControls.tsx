'use client';

import { useState } from 'react';
import { startRound, updateConfig } from '@/lib/client/api';
import { messageFor } from '@/lib/client/messages';
import { ROUND_SECONDS_OPTIONS, type RoomConfig, type RoundSeconds } from '@/lib/domain/types';
import { VISIBILITY_LABELS } from './VisibilitySummary';

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

  async function save(next: RoomConfig) {
    setError(null);
    try {
      await updateConfig(roomId, token, next);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
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
          <label className="flex items-center gap-3 text-ink/60">
            <input type="checkbox" checked disabled className="size-5 accent-primary" />
            La categoría ganadora (siempre)
          </label>
        </li>
        {VISIBILITY_LABELS.map(({ key, label }) => (
          <li key={key}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.visibility[key]}
                onChange={(e) => void save({ ...config, visibility: { ...config.visibility, [key]: e.target.checked } })}
                className="size-5 accent-primary"
              />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center justify-between gap-3">
        <span>Duración de la ronda</span>
        <select
          value={config.roundSeconds}
          onChange={(e) => void save({ ...config, roundSeconds: Number(e.target.value) as RoundSeconds })}
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
