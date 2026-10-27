'use client';
import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signup } from '@/app/actions';

export default function SignupForm() {
  const [res, act, pending] = useActionState(signup, null);
  const msgRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (res) msgRef.current?.focus(); }, [res]);
  return (
    <form action={act} className="form">
      <label>이름 (선택)<input name="name" maxLength={50} autoComplete="name" /></label>
      <label>이메일<input name="email" type="email" autoComplete="username" required /></label>
      <label>비밀번호 (10자 이상)<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>가입 코드<input name="code" type="password" autoComplete="off" required /></label>
      {res && <p ref={msgRef} tabIndex={-1} className={res.ok ? 'ok' : 'err'} role="alert">{res.msg}</p>}
      <button className="btn" disabled={pending}>{pending ? '가입 중…' : '가입하기'}</button>
      <p className="meta"><Link href="/login">로그인으로 돌아가기</Link></p>
    </form>
  );
}
