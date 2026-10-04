/**
 * The public profile a friend is allowed to see.
 *
 * This is what gets attached to a friend request and to a push notification:
 * enough for the other person to recognise and reach her, and nothing more.
 */

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /**
   * Free text about her that is useful in an emergency. Visible to friends by
   * default, because the moment it matters is the moment nobody can ask.
   */
  emergencyNote: string | null;
  phone: string | null;
}

/**
 * Fields that are never shared, whatever the friendship: internal ids other
 * than this one, the Clerk id, push settings and row timestamps.
 */
export function toPublicProfile(user: {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  emergencyNote: string | null;
  phone: string | null;
  shareProfileWithFriends: boolean;
}): PublicProfile {
  // With sharing off, the friend still gets a name to recognise, but nothing
  // personal. Blocking the whole profile would make an alert unidentifiable.
  if (!user.shareProfileWithFriends) {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: null,
      emergencyNote: null,
      phone: user.phone,
    };
  }

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    emergencyNote: user.emergencyNote,
    phone: user.phone,
  };
}

/**
 * What the user calls this person. Local only: a nickname must never travel to
 * the other person, or "ex" and "Mamusia" would become visible to the wrong
 * side.
 */
export function displayName(contact: {
  nickname: string | null;
  name: string;
}): string {
  return contact.nickname?.trim() || contact.name;
}
