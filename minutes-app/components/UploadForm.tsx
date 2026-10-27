'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadForm({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sec, setSec] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (err) errRef.current?.focus();
  }, [err]);

  const validateFile = useCallback((f: File | null) => {
    if (!f) return 'PDF 파일을 선택해 주세요.';
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      return 'PDF 파일만 업로드할 수 있습니다.';
    }
    if (f.size > MAX_SIZE) return 'PDF는 10MB 이하만 올릴 수 있습니다.';
    return '';
  }, []);

  const pickFile = useCallback(
    (f: File | null) => {
      const msg = validateFile(f);
      if (msg) {
        setErr(msg);
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      setErr('');
      setFile(f);
    },
    [validateFile],
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    pickFile(f);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const msg = validateFile(file);
    if (msg) return setErr(msg);

    const fd = new FormData(e.currentTarget);
    // 드롭으로 선택한 파일을 강제로 넣음
    if (file) fd.set('file', file);

    setErr('');
    setSec(0);
    setBusy(true);
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
      {/* 드래그 앤 드롭 영역 */}
      <div
        className={`dropzone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="PDF 파일 선택 또는 드래그 앤 드롭"
      >
        <input
          ref={inputRef}
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="drop-info">
            <span className="drop-icon">📄</span>
            <div>
              <strong>{file.name}</strong>
              <span className="meta">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <button
              type="button"
              className="linkbtn"
              onClick={(e) => {
                e.stopPropagation();
                pickFile(null);
              }}
            >
              제거
            </button>
          </div>
        ) : (
          <div className="drop-placeholder">
            <span className="drop-icon">📂</span>
            <p>
              <strong>PDF 파일을 여기에 놓거나 클릭해서 선택</strong>
            </p>
            <p className="meta">최대 10MB · PDF만 가능</p>
          </div>
        )}
      </div>

      <label>
        회의 구분
        <select name="category" defaultValue="">
          <option value="">선택 안 함</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        회의 날짜 (문서에 있으면 자동으로 찾으니 비워도 됩니다)
        <input name="date" type="date" />
      </label>

      <label>
        메모 (선택: 중점적으로 볼 내용 등)
        <textarea
          name="memo"
          rows={2}
          maxLength={500}
          placeholder="예: 교섭 요구안과 결정 사항 위주로 정리"
        />
      </label>

      {err && (
        <p ref={errRef} tabIndex={-1} className="err" role="alert">
          {err}
        </p>
      )}

      <button className="btn" disabled={busy || !file}>
        {busy ? `요약 중… ${sec}초 (보통 20~40초)` : 'AI로 요약하기'}
      </button>

      <p className="meta">
        글자가 있는 PDF는 서버에서만 처리됩니다. 스캔(그림) PDF는 글자를 읽기 위해 Google Gemini로
        전송됩니다. 원본 PDF는 저장하지 않고 요약만 보관합니다.
      </p>
    </form>
  );
}
