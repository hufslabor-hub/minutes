'use client';
import { useActionState } from 'react';
import { login } from '@/app/actions';

export default function LoginForm() {
  const [err, act, pending] = useActionState(login, null);
  return (
    <form action={act} className="form">
      <label>이메일<input name="email" type="email" autoComplete="username" required /></label>
      <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={pending}>{pending ? '확인 중…' : '로그인'}</button>
    </form>
  );
}
