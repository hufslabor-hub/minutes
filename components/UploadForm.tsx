'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHUNK_BYTES, DIRECT_MAX_BYTES, MAX_PDF_BYTES, MAX_PDF_MB } from '@/lib/format';

const errOf = async (r: Response, fallback: string) => ((await r.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

// 조각 하나 올리기(일시적인 오류는 2번까지 다시 시도)
async function putChunk(id: string, i: number, blob: Blob) {
  let last = '파일 조각을 올리지 못했습니다.';
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`/api/upload/chunk?id=${encodeURIComponent(id)}&i=${i}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
      if (r.ok) return;
      last = await errOf(r, last);
      if (r.status < 500 && r.status !== 429) break;   // 다시 보내도 소용없는 오류
    } catch { last = '네트워크 연결이 불안정합니다.'; }
    await new Promise((res) => setTimeout(res, 800 * (t + 1)));
  }
  throw new Error(last);
}

export default function UploadForm({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'upload' | 'summarize'>('idle');
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  const [sec, setSec] = useState(0);
  const errRef = useRef<HTMLParagraphElement>(null);
  const busy = phase !== 'idle';

  useEffect(() => {
    if (phase !== 'summarize') return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { if (err) errRef.current?.focus(); }, [err]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file');
    if (!(file instanceof File) || !file.size) return setErr('PDF 파일을 선택해 주세요.');
    if (file.size > MAX_PDF_BYTES) return setErr(`PDF는 ${MAX_PDF_MB}MB 이하만 올릴 수 있습니다. 용량을 줄이거나 나누어 올려 주세요.`);
    setErr(''); setSec(0); setPct(0);
    try {
      let res: Response;
      if (file.size <= DIRECT_MAX_BYTES) {
        setPhase('summarize');
        res = await fetch('/api/summarize', { method: 'POST', body: fd });
      } else {
        // 큰 파일: 512KB씩 나눠 올린 뒤 업로드 번호로 요약 요청
        setPhase('upload');
        const init = await fetch('/api/upload/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ size: file.size, name: file.name }) });
        if (!init.ok) throw new Error(await errOf(init, '업로드를 시작하지 못했습니다.'));
        const { id, total } = (await init.json()) as { id: string; total: number };
        let next = 0, done = 0, failed = false;
        const worker = async () => {
          while (!failed) {
            const i = next++;
            if (i >= total) return;
            try { await putChunk(id, i, file.slice(i * CHUNK_BYTES, Math.min(file.size, (i + 1) * CHUNK_BYTES))); }
            catch (x) { failed = true; throw x; }
            done++; setPct(Math.round((done / total) * 100));
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, total) }, worker));
        setPhase('summarize');
        res = await fetch('/api/summarize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: id, fileName: file.name, memo: fd.get('memo'), category: fd.get('category'), date: fd.get('date') }),
        });
      }
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !j.id) throw new Error(j.error ?? '요약에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      router.push(`/m/${j.id}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : '요약에 실패했습니다.');
      setPhase('idle');
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <label>회의록 PDF ({MAX_PDF_MB}MB 이하)<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
      <label>회의 구분
        <select name="category" defaultValue=""><option value="">선택 안 함</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label>회의 날짜 (문서에 있으면 자동으로 찾으니 비워도 됩니다)<input name="date" type="date" /></label>
      <label>메모 (선택: 중점적으로 볼 내용 등)<textarea name="memo" rows={2} maxLength={500} placeholder="예: 교섭 요구안과 결정 사항 위주로 정리" /></label>
      {err && <p ref={errRef} tabIndex={-1} className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>
        {phase === 'upload' ? `파일 올리는 중… ${pct}%` : phase === 'summarize' ? `요약 중… ${sec}초 (보통 20~40초, 긴 문서는 더 걸립니다)` : 'AI로 요약하기'}
      </button>
      <p className="meta">PDF 내용은 요약을 위해 Anthropic API로 전송되며, 원본 PDF는 요약이 끝나면 지우고 요약만 보관합니다.</p>
    </form>
  );
}
