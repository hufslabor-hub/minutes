'use server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/firebase';
import { SESSION, SESSION_SEC, isAllowed, requireUser } from '@/lib/auth';
import { limit } from '@/lib/ratelimit';
import { removeMinute, updateMinute, getMinute } from '@/lib/minutes';
import { CATEGORIES, isDate, textToActions, textToList } from '@/lib/format';

const f = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

export async function login(_p: string | null, fd: FormData): Promise<string | null> {
  const email = f(fd, 'email', 200);
  if (!(await limit('login', email.toLowerCase(), 10, 900))) return '시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요.';
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: String(fd.get('password') ?? '').slice(0, 200), returnSecureToken: true }),
  });
  if (!r.ok) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  const { idToken } = await r.json();
  const dec = await adminAuth().verifyIdToken(idToken);
  if (!isAllowed(dec)) return '이 앱을 사용할 수 있는 계정이 아닙니다.';
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_SEC * 1000 });
  (await cookies()).set(SESSION, cookie, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_SEC });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION);
  redirect('/login');
}

export async function saveMinute(fd: FormData) {
  await requireUser();
  const id = f(fd, 'id', 40);
  const cur = await getMinute(id);
  if (!cur) throw new Error('회의록을 찾을 수 없습니다.');
  const date = f(fd, 'meetingDate', 10);
  const cat = f(fd, 'category', 20);
  await updateMinute(id, {
    title: f(fd, 'title', 200) || cur.title,
    meetingDate: isDate(date) ? date : cur.meetingDate,
    dateGuessed: isDate(date) ? false : cur.dateGuessed,
    category: (CATEGORIES as readonly string[]).includes(cat) ? cat : '',
    place: f(fd, 'place', 200),
    attendees: textToList(f(fd, 'attendees', 4000), 100),
    overview: f(fd, 'overview', 5000),
    agenda: textToList(f(fd, 'agenda', 6000)),
    decisions: textToList(f(fd, 'decisions', 8000)),
    actionItems: textToActions(f(fd, 'actionItems', 8000)),
    keyPoints: textToList(f(fd, 'keyPoints', 8000)),
    nextMeeting: f(fd, 'nextMeeting', 1000),
  });
  redirect(`/m/${id}`);
}

export async function deleteMinute(fd: FormData) {
  await requireUser();
  await removeMinute(f(fd, 'id', 40));
  redirect('/');
}

// ── 가입 코드로 직접 가입 (SIGNUP_CODE 환경변수가 있을 때만 열림) ──
const sameCode = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export async function signup(_p: { ok: boolean; msg: string } | null, fd: FormData): Promise<{ ok: boolean; msg: string }> {
  const code = process.env.SIGNUP_CODE;
  if (!code) return { ok: false, msg: '지금은 회원가입을 받지 않습니다.' };
  if (!(await limit('signup', null, 8, 3600))) return { ok: false, msg: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
  const email = f(fd, 'email', 200).toLowerCase(), name = f(fd, 'name', 50), password = String(fd.get('password') ?? '').slice(0, 200);
  if (!sameCode(f(fd, 'code', 200), code)) return { ok: false, msg: '가입 코드가 올바르지 않습니다.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, msg: '이메일 형식이 올바르지 않습니다.' };
  if (password.length < 10) return { ok: false, msg: '비밀번호는 10자 이상이어야 합니다.' };
  try {
    const u = await adminAuth().createUser({ email, password, ...(name ? { displayName: name } : {}) });
    await adminAuth().setCustomUserClaims(u.uid, { minutes: true });
  } catch (e) {
    const c = (e as { code?: string }).code;
    return { ok: false, msg: c === 'auth/email-already-exists' ? '이미 가입된 이메일입니다. 로그인해 주세요.' : c === 'auth/invalid-password' ? '비밀번호가 너무 간단합니다.' : '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  return { ok: true, msg: '가입되었습니다. 이제 로그인해 주세요.' };
}
