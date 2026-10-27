import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getMinute } from '@/lib/minutes';

export const dynamic = 'force-dynamic';

function Sec({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (<section><h2>{title}</h2><ul className="bul">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section>);
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const m = await getMinute(id);
  if (!m) notFound();
  return (
    <article>
      <p><Link href="/">← 보관함</Link></p>
      <h1>{m.title}</h1>
      <p className="meta">{m.meetingDate}{m.category ? ` · ${m.category}` : ''}{m.place ? ` · ${m.place}` : ''}</p>
      {m.dateGuessed && <p className="warn" role="alert">회의 날짜를 문서에서 찾지 못해 오늘 날짜로 저장했습니다. 수정에서 날짜를 확인해 주세요.</p>}
      <div className="btns">
        <Link className="btn sm" href={`/m/${m.id}/edit`}>수정</Link>
        <a className="btn sm ghost" href={`/m/${m.id}/export`}>내려받기(.md)</a>
      </div>
      {m.overview && <section><h2>요약</h2><p className="pre">{m.overview}</p></section>}
      {m.attendees.length > 0 && <section><h2>참석</h2><p>{m.attendees.join(', ')}</p></section>}
      <Sec title="안건" items={m.agenda} />
      <Sec title="결정 사항" items={m.decisions} />
      {m.actionItems.length > 0 && (
        <section><h2>실행 과제</h2>
          <ul className="bul">{m.actionItems.map((a, i) => <li key={i}>{a.task}{a.owner && <span className="tag">담당 {a.owner}</span>}{a.due && <span className="tag">기한 {a.due}</span>}</li>)}</ul>
        </section>
      )}
      <Sec title="주요 논의" items={m.keyPoints} />
      {m.nextMeeting && <section><h2>다음 회의</h2><p className="pre">{m.nextMeeting}</p></section>}
      {m.warnings.length > 0 && <section className="warn"><h2>확인이 필요한 부분</h2><ul className="bul">{m.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
      <p className="meta">원본 파일: {m.fileName || '-'} · AI가 만든 요약이므로 중요한 내용은 원문과 대조해 확인하세요.</p>
    </article>
  );
}
