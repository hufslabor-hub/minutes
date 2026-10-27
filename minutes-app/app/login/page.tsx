import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: '로그인' };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect('/');

  return (
    <div className="auth-box">
      <h1>로그인</h1>
      <p className="meta">회의록 요약 서비스에 오신 것을 환영합니다.</p>
      <LoginForm />
      <p className="auth-switch">
        계정이 없으신가요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
