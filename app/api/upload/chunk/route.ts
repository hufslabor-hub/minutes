import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { CHUNK_BYTES } from '@/lib/format';
import { putChunk, UploadError } from '@/lib/uploads';

export const runtime = 'nodejs';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** 조각 하나 저장: PUT /api/upload/chunk?id=업로드번호&i=조각번호 (본문은 파일 조각 그대로) */
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return fail('로그인이 필요합니다.', 401);

  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  const raw = q.get('i') ?? '';
  const i = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (Number(req.headers.get('content-length') ?? 0) > CHUNK_BYTES) return fail('조각이 너무 큽니다.', 413);

  const data = Buffer.from(await req.arrayBuffer());
  try {
    await putChunk(user.uid, id, i, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, e.status);
    console.error('upload chunk error', e);
    return fail('조각을 저장하지 못했습니다.', 500);
  }
}
