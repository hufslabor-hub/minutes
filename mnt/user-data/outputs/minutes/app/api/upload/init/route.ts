import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { limit } from '@/lib/ratelimit';
import { initUpload, UploadError } from '@/lib/uploads';

export const runtime = 'nodejs';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** 큰 PDF 조각 업로드 시작: 업로드 번호와 조각 개수를 돌려줍니다. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return fail('로그인이 필요합니다.', 401);
  if (!(await limit('upload', user.uid, 15, 3600))) return fail('1시간에 15개까지 올릴 수 있습니다. 잠시 후 다시 시도해 주세요.', 429);

  let b: { size?: unknown; name?: unknown };
  try { b = await req.json(); } catch { return fail('요청을 읽을 수 없습니다.', 400); }
  try {
    return NextResponse.json(await initUpload(user.uid, Number(b.size), String(b.name ?? '')));
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, e.status);
    console.error('upload init error', e);
    return fail('업로드를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
