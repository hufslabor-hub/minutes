import { getUser } from '@/lib/auth';
import { getMinute } from '@/lib/minutes';
import { toMarkdown } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return new Response('unauthorized', { status: 401 });
  const { id } = await params;
  const m = await getMinute(id);
  if (!m) return new Response('not found', { status: 404 });
  const name = `${m.meetingDate}_${m.title}`.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
  return new Response(toMarkdown(m), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}.md` },
  });
}
