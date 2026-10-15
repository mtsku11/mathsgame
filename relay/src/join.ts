// Who is joining which room. Room codes come from the classroom screen; only the published game and local development may connect.
export type Join = { room: string; role: 'host' } | { room: string; role: 'pad'; player: number };

export const ROOM_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/;
const ORIGINS = [/^https:\/\/mtsku11\.github\.io$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];

export function parseJoin(url: URL, origin: string | null): Join | null {
  const match = /^\/room\/([^/]+)$/.exec(url.pathname);
  if (!match || !ROOM_PATTERN.test(match[1]) || !origin || !ORIGINS.some(pattern => pattern.test(origin))) return null;
  const role = url.searchParams.get('role');
  if (role === 'host') return { room: match[1], role };
  const player = url.searchParams.get('player') ?? '';
  return role === 'pad' && /^[0-3]$/.test(player) ? { room: match[1], role, player: Number(player) } : null;
}
