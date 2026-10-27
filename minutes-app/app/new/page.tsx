import { requireUser } from '@/lib/auth';
import { CATEGORIES } from '@/lib/format';
import UploadForm from '@/components/UploadForm'; // 경로에 맞게 조정

export const metadata = { title: '새 회의록' };
export const dynamic = 'force-dynamic';

export default async function NewMinutePage() {
  await requireUser();

  return (
    <div className="narrow">
      <h1>새 회의록 올리기</h1>
      <p className="meta">PDF를 올리면 AI가 핵심 내용을 요약해 드립니다. (최대 10MB)</p>
      <UploadForm categories={CATEGORIES} />
    </div>
  );
}
