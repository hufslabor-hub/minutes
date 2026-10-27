import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';
import { isDate, type ActionItem } from './format';

/**
 * 무료 요약기: 외부 AI를 쓰지 않고, PDF에서 글자를 뽑아 규칙(제목·항목 이름 찾기, 핵심 문장 점수)으로 정리합니다.
 * 글자가 들어 있는 PDF만 가능하며, 스캔본(이미지) PDF는 읽을 수 없습니다.
 */
export type Draft = {
  title: string; meetingDate: string; place: string; attendees: string[]; overview: string; agenda: string[];
  decisions: string[]; actionItems: ActionItem[]; keyPoints: string[]; nextMeeting: string; warnings: string[];
};

type Sec = 'place' | 'attendees' | 'meta' | 'next' | 'decisions' | 'actions' | 'agenda' | 'discussion';
const KEYS: [Sec, RegExp][] = [
  ['place', /^장\s*소/],
  ['attendees', /^(참석\s*자?|출석\s*자?)/],
  ['meta', /^(일\s*시|불참|결석|작성|서기|기록|사회|의장)/],
  ['next', /(다음|차기|차회)\s*(회의|모임|일정)/],
  ['decisions', /(결정|의결|결의|확정|합의)\s*(사항|내용|결과)?/],
  ['actions', /(실행|추진|향후|후속|조치)\s*(과제|계획|사항|일정)?|할\s*일/],
  ['agenda', /(안\s*건|의\s*제|보고\s*사항)/],
  ['discussion', /(논의|토의|토론|협의|주요\s*내용|회의\s*내용)/],
];
const PREFIX = /^\s*(?:[■□◆◇○●▶▷◎]|\(?\d{1,2}[.)]|[ⅠⅡⅢⅣⅤⅥ]\.?|[가-하][.)])\s*/;
const BULLET = /^\s*(?:[-•·ㆍ○●▪■□◆◇▶▷*]|\d{1,2}[.)]|\(\d{1,2}\))\s*/;
const DECIDE = /(의결|가결|결정|확정|승인|합의|통과|채택)(?:하였|했|됨|함|되었|한다|하기로|됐)/;
const STOP = new Set(['있는', '있다', '있으며', '대한', '위한', '통해', '관련', '이후', '현재', '경우', '내용', '사항', '회의', '진행', '필요', '정도', '대해', '따라', '때문', '그리고', '하지만']);

const key = (s: string): Sec | null => { for (const [k, r] of KEYS) if (r.test(s)) return k; return null; };
const clean = (s: string) => s.replace(BULLET, '').replace(/\s+/g, ' ').trim();
const uniq = (a: string[]) => [...new Set(a)];

