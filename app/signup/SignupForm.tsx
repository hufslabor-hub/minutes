'use client';
import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signup } from './actions';

export default function SignupForm({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState(signup, null);
  const errRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state?.error) errRef.current?.focus(); }, [state]);

  return (
    <form action={action} className="form">
      <label>이름<input name="name" autoComplete="name" required maxLength={50} defaultValue={state?.name ?? ''} /></label>
      <label>이메일{domain ? ` (@${domain})` : ''}
        <input name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={state?.email ?? ''} />
      </label>
      <label>비밀번호 (8자 이상)<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      <label>비밀번호 확인<input name="password2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      <label>가입 코드 (관리자에게 받은 코드)<input name="code" autoComplete="off" required maxLength={100} /></label>
      {state?.error && <p ref={errRef} tabIndex={-1} className="err" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? '가입 중…' : '회원가입'}</button>
      <p className="meta">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
    </form>
  );
}
