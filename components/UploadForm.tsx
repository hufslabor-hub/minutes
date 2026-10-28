'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHUNK_BYTES, DIRECT_MAX_BYTES, DIRECT_MAX_MB, MAX_PDF_BYTES, MAX_PDF_MB } from '@/lib/format';

// 한도를 넘긴 파일이 "10.0MB"로 보이지 않도록 소수 첫째 자리에서 올림
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(Math.ceil((n / 1024 / 1024) * 10) / 10).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 다시 시도해도 소용없는 오류(권한·크기 등) */
class Fatal extends Error {}

async function sendChunk(id: string, i: number, blob: Blob) {
  let last = '업로드 중 연결이 끊어졌습니다. 다시 시도해 주세요.';
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`/api/upload/chunk?id=${encodeURIComponent(id)}&i=${i}`, {
        method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: blob,
      });
      if (r.ok) return;
      const j = await r.json().catch(() => ({}));
      if (r.status < 500 && r.status !== 429) throw new Fatal(j.error ?? '업로드에 실패했습니다.');
      last = j.error ?? last;
    } catch (e) {
      if (e instanceof Fatal) throw e;        // 네트워크 오류·5xx는 잠시 뒤 다시 시도
    }
    await sleep(500 * (t + 1));
  }
  throw new Error(last);
}

/** 큰 파일을 512KB씩 나눠 올리고 업로드 번호를 돌려줍니다. (Vercel 요청 크기 제한 회피) */
async function uploadInChunks(f: File, onProgress: (pct: number) => void): Promise<string> {
  const r = await fetch('/api/upload/init', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: f.size, name: f.name }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? '업로드를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const { id, total } = j as { id: string; total: number };

  const queue = Array.from({ length: total }, (_, i) => i);
  let done = 0;
  onProgress(0);
  const worker = async () => {
    for (;;) {
      const i = queue.shift();
      if (i === undefined) return;
      try { await sendChunk(id, i, f.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)); }
      catch (e) { queue.length = 0; throw e; }     // 하나라도 실패하면 나머지 조각은 보내지 않음
      onProgress(Math.round((++done / total) * 100));
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, total) }, worker));
  return id;
}

export default function UploadForm({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const errRef = useRef<HTMLParagraphElement>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);   // 이미 올려 둔 큰 파일(요약만 실패했을 때 다시 올리지 않기 위함)
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<number | null>(null);   // 큰 파일을 올리는 중일 때만 숫자
  const [err, setErr] = useState('');
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => { if (err) errRef.current?.focus(); }, [err]);

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    uploaded.current = null;
    setFile(null);
  }

  /** 끌어다 놓거나 선택한 파일을 검사하고, 통과하면 폼에 담습니다. */
  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!isPdf(f)) { clear(); return setErr('PDF 파일만 올릴 수 있습니다.'); }
    if (!f.size) { clear(); return setErr('내용이 없는 파일입니다. 다른 파일을 선택해 주세요.'); }
    if (f.size > MAX_PDF_BYTES) { clear(); return setErr(`PDF는 ${MAX_PDF_MB}MB 이하만 올릴 수 있습니다. (선택한 파일: ${fmtSize(f.size)})`); }
    if (inputRef.current) {            // 끌어다 놓은 파일도 폼 전송에 포함되도록 input에 넣음
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    uploaded.current = null;
    setFile(f);
    setErr('');
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = file;
    if (!f || !f.size) return setErr('PDF 파일을 선택해 주세요.');
    if (f.size > MAX_PDF_BYTES) return setErr(`PDF는 ${MAX_PDF_MB}MB 이하만 올릴 수 있습니다.`);
    setErr(''); setSec(0); setPct(null); setBusy(true);
    try {
      let r: Response;
      if (f.size <= DIRECT_MAX_BYTES) {
        r = await fetch('/api/summarize', { method: 'POST', body: fd });          // 작은 파일: 한 번에 전송
      } else {
        let id = uploaded.current?.file === f ? uploaded.current.id : '';        // 큰 파일: 조각으로 먼저 올림
        if (!id) {
          id = await uploadInChunks(f, setPct);
          uploaded.current = { file: f, id };
        }
        setPct(null);
        r = await fetch('/api/summarize', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId: id, fileName: f.name, category: fd.get('category') ?? '', date: fd.get('date') ?? '', memo: fd.get('memo') ?? '' }),
        });
        if (r.status === 410) uploaded.current = null;                           // 올려 둔 파일이 사라짐 → 다음에는 새로 올림
      }
      const j = await r.json().catch(() => ({}));
      if (r.status === 413) throw new Error('서버가 이 크기의 파일을 받지 못했습니다. 더 작은 파일로 시도하거나 관리자에게 문의해 주세요.');
      if (!r.ok) throw new Error(j.error ?? '요약에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      uploaded.current = null;
      router.push(`/m/${j.id}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : '요약에 실패했습니다.');
      setBusy(false);
      setPct(null);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <div>
        <span className="lbl" id="pdf-lbl">회의록 PDF ({MAX_PDF_MB}MB 이하)</span>
        <label
          className={`drop${over ? ' over' : ''}${file ? ' has' : ''}`}
          aria-labelledby="pdf-lbl"
          aria-disabled={busy}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
        >
          <input ref={inputRef} className="vh" name="file" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          {file ? (
            <>
              <span className="big">{file.name}</span>
              <span className="meta">{fmtSize(file.size)} · 다른 파일을 끌어다 놓거나 눌러서 바꿀 수 있습니다</span>
            </>
          ) : (
            <>
              <span className="big">PDF 파일을 여기로 끌어다 놓으세요</span>
              <span className="meta">또는 이 영역을 눌러 파일 선택 · PDF 최대 {MAX_PDF_MB}MB</span>
            </>
          )}
        </label>
        {file && !busy && <button type="button" className="linkbtn sm" onClick={clear}>선택한 파일 지우기</button>}
        {file && file.size > DIRECT_MAX_BYTES && <p className="meta">{DIRECT_MAX_MB}MB가 넘는 파일은 나누어 올리므로 시간이 조금 더 걸립니다.</p>}
        <p className="vh" role="status">{file ? `${file.name} 파일이 선택되었습니다.` : ''}</p>
      </div>
      <label>회의 구분
        <select name="category" defaultValue=""><option value="">선택 안 함</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label>회의 날짜 (문서에 있으면 자동으로 찾으니 비워도 됩니다)<input name="date" type="date" /></label>
      <label>메모 (선택: 중점적으로 볼 내용 등)<textarea name="memo" rows={2} maxLength={500} placeholder="예: 교섭 요구안과 결정 사항 위주로 정리" /></label>
      {err && <p ref={errRef} tabIndex={-1} className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>
        {busy ? (pct !== null ? `파일 올리는 중… ${pct}%` : `요약 중… ${sec}초 (보통 20~40초)`) : 'AI로 요약하기'}
      </button>
      <p className="meta">글자가 있는 PDF는 서버에서만 처리됩니다. 스캔(그림) PDF는 글자를 읽기 위해 Google Gemini로 전송됩니다. 원본 PDF는 요약이 끝나면 삭제하고 요약만 보관합니다. ({DIRECT_MAX_MB}MB가 넘는 파일은 요약이 끝날 때까지 서버에 잠시 보관됩니다.)</p>
    </form>
  );
}
