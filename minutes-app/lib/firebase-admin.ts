import 'server-only';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firebase Admin 초기화
 *
 * 환경 변수에 서비스 계정 키를 넣는 것을 권장합니다.
 * (Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성)
 *
 * 필수 환경 변수 예시:
 *   FIREBASE_PROJECT_ID=hufs-minutes
 *   FIREBASE_CLIENT_EMAIL=...@hufs-minutes.iam.gserviceaccount.com
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *
 * 또는 GOOGLE_APPLICATION_CREDENTIALS 로 JSON 파일 경로를 지정해도 됩니다.
 */
function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'hufs-minutes';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  // 로컬 개발용: Application Default Credentials 또는 에뮬레이터
  return initializeApp({ projectId });
}

const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
