# 회의록 요약

PDF 회의록을 올리면 AI가 요약하고, 회의 날짜별로 저장·검색·수정·삭제·내려받기를 할 수 있는 웹앱입니다.
Next.js + Firestore(Admin SDK) + Anthropic API, Vercel 배포.

## 준비
1. Firebase 프로젝트(기존 홈페이지와 같은 프로젝트 가능): Firestore 사용, Authentication의 이메일/비밀번호 로그인 켜기, 사용할 사람 계정 만들기
2. `.env.example`을 참고해 환경변수 입력(Vercel에도 같은 값 등록)
   - `ALLOWED_EMAILS`: 이 앱을 쓸 수 있는 이메일(쉼표로 구분). 홈페이지 관리자(admin 권한) 계정도 쓸 수 있음
   - `ANTHROPIC_API_KEY`: console.anthropic.com에서 발급
3. Firestore 보안 규칙은 전부 차단(`allow read, write: if false;`)으로 두세요. 모든 접근은 서버에서만 합니다.

## 실행
```
npm install
npm run dev
```

## 알아둘 점
- PDF 한도는 4MB(Vercel 요청 크기 제한). 큰 PDF는 용량을 줄이거나 나눠 올려야 합니다.
- 원본 PDF는 저장하지 않고 요약만 Firestore에 보관합니다. 요약을 위해 PDF 내용이 Anthropic API로 전송됩니다.
- AI 요약에는 오류가 있을 수 있으니 중요한 내용은 원문과 대조하세요. 수정 화면에서 직접 고칠 수 있습니다.
- 요약 횟수는 사용자당 1시간에 15개로 제한되어 있습니다(`app/api/summarize/route.ts`).
