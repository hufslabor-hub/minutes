'use server';
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
