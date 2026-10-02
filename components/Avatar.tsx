import Image from 'next/image';
import { avatarSrc } from '@/lib/domain/avatar-defaults';

/** Avatar emoji (PNG de Apple, ya comprimido): se sirve tal cual, sin optimización de Next. */
export function Avatar({ id, size, className = '' }: { id: string; size: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-secondary/20 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Snapshots viejos (salas abiertas durante un deploy) pueden no traer avatar */}
      {!id ? null : <Image
        src={avatarSrc(id)}
        alt=""
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        unoptimized
        draggable={false}
      />}
    </span>
  );
}
