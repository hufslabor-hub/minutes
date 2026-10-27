import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getMinute } from '@/lib/minutes';
import { CATEGORIES, actionsToText, linesOf } from '@/lib/format';
import { deleteMinute, saveMinute } from '@/app/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: '회의록 수정' };

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const m = await getMinute(id);
  if (!m) notFound();
  return (
    <div className="narrow">
      <p><Link href={`/m/${m.id}`}>← 돌아가기</Link></p>
      <h1>회의록 수정</h1>
      <form action={saveMinute} className="form">
        <input type="hidden" name="id" value={m.id} />
        <label>제목<input name="title" defaultValue={m.title} maxLength={200} required /></label>
        <label>회의 날짜<input name="meetingDate" type="date" defaultValue={m.meetingDate} required /></label>
        <label>구분<select name="category" defaultValue={m.category}><option value="">선택 안 함</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>장소<input name="place" defaultValue={m.place} maxLength={200} /></label>
        <label>참석자 (한 줄에 한 명)<textarea name="attendees" rows={3} defaultValue={linesOf(m.attendees)} /></label>
        <label>요약<textarea name="overview" rows={6} defaultValue={m.overview} maxLength={5000} /></label>
        <label>안건 (한 줄에 하나)<textarea name="agenda" rows={4} defaultValue={linesOf(m.agenda)} /></label>
        <label>결정 사항 (한 줄에 하나)<textarea name="decisions" rows={5} defaultValue={linesOf(m.decisions)} /></label>
        <label>실행 과제 (한 줄에 하나: 할 일 | 담당 | 기한)<textarea name="actionItems" rows={5} defaultValue={actionsToText(m.actionItems)} /></label>
        <label>주요 논의 (한 줄에 하나)<textarea name="keyPoints" rows={5} defaultValue={linesOf(m.keyPoints)} /></label>
        <label>다음 회의<textarea name="nextMeeting" rows={2} defaultValue={m.nextMeeting} maxLength={1000} /></label>
        <button className="btn">저장</button>
      </form>
      <details className="danger-zone">
        <summary>이 회의록 삭제…</summary>
        <form action={deleteMinute}><input type="hidden" name="id" value={m.id} /><p>삭제하면 복구할 수 없습니다.</p><button className="btn danger">정말 삭제</button></form>
      </details>
    </div>
  );
}
