import { notFound } from 'next/navigation';
import SignupForm from '@/components/SignupForm';

export const dynamic = 'force-dynamic';   // 가입 코드 설정 여부를 요청마다 확인
export const metadata = { title: '회원가입' };

export default function Signup() {
  if (!process.env.SIGNUP_CODE) notFound();
  return (
    <div className="narrow">
      <h1>회원가입</h1>
      <p className="meta">전달받은 가입 코드가 있어야 가입할 수 있습니다.</p>
      <SignupForm />
    </div>
  );
}
