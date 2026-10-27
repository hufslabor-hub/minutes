'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadForm({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sec, setSec] = useState(0);
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => { if (err) errRef.current?.focus(); }, [err]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file');
    if (!(file instanceof File) || !file.size) return setErr('PDF 파일을 선택해 주세요.');
    if (file.size > 4 * 1024 * 1024) return setErr('PDF는 4MB 이하만 올릴 수 있습니다.');
    setErr(''); setSec(0); setBusy(true);
    try {
      const r = await fetch('/api/summarize', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? '요약에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      router.push(`/m/${j.id}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : '요약에 실패했습니다.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <label>회의록 PDF (4MB 이하)<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
      <label>회의 구분
        <select name="category" defaultValue=""><option value="">선택 안 함</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label>회의 날짜 (문서에 있으면 자동으로 찾으니 비워도 됩니다)<input name="date" type="date" /></label>
      <label>메모 (선택: 중점적으로 볼 내용 등)<textarea name="memo" rows={2} maxLength={500} placeholder="예: 교섭 요구안과 결정 사항 위주로 정리" /></label>
      {err && <p ref={errRef} tabIndex={-1} className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? `요약 중… ${sec}초 (보통 20~40초)` : 'AI로 요약하기'}</button>
      <p className="meta">글자가 있는 PDF는 서버에서만 처리됩니다. 스캔(그림) PDF는 글자를 읽기 위해 Google Gemini로 전송됩니다. 원본 PDF는 저장하지 않고 요약만 보관합니다.</p>
    </form>
  );
}
