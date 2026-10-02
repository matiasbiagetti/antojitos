import catalog from './avatars.json';

/** Catálogo completo: solo lo importan el servidor y el selector (no la pantalla inicial). */
export type AvatarCategory = { id: string; label: string; icon: string; avatars: string[] };

export const AVATAR_CATEGORIES: AvatarCategory[] = catalog.categories;

const CATEGORY_BY_ID = new Map(AVATAR_CATEGORIES.flatMap((c) => c.avatars.map((id) => [id, c.id] as const)));

export const isAvatarId = (value: unknown): value is string => typeof value === 'string' && CATEGORY_BY_ID.has(value);

export const avatarCategoryOf = (id: string): string | undefined => CATEGORY_BY_ID.get(id);
