// PDF 올리기 한도. 4MB 이하는 한 번에, 그보다 크면 512KB씩 나눠 올림(Vercel 요청 크기 제한 약 4.5MB 때문)
export const DIRECT_MAX_MB = 4;
export const DIRECT_MAX_BYTES = DIRECT_MAX_MB * 1024 * 1024;
export const MAX_PDF_MB = 20;                       // 요약 서비스 요청 크기 한도(32MB)에 여유를 둠
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;
export const CHUNK_BYTES = 512 * 1024;              // Firestore 문서 1MB 제한 안에 들어가는 크기

export const CATEGORIES = ['일반 회의', '집행부 회의', '대의원대회', '교섭', '기타'] as const;

export type ActionItem = { task: string; owner: string; due: string };
export type Minute = {
  id: string; title: string; meetingDate: string; category: string; place: string;
  attendees: string[]; overview: string; agenda: string[]; decisions: string[];
  actionItems: ActionItem[]; keyPoints: string[]; nextMeeting: string; warnings: string[];
  fileName: string; memo: string; dateGuessed: boolean; createdAt: string; updatedAt: string;
};

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export const linesOf = (a: string[]) => a.join('\n');
export const textToList = (s: string, max = 60) => s.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 500));
export const actionsToText = (a: ActionItem[]) => a.map((x) => [x.task, x.owner, x.due].join(' | ')).join('\n');
export const textToActions = (s: string): ActionItem[] =>
  textToList(s, 60).map((l) => { const [task = '', owner = '', due = ''] = l.split('|').map((x) => x.trim()); return { task, owner, due }; }).filter((x) => x.task);

/** 내려받기용 Markdown */
export function toMarkdown(m: Minute): string {
  const list = (t: string, a: string[]) => (a.length ? `\n## ${t}\n${a.map((x) => `- ${x}`).join('\n')}\n` : '');
  return [
    `# ${m.title}`,
    `- 회의 날짜: ${m.meetingDate}${m.category ? `\n- 구분: ${m.category}` : ''}${m.place ? `\n- 장소: ${m.place}` : ''}`,
    m.attendees.length ? `- 참석: ${m.attendees.join(', ')}` : '',
    m.overview ? `\n## 요약\n${m.overview}\n` : '',
    list('안건', m.agenda), list('결정 사항', m.decisions),
    m.actionItems.length ? `\n## 실행 과제\n${m.actionItems.map((x) => `- ${x.task}${x.owner ? ` (담당: ${x.owner})` : ''}${x.due ? ` [기한: ${x.due}]` : ''}`).join('\n')}\n` : '',
    list('주요 논의', m.keyPoints),
    m.nextMeeting ? `\n## 다음 회의\n${m.nextMeeting}\n` : '',
    m.warnings.length ? list('확인이 필요한 부분', m.warnings) : '',
    `\n---\n원본 파일: ${m.fileName || '-'} · AI 요약은 원문과 대조해 확인하세요.\n`,
  ].filter(Boolean).join('\n');
}
