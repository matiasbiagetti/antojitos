'use client';

import { useState, type FormEvent } from 'react';
import { messageFor } from '@/lib/client/messages';

export function NicknameForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (nickname: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(nickname);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label htmlFor="nickname" className="text-sm font-bold">
        Tu apodo
      </label>
      <input
        id="nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={40}
        autoComplete="nickname"
        placeholder="Ej: Juli"
        className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-lg outline-none focus:border-primary"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || nickname.trim() === ''}
        className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Un segundo…' : submitLabel}
      </button>
    </form>
  );
}
