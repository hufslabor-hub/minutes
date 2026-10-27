import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { limit } from '@/lib/ratelimit';
import { summarizePdf, type Draft } from '@/lib/summarize';
import { createMinute } from '@/lib/minutes';
import { CATEGORIES, isDate, kstToday } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;   // Vercel 요청 크기 제한(약 4.5MB)에 맞춤

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return fail('로그인이 필요합니다.', 401);
  if (!(await limit('summarize', user.uid, 15, 3600))) return fail('1시간에 15개까지 요약할 수 있습니다. 잠시 후 다시 시도해 주세요.', 429);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail('파일을 읽을 수 없습니다. 4MB 이하의 PDF인지 확인해 주세요.', 400); }
  const file = form.get('file');
  if (!(file instanceof File)) return fail('PDF 파일을 선택해 주세요.', 400);
  if (file.size > MAX_BYTES) return fail('PDF는 4MB 이하만 올릴 수 있습니다. 용량을 줄이거나 나누어 올려 주세요.', 413);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return fail('PDF 파일이 아닙니다.', 400);

  const memo = String(form.get('memo') ?? '').trim().slice(0, 500);
  const cat = String(form.get('category') ?? '');
  const category = (CATEGORIES as readonly string[]).includes(cat) ? cat : '';
  const hint = String(form.get('date') ?? '');

  let draft: Draft;
  try { draft = await summarizePdf(buf, { memo, category }); }
  catch (e) { return fail(e instanceof Error ? e.message : '요약에 실패했습니다.', 502); }

  // 날짜: 사용자가 입력했으면 그 값, 아니면 문서에서 찾은 값, 둘 다 없으면 오늘(확인 필요 표시)
  const found = isDate(draft.meetingDate) ? draft.meetingDate : '';
  const meetingDate = isDate(hint) ? hint : found || kstToday();
  const dateGuessed = !isDate(hint) && !found;

  const id = await createMinute({
    ...draft, meetingDate, category, memo, dateGuessed,
    fileName: file.name.slice(0, 200),
  });
  return NextResponse.json({ id });
}