function tokens(s: string): string[] {
  return (s.match(/[가-힣]{2,}|[A-Za-z]{3,}/g) ?? [])
    .map((w) => (/[가-힣]/.test(w) && w.length >= 3 ? w.replace(/(으로써|에서|에게|까지|부터|으로|에는|하는|하고|은|는|이|가|을|를|의|에|로|와|과|도|만)$/, '') : w.toLowerCase()))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

function findDate(text: string, lines: string[]): string {
  const re = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/;
  const pick = (s: string) => {
    const m = s.match(re);
    if (!m) return '';
    const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return isDate(d) ? d : '';
  };
  const labeled = lines.find((l) => /^\s*(?:[■□◆○●]\s*)?일\s*시/.test(l));
  return (labeled && pick(labeled)) || pick(text.slice(0, 800)) || pick(text);
}

function findTitle(lines: string[]): string {
  const head = lines.slice(0, 12).map((l) => l.replace(PREFIX, '').trim()).filter(Boolean);
  const t = head.find((l) => l.length <= 80 && !/[:：]/.test(l) && /(회의|대회|교섭|위원회|간담회|총회|협의회|회의록)/.test(l)) ?? head.find((l) => l.length <= 80);
  return (t ?? '제목 없음').slice(0, 200);
}

export async function summarizePdf(pdf: Buffer, opts: { memo: string; category: string }): Promise<Draft> {
  let raw = '';
  try {
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    raw = (await extractText(doc, { mergePages: true })).text;
  } catch (e) {
    console.error('pdf parse error', e);
    throw new Error('PDF를 읽지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다.');
  }
  const text = raw.replace(/\r/g, '').replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.replace(/\s/g, '').length < 30) throw new Error('PDF에서 글자를 찾지 못했습니다. 스캔(이미지) PDF는 무료 요약이 지원되지 않습니다. 글자가 선택되는 PDF를 올려 주세요.');

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sec: Record<Sec, string[]> = { place: [], attendees: [], meta: [], next: [], decisions: [], actions: [], agenda: [], discussion: [] };
  const body: string[] = [];
  let cur: Sec | null = null;

  for (const line of lines) {
    const marker = PREFIX.test(line);
    const b = line.replace(PREFIX, '').trim();
    const m = b.match(/^([^:：]{1,20})[:：]\s*(.*)$/);
    const kc = m ? key(m[1].trim()) : null;
    if (m && kc) { cur = kc; if (m[2]) sec[kc].push(m[2]); if (kc !== 'meta') body.push(m[2]); continue; }
    const kh = b.length <= 30 ? key(b) : null;
    if (kh && (marker || b.length <= 14)) { cur = kh; continue; }
    const c = clean(line);
    if (!c) continue;
    if (cur) sec[cur].push(c);
    if (cur !== 'meta' && cur !== 'attendees' && cur !== 'place') body.push(c);
  }

  const split = (a: string[]) => a.flatMap((x) => x.split(/[,，、·ㆍ]|\s{2,}/)).map((x) => x.trim()).filter((x) => x && x.length <= 40);
  const sentences = body.filter((l) => l.length >= 12 && l.length <= 220);

  // 핵심 문장 점수(단어 빈도 + 작성자 메모 단어 가중)
  const freq = new Map<string, number>();
  for (const s of sentences) for (const w of tokens(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  for (const w of tokens(opts.memo)) freq.set(w, (freq.get(w) ?? 0) + 3);
  const scored = sentences.map((s, i) => {
    const t = tokens(s);
    const base = t.reduce((n, w) => n + (freq.get(w) ?? 0), 0) / Math.max(t.length, 4);
    return { s, i, score: base + (DECIDE.test(s) ? 2 : 0) + (i < 5 ? 0.5 : 0) };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 5).sort((a, b) => a.i - b.i);
  const overview = top.map((x) => x.s).join(' ').slice(0, 1200);

  const decisions = uniq(sec.decisions.length ? sec.decisions : sentences.filter((s) => DECIDE.test(s))).slice(0, 30);
  const keyPoints = uniq(sec.discussion.length ? sec.discussion : scored.filter((x) => !top.includes(x)).sort((a, b) => b.score - a.score).slice(0, 6).sort((a, b) => a.i - b.i).map((x) => x.s)).slice(0, 40);

  const actionLines = uniq([...sec.actions, ...sentences.filter((s) => /담당|책임자/.test(s))]).slice(0, 30);
  const actionItems: ActionItem[] = actionLines.map((l) => {
    const owner = l.match(/(?:담당|책임자?)\s*[:：]?\s*([가-힣A-Za-z0-9·]{2,15})/)?.[1] ?? '';
    const due = l.match(/(20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?|\d{1,2}월\s*(?:\d{1,2}일)?\s*까지|[가-힣0-9]{1,8}\s*까지)/)?.[1]?.trim() ?? '';
    return { task: l.slice(0, 500), owner, due };
  });

  const next = sec.next.join(' ').slice(0, 1000) || (sentences.find((s) => /(다음|차기|차회)\s*회의/.test(s)) ?? '');
  const date = findDate(text, lines);

  const warnings = ['AI가 아닌 자동 규칙으로 뽑은 결과입니다. 문장이 어색하거나 빠진 내용이 있을 수 있으니 원문과 대조하고 수정해 주세요.'];
  if (!date) warnings.push('문서에서 회의 날짜를 찾지 못했습니다. 날짜를 확인해 주세요.');
  if (!decisions.length) warnings.push('결정 사항으로 표시된 부분을 찾지 못했습니다.');
  if (!sec.attendees.length) warnings.push('참석자를 찾지 못했습니다.');

  return {
    title: findTitle(lines), meetingDate: date, place: sec.place.join(' ').slice(0, 200),
    attendees: split(sec.attendees).slice(0, 100), overview, agenda: uniq(sec.agenda).slice(0, 40),
    decisions, actionItems, keyPoints, nextMeeting: next, warnings,
  };
}
