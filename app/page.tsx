'use client';

import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { NicknameForm } from '@/components/NicknameForm';
import { createRoom } from '@/lib/client/api';
import { saveSession } from '@/lib/client/session-token';

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" />
      <p className="text-center text-lg">
        ¿Qué se come? Armá una sala, compartí el link y que cada uno swipee en privado.
      </p>
      <NicknameForm
        submitLabel="Crear sala"
        onSubmit={async (nickname) => {
          const session = await createRoom(nickname);
          saveSession(session.roomId, { participantId: session.participantId, token: session.token });
          router.push(`/j/${session.roomId}`);
        }}
      />
    </main>
  );
}
