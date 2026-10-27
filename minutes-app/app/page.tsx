import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listMinutes } from '@/lib/minutes';
import { CATEGORIES, type Minute } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; ym?: string; cat?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60), tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const all = await listMinutes();
  const months = [...new Set(all.map((m) => m.meetingDate.slice(0, 7)))];
  const ym = sp.ym && months.includes(sp.ym) ? sp.ym : '';
  const cat = sp.cat && (CATEGORIES as readonly string[]).includes(sp.cat) ? sp.cat : '';
  const text = (m: Minute) => [m.title, m.overview, m.place, ...m.attendees, ...m.decisions, ...m.keyPoints, ...m.actionItems.map((a) => `${a.task} ${a.owner}`)].join(' ').toLowerCase();
  const list = all.filter((m) => (!ym || m.meetingDate.startsWith(ym)) && (!cat || m.category === cat) && tokens.every((t) => text(m).includes(t)));
  const groups = new Map<string, Minute[]>();
  list.forEach((m) => groups.set(m.meetingDate.slice(0, 7), [...(groups.get(m.meetingDate.slice(0, 7)) ?? []), m]));

  return (
    <div>
      <h1>회의록 보관함</h1>
      <form className="search" role="search">
        <input name="q" defaultValue={q} maxLength={60} placeholder="제목·내용 검색" aria-label="검색어" />
        <select name="ym" defaultValue={ym} aria-label="월"><option value="">전체 기간</option>{months.map((m) => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}</select>
        <select name="cat" defaultValue={cat} aria-label="구분"><option value="">전체 구분</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn sm">보기</button>
      </form>
      <p className="meta">{list.length}건{all.length !== list.length ? ` (전체 ${all.length}건)` : ''}</p>
      {!all.length && <p className="empty">아직 저장된 회의록이 없습니다. <Link href="/new">첫 회의록을 올려 보세요.</Link></p>}
      {[...groups.entries()].map(([g, items]) => (
        <section key={g}>
          <h2>{g.slice(0, 4)}년 {Number(g.slice(5, 7))}월 <span className="meta">{items.length}건</span></h2>
          <ul className="cards">
            {items.map((m) => (
              <li key={m.id}><Link href={`/m/${m.id}`}>
                <b>{m.title}</b>
                <span className="meta">{m.meetingDate}{m.category ? ` · ${m.category}` : ''}{m.dateGuessed ? ' · 날짜 확인 필요' : ''}</span>
                {m.overview && <span className="excerpt">{m.overview}</span>}
              </Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
