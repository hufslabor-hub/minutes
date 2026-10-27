import Link from 'next/link';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: '로그인' };
export const dynamic = 'force-dynamic';   // 가입 코드 설정 여부를 요청마다 확인

export default function Login() {
  return (
    <div className="narrow">
      <h1>로그인</h1>
      <LoginForm />
      {process.env.SIGNUP_CODE && <p className="meta">계정이 없나요? <Link href="/signup">회원가입</Link></p>}
    </div>
  );
}
