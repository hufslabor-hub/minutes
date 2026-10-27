import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from './firebase-admin';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14일

export type AppUser = {
  uid: string;
  email: string | null;
  name: string | null;
};

/** 세션 쿠키에서 현재 로그인한 사용자 정보 반환 (없으면 null) */
export async function getUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
    };
  } catch {
    return null;
  }
}

/** 로그인 필수 – 없으면 /login 으로 이동 */
export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/** ID 토큰 → 세션 쿠키 발급 */
export async function createSessionCookie(idToken: string) {
  const expiresIn = SESSION_MAX_AGE * 1000;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/** 세션 쿠키 삭제 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
