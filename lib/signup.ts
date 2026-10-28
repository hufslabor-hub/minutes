/** 회원가입 입력값 검사 (서버 동작과 시험에서 함께 사용) */
export type SignupInput = { name: string; email: string; password: string; password2: string; code: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 문제가 있으면 안내 문구를, 괜찮으면 null을 돌려줍니다. */
export function validateSignup(i: SignupInput): string | null {
  if (!i.name) return '이름을 입력해 주세요.';
  if (!EMAIL.test(i.email) || i.email.length > 200) return '이메일 형식이 올바르지 않습니다.';
  if (i.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (i.password.length > 128) return '비밀번호가 너무 깁니다. (128자 이하)';
  if (i.password !== i.password2) return '비밀번호 확인이 일치하지 않습니다.';
  if (!i.code) return '가입 코드를 입력해 주세요.';
  return null;
}

/** 가입 허용 이메일 도메인 설정값 정리 (예: "@hufs.ac.kr" → "hufs.ac.kr") */
export const normalizeDomain = (d: string | undefined) => (d ?? '').trim().toLowerCase().replace(/^@/, '');
