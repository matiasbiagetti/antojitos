'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { randomDefaultAvatar } from '@/lib/domain/avatar-defaults';
import { messageFor } from '@/lib/client/messages';
import { Avatar } from './Avatar';

// El catálogo completo solo se descarga al abrir el selector.
const AvatarPicker = dynamic(() => import('./AvatarPicker').then((m) => m.AvatarPicker), { ssr: false });

export function NicknameForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (nickname: string, avatarId: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el azar solo en el cliente, para no romper la hidratación
    setAvatarId(randomDefaultAvatar());
  }, []);

  const closePicker = useCallback(() => setPicking(false), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!avatarId) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(nickname, avatarId);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <button
        type="button"
        aria-label="Elegir avatar"
        onClick={() => setPicking(true)}
        disabled={busy || !avatarId}
        className="mx-auto flex flex-col items-center gap-1 disabled:opacity-50"
      >
        {avatarId ? <Avatar id={avatarId} size={80} /> : <span className="block size-20 rounded-full bg-ink/10" />}
        <span className="text-sm font-bold text-primary">Cambiar</span>
      </button>
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
        disabled={busy || !avatarId || nickname.trim() === ''}
        className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Un segundo…' : submitLabel}
      </button>
      {picking && avatarId && (
        <AvatarPicker
          selected={avatarId}
          onSelect={(id) => {
            setAvatarId(id);
            setPicking(false);
          }}
          onClose={closePicker}
        />
      )}
    </form>
  );
}
