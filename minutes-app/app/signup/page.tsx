import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { SignupForm } from './SignupForm';

export const metadata = { title: '회원가입' };

export default async function SignupPage() {
  const user = await getUser();
  if (user) redirect('/');

  return (
    <div className="auth-box">
      <h1>회원가입</h1>
      <p className="meta">이메일과 비밀번호로 간단하게 가입할 수 있습니다.</p>
      <SignupForm />
      <p className="auth-switch">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </div>
  );
}
