import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from './firebase';

export const SESSION = 'session';
export const SESSION_SEC = 60 * 60 * 24 * 5;
export type User = { uid: string; email: string };

const allowList = () => (process.env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
/** 허용된 이메일이거나, Firebase 계정에 admin 권한이 있으면 사용 가능 */
export const isAllowed = (d: { email?: string; admin?: unknown }) =>
  d.admin === true || (!!d.email && allowList().includes(d.email.toLowerCase()));

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

/** ID 토큰 → 세션 쿠키 발급 */
export async function createSessionCookie(idToken: string) {
  const expiresIn = SESSION_SEC * 1000;
  const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  const cookieStore = await cookies();
  cookieStore.set(SESSION, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_SEC,
    path: '/',
  });
}



/** 세션 쿠키 삭제 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION);
}

