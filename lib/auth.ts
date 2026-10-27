import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from './firebase';

export const SESSION = 'session';
export const SESSION_SEC = 60 * 60 * 24 * 5;
export type User = { uid: string; email: string };

const allowList = () => (process.env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
/** 사용 가능: Firebase admin 권한이 있거나, 가입 코드로 가입(minutes 권한)했거나, 허용 이메일 목록에 있는 계정 */
export const isAllowed = (d: { email?: string; admin?: unknown; minutes?: unknown }) =>
  d.admin === true || d.minutes === true || (!!d.email && allowList().includes(d.email.toLowerCase()));

export async function getUser(): Promise<User | null> {
  const c = (await cookies()).get(SESSION)?.value;
  if (!c) return null;
  try {
    const d = await adminAuth().verifySessionCookie(c, true);
    return isAllowed(d) ? { uid: d.uid, email: d.email ?? '' } : null;
  } catch { return null; }
}
/** 모든 화면과 동작의 첫 줄에서 호출(서버에서 확인) */
export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect('/login');
  return u;
}
