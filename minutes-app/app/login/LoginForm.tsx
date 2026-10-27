'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (err) errRef.current?.focus();
  }, [err]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const r = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? '세션 생성에 실패했습니다.');
      }

      router.push('/');
      router.refresh();
    } catch (x: unknown) {
      const code = (x as { code?: string })?.code ?? '';
      let msg = '로그인에 실패했습니다.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (code === 'auth/too-many-requests') {
        msg = '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      } else if (x instanceof Error && x.message) {
        msg = x.message;
      }
      setErr(msg);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        이메일
        <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </label>
      <label>
        비밀번호
        <input name="password" type="password" required autoComplete="current-password" minLength={6} />
      </label>
      {err && (
        <p ref={errRef} tabIndex={-1} className="err" role="alert">
          {err}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
