import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { limit } from '@/lib/ratelimit';
import { summarizePdf, type Draft } from '@/lib/summarize';
import { createMinute } from '@/lib/minutes';
import { dropUpload, readUpload, UploadError } from '@/lib/uploads';
import { CATEGORIES, DIRECT_MAX_BYTES, DIRECT_MAX_MB, isDate, kstToday } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * PDF 요약 후 저장.
 *  - 4MB 이하: 화면이 파일을 그대로 보냄 (multipart/form-data)
 *  - 4MB 초과: 화면이 /api/upload/* 로 조각을 먼저 올리고, 여기에는 업로드 번호만 보냄 (application/json)
 *    → Vercel의 요청 크기 제한(약 4.5MB)을 피하기 위함
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return fail('로그인이 필요합니다.', 401);
  if (!(await limit('summarize', user.uid, 15, 3600))) return fail('1시간에 15개까지 요약할 수 있습니다. 잠시 후 다시 시도해 주세요.', 429);

  let buf: Buffer;
  let fileName: string;
  let memo: string, cat: string, hint: string;
  let uploadId = '';

  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    let b: { uploadId?: unknown; fileName?: unknown; memo?: unknown; category?: unknown; date?: unknown };
    try { b = await req.json(); } catch { return fail('요청을 읽을 수 없습니다.', 400); }
    uploadId = String(b.uploadId ?? '');
    try {
      const up = await readUpload(user.uid, uploadId);
      buf = up.buf;
      fileName = String(b.fileName ?? '') || up.name;
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message, e.status);
      console.error('read upload error', e);
      return fail('올린 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
    }
    memo = String(b.memo ?? '');
    cat = String(b.category ?? '');
    hint = String(b.date ?? '');
  } else {
    let form: FormData;
    try { form = await req.formData(); } catch { return fail('파일을 읽을 수 없습니다. PDF 파일인지 확인해 주세요.', 400); }
    const file = form.get('file');
    if (!(file instanceof File)) return fail('PDF 파일을 선택해 주세요.', 400);
    if (file.size > DIRECT_MAX_BYTES) return fail(`이 방식으로는 ${DIRECT_MAX_MB}MB까지만 보낼 수 있습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.`, 413);
    buf = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
    memo = String(form.get('memo') ?? '');
    cat = String(form.get('category') ?? '');
    hint = String(form.get('date') ?? '');
  }

  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    if (uploadId) await dropUpload(uploadId).catch(() => {});
    return fail('PDF 파일이 아닙니다.', 400);
  }

  memo = memo.trim().slice(0, 500);
  const category = (CATEGORIES as readonly string[]).includes(cat) ? cat : '';

  let draft: Draft;
  try { draft = await summarizePdf(buf, { memo, category }); }
  catch (e) { return fail(e instanceof Error ? e.message : '요약에 실패했습니다.', 502); }   // 올린 조각은 남겨 두어 다시 시도 가능

  // 날짜: 사용자가 입력했으면 그 값, 아니면 문서에서 찾은 값, 둘 다 없으면 오늘(확인 필요 표시)
  const found = isDate(draft.meetingDate) ? draft.meetingDate : '';
  const meetingDate = isDate(hint) ? hint : found || kstToday();
  const dateGuessed = !isDate(hint) && !found;

  const id = await createMinute({
    ...draft, meetingDate, category, memo, dateGuessed,
    fileName: fileName.slice(0, 200),
  });
  if (uploadId) await dropUpload(uploadId).catch((e) => console.error('drop upload error', e));   // 원본은 보관하지 않음
  return NextResponse.json({ id });
}
