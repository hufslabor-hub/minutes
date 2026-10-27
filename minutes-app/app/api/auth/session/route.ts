import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, clearSessionCookie } from '@/lib/auth';

/** 클라이언트에서 Firebase ID 토큰을 받아 세션 쿠키 발급 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken이 필요합니다.' }, { status: 400 });
    }
    await createSessionCookie(idToken);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[session]', e);
    return NextResponse.json({ error: '세션 생성에 실패했습니다.' }, { status: 401 });
  }
}

/** 로그아웃 – 세션 쿠키 삭제 */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
