'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export function SignupForm() {
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
    const password2 = String(fd.get('password2') ?? '');
    const name = String(fd.get('name') ?? '').trim().slice(0, 40);

    if (password !== password2) {
      setErr('비밀번호가 서로 다릅니다.');
      setBusy(false);
      return;
    }
    if (password.length < 6) {
      setErr('비밀번호는 6자 이상이어야 합니다.');
      setBusy(false);
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
      const idToken = await cred.user.getIdToken(true);

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
      let msg = '회원가입에 실패했습니다.';
      if (code === 'auth/email-already-in-use') {
        msg = '이미 사용 중인 이메일입니다.';
      } else if (code === 'auth/invalid-email') {
        msg = '올바른 이메일 형식이 아닙니다.';
      } else if (code === 'auth/weak-password') {
        msg = '비밀번호가 너무 약합니다. 6자 이상 입력해 주세요.';
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
        이름 (선택)
        <input name="name" type="text" autoComplete="name" placeholder="홍길동" maxLength={40} />
      </label>
      <label>
        이메일
        <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </label>
      <label>
        비밀번호
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          placeholder="6자 이상"
        />
      </label>
      <label>
        비밀번호 확인
        <input name="password2" type="password" required autoComplete="new-password" minLength={6} />
      </label>
      {err && (
        <p ref={errRef} tabIndex={-1} className="err" role="alert">
          {err}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? '가입 중…' : '회원가입'}
      </button>
    </form>
  );
}
