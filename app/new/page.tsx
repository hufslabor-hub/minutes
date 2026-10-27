import { requireUser } from '@/lib/auth';
import { CATEGORIES } from '@/lib/format';
import UploadForm from '@/components/UploadForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 회의록' };

export default async function NewMinute() {
  await requireUser();
  return (<div className="narrow"><h1>새 회의록 요약</h1><UploadForm categories={CATEGORIES} /></div>);
}
