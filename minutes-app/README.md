# 회의록 요약 (hufs-minutes)

## 설정 방법

1. `npm install`

2. Firebase Console에서 **서비스 계정 키** 발급
   - 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
   - `.env.local` 파일 생성 후 아래 값 입력:

```env
FIREBASE_PROJECT_ID=hufs-minutes
FIREBASE_CLIENT_EMAIL=...@hufs-minutes.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

3. Firebase Console → Authentication → Sign-in method에서 **이메일/비밀번호** 사용 설정 ON

4. `npm run dev`

## 주요 기능

- 드래그 앤 드롭 PDF 업로드 (최대 10MB)
- 이메일/비밀번호 회원가입 · 로그인 (Firebase Auth + 세션 쿠키)
- 회의록 AI 요약 (기존 /api/summarize)
