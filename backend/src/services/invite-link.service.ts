/**
 * Shareable invite links.
 *
 * The QR code carries a short code, but not everyone is standing in front of the
 * other person. A link can be sent over SMS, chat or email, and opened later on
 * a phone or a laptop.
 *
 * Two shapes are produced:
 *   - a web link, for pasting into a message or email
 *   - a deep link, for a phone that scans it
 */

export interface InviteLinkOptions {
  /** Public origin, e.g. `https://api.safetyapp.example`. */
  baseUrl: string;
  code: string;
  /** Custom scheme the mobile app registers, e.g. `safetyapp`. */
  appScheme: string;
  /** Name of the person inviting, shown on the landing screen. */
  inviterName?: string | null;
}

export interface InviteLinks {
  /** Open in a browser. */
  web: string;
  /** Opens the app directly when scanned or tapped on a phone. */
  deep: string;
  code: string;
}

export function buildInviteLinks(options: InviteLinkOptions): InviteLinks {
  const base = options.baseUrl.replace(/\/+$/, '');
  const scheme = options.appScheme.replace(/:\/\/?$/, '');

  const web = `${base}/api/v1/invites/redeem/${options.code}`;

  // A universal link would be better on iOS, but that needs an Apple-hosted
  // domain, so the custom scheme is the portable choice for a hackathon.
  const query = new URLSearchParams({ code: options.code });
  if (options.inviterName) query.set('by', options.inviterName);

  return { web, deep: `${scheme}://invite?${query.toString()}`, code: options.code };
}

/**
 * Pulls the code out of whatever the user pasted.
 *
 * People paste the whole link as often as they type the bare code, so accept
 * both, with stray whitespace and a trailing slash.
 */
export function extractCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare code: K7M2XPQ4
  if (/^[A-Z0-9]{4,16}$/i.test(trimmed)) return trimmed.toUpperCase();

  // A link, in either shape we generate, or a deep link with ?code=.
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('code');
    if (fromQuery) return fromQuery.toUpperCase();

    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments.at(-1);
    if (last && /^[A-Za-z0-9]{4,16}$/.test(last)) return last.toUpperCase();
  } catch {
    // Not a URL: fall through to the bare-code check above.
  }

  // A bare code trailing a scheme-less prefix, e.g. "invite/K7M2XPQ4".
  const tail = trimmed.split(/[/?#]/).at(-1);
  if (tail && /^[A-Za-z0-9]{4,16}$/.test(tail)) return tail.toUpperCase();

  return null;
}