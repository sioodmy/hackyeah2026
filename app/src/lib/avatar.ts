/**
 * Parsing for the single `avatarUrl` column, which packs an emoji and an optional
 * signature colour into one string: `"🌸"` or `"🌸|#F472B6"`.
 *
 * There is one parser rather than a `.split('|')` at each call site because
 * forgetting it shows the user a friend as `🌸|#F472B6` — the raw payload leaking
 * into the friends list, which is exactly what happened before this existed.
 *
 * The shape is enforced server-side in `UserProfileUpdate`, so `aura` is either a
 * `#RRGGBB` string or null.
 */

export const DEFAULT_AVATAR_EMOJI = '🌸';

const AURA_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type ParsedAvatar = {
  emoji: string;
  aura: string | null;
};

export function parseAvatar(avatarUrl: string | null | undefined): ParsedAvatar {
  const raw = avatarUrl?.trim();
  if (!raw) return { emoji: DEFAULT_AVATAR_EMOJI, aura: null };

  const separator = raw.indexOf('|');
  if (separator === -1) return { emoji: raw, aura: null };

  const emoji = raw.slice(0, separator).trim() || DEFAULT_AVATAR_EMOJI;
  const aura = raw.slice(separator + 1).trim();
  return { emoji, aura: AURA_PATTERN.test(aura) ? aura : null };
}

export function avatarEmoji(avatarUrl: string | null | undefined): string {
  return parseAvatar(avatarUrl).emoji;
}
