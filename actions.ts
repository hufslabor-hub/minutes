'use server';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';
import { adminAuth } from '@/lib/firebase';
import { createSessionCookie } from '@/lib/auth';
import { limit } from '@/lib/ratelimit';
import { normalizeDomain, validateSignup } from '@/lib/signup';

const f = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

// 실패해도 입력한 이름·이메일은 화면에 남기기 위해 값을 함께 돌려줍니다(비밀번호는 제외).
export type SignupState = { error: string; name: string; email: string } | null;

const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export async function signup(_p: SignupState, fd: FormData): Promise<SignupState> {
  const name = f(fd, 'name', 50);
  const email = f(fd, 'email', 200).toLowerCase();
  const fail = (error: string): SignupState => ({ error, name, email });

  const secret = process.env.SIGNUP_CODE;   // 가입 코드가 없으면 회원가입은 닫힌 상태
  if (!secret) return fail('현재 회원가입을 받지 않고 있습니다. 관리자에게 문의해 주세요.');

  const password = String(fd.get('password') ?? '').slice(0, 200);
  const input = { name, email, password, password2: String(fd.get('password2') ?? '').slice(0, 200), code: f(fd, 'code', 100) };
  const bad = validateSignup(input);
  if (bad) return fail(bad);

  if (!(await limit('signup', null, 10, 3600))) return fail('시도가 너무 많습니다. 1시간 뒤에 다시 시도해 주세요.');
  if (!sameSecret(input.code, secret)) return fail('가입 코드가 올바르지 않습니다.');
  const domain = normalizeDomain(process.env.SIGNUP_EMAIL_DOMAIN);
  if (domain && !email.endsWith(`@${domain}`)) return fail(`@${domain} 이메일로만 가입할 수 있습니다.`);

  const auth = adminAuth();
  let uid: string;
  try {
    uid = (await auth.createUser({ email, password, displayName: name })).uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/email-already-exists') return fail('이미 가입된 이메일입니다. 로그인해 주세요.');
    if (code === 'auth/invalid-email') return fail('이메일 형식이 올바르지 않습니다.');
    console.error('signup createUser error', e);
    return fail('회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  try {
    await auth.setCustomUserClaims(uid, { member: true });   // 이 권한이 있으면 앱을 쓸 수 있음
  } catch (e) {
    console.error('signup claims error', e);
    await auth.deleteUser(uid).catch(() => {});               // 권한 없는 계정이 남지 않도록 정리
    return fail('회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  // 가입 직후 자동 로그인: 웹 API 키가 설정돼 있을 때만 (없으면 로그인 화면으로 안내)
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) redirect('/login?joined=1');
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!r.ok) redirect('/login?joined=1');
  const { idToken } = await r.json();
  await createSessionCookie(idToken);
  redirect('/');
}
