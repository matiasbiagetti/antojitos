import defaults from './avatar-defaults.json';

/** Liviano: lo usan el formulario y las pantallas sin cargar el catálogo completo. */
export const DEFAULT_AVATAR_CATEGORIES: readonly string[] = ['smileys-emotion', 'animals-nature', 'food-drink'];

export function randomDefaultAvatar(random: () => number = Math.random): string {
  return defaults[Math.min(defaults.length - 1, Math.floor(random() * defaults.length))];
}

export const avatarSrc = (id: string) => `/avatars/${id}.png`;

export const avatarChar = (id: string) => String.fromCodePoint(...id.split('-').map((hex) => parseInt(hex, 16)));
