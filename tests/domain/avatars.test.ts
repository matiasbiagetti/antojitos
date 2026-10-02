import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import defaults from '@/lib/domain/avatar-defaults.json';
import { avatarChar, avatarSrc, DEFAULT_AVATAR_CATEGORIES, randomDefaultAvatar } from '@/lib/domain/avatar-defaults';
import { AVATAR_CATEGORIES, avatarCategoryOf, isAvatarId } from '@/lib/domain/avatars';

const allIds = AVATAR_CATEGORIES.flatMap((c) => c.avatars);
const avatarsDir = path.join(process.cwd(), 'public', 'avatars');

describe('avatar catalog', () => {
  it('has the nine tabs in order, none empty, with an icon from its own list', () => {
    expect(AVATAR_CATEGORIES.map((c) => c.id)).toEqual([
      'smileys-emotion', 'people-body', 'animals-nature', 'food-drink', 'travel-places',
      'activities', 'objects', 'symbols', 'flags',
    ]);
    for (const c of AVATAR_CATEGORIES) {
      expect(c.avatars.length, c.id).toBeGreaterThan(0);
      expect(c.avatars).toContain(c.icon);
    }
  });

  it('has no duplicates and no gender variants', () => {
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.filter((id) => /200d-264[02]/.test(id))).toEqual([]);
  });

  it('has exactly one PNG per id (Review Focus 3)', () => {
    for (const id of allIds) expect(existsSync(path.join(avatarsDir, `${id}.png`)), id).toBe(true);
    expect(readdirSync(avatarsDir).length).toBe(allIds.length);
  });

  it('defaults are exactly the default categories', () => {
    const expected = AVATAR_CATEGORIES.filter((c) => DEFAULT_AVATAR_CATEGORIES.includes(c.id)).flatMap((c) => c.avatars);
    expect(defaults).toEqual(expected);
  });
});

describe('isAvatarId', () => {
  it('accepts catalog ids', () => {
    expect(isAvatarId('1f600')).toBe(true);
    expect(isAvatarId('1f355')).toBe(true);
  });

  it.each([[''], ['x'], ['1F600'], ['../1f600'], [1], [null], [undefined]])('rejects %j', (value) => {
    expect(isAvatarId(value)).toBe(false);
  });

  it('knows the category of an id', () => {
    expect(avatarCategoryOf('1f355')).toBe('food-drink');
    expect(avatarCategoryOf('nope')).toBeUndefined();
  });
});

describe('avatar defaults', () => {
  it('randomDefaultAvatar picks from the defaults, at both ends of the range', () => {
    expect(randomDefaultAvatar(() => 0)).toBe(defaults[0]);
    expect(randomDefaultAvatar(() => 0.999999)).toBe(defaults[defaults.length - 1]);
    for (let i = 0; i < 50; i++) {
      const id = randomDefaultAvatar();
      expect(DEFAULT_AVATAR_CATEGORIES).toContain(avatarCategoryOf(id));
    }
  });

  it('avatarSrc and avatarChar', () => {
    expect(avatarSrc('1f355')).toBe('/avatars/1f355.png');
    expect(avatarChar('1f355')).toBe('🍕');
    expect(avatarChar('1f468-200d-1f373')).toBe('👨‍🍳');
  });
});
