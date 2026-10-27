import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
import { CHUNK_BYTES, MAX_PDF_BYTES, MAX_PDF_MB } from './format';

/**
 * 큰 PDF 임시 보관(조각 업로드용).
 * Vercel은 한 번에 받는 요청이 약 4.5MB로 제한되어서, 큰 파일은 512KB씩 나눠 올리고
 * 요약할 때 서버에서 다시 합칩니다. 요약이 끝나면 바로 지우고, 중간에 그만둔 파일은 1시간 뒤부터
 * 다음 업로드가 시작될 때 자동으로 정리됩니다. (Firestore TTL 정책을 켜 두면 시간에 맞춰 지워집니다)
 *   uploads/{id}            : { uid, size, total, name, createdMs, expireAt }
 *   uploads/{id}/chunks/{n} : { data: Bytes, expireAt }
 */
const col = () => db().collection('uploads');
const okId = (id: string) => /^[A-Za-z0-9]{10,40}$/.test(id);
const key = (i: number) => String(i).padStart(3, '0');
const HOUR = 3600_000;
const GONE = '올린 파일을 찾을 수 없습니다. 다시 올려 주세요.';

export class UploadError extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

export async function initUpload(uid: string, size: number, name: string): Promise<{ id: string; total: number }> {
  if (!Number.isInteger(size) || size < 1) throw new UploadError('파일 크기가 올바르지 않습니다.');
  if (size > MAX_PDF_BYTES) throw new UploadError(`PDF는 ${MAX_PDF_MB}MB 이하만 올릴 수 있습니다.`, 413);

  // 보관 시간(1시간)이 지난 임시 업로드는 누구 것이든 정리 (요약 전에 그만둔 파일이 남지 않도록)
  const now = Date.now();
  const stale = await col().where('expireAt', '<', Timestamp.fromMillis(now)).limit(10).get();
  await Promise.all(stale.docs.map((d) => db().recursiveDelete(d.ref)));

  const ref = col().doc();
  const total = Math.ceil(size / CHUNK_BYTES);
  await ref.set({ uid, size, total, name: name.slice(0, 200), createdMs: now, expireAt: Timestamp.fromMillis(now + HOUR) });
  return { id: ref.id, total };
}

async function getOwned(uid: string, id: string) {
  if (!okId(id)) throw new UploadError(GONE, 410);
  const d = await col().doc(id).get();
  const v = d.data();
  if (!d.exists || !v || v.uid !== uid) throw new UploadError(GONE, 410);   // 남의 업로드는 "없음"과 같게 응답
  const createdMs = Number(v.createdMs ?? 0);
  if (Date.now() > createdMs + HOUR) throw new UploadError(GONE, 410);   // 보관 시간이 지난 파일
  return { size: Number(v.size), total: Number(v.total), name: String(v.name ?? ''), createdMs };
}

export async function putChunk(uid: string, id: string, i: number, data: Buffer): Promise<void> {
  const up = await getOwned(uid, id);
  if (!Number.isInteger(i) || i < 0 || i >= up.total) throw new UploadError('조각 번호가 올바르지 않습니다.');
  const expect = i < up.total - 1 ? CHUNK_BYTES : up.size - (up.total - 1) * CHUNK_BYTES;
  if (data.length !== expect) throw new UploadError('조각 크기가 올바르지 않습니다.');
  await col().doc(id).collection('chunks').doc(key(i)).set({ data, expireAt: Timestamp.fromMillis(up.createdMs + HOUR) });   // 같은 조각을 다시 보내도 안전(덮어쓰기)
}

/** 조각을 모아 원본 파일로 돌려줍니다. 요약이 실패해도 다시 시도할 수 있도록 여기서는 지우지 않습니다. */
export async function readUpload(uid: string, id: string): Promise<{ buf: Buffer; name: string }> {
  const up = await getOwned(uid, id);
  const snap = await col().doc(id).collection('chunks').get();
  if (snap.docs.length !== up.total) throw new UploadError('파일이 끝까지 올라가지 않았습니다. 다시 올려 주세요.', 410);
  const buf = Buffer.concat(snap.docs.sort((a, b) => (a.id < b.id ? -1 : 1)).map((d) => Buffer.from(d.data().data)));
  if (buf.length !== up.size) throw new UploadError('파일이 올바르게 올라가지 않았습니다. 다시 올려 주세요.', 410);
  return { buf, name: up.name };
}

export async function dropUpload(id: string): Promise<void> {
  if (okId(id)) await db().recursiveDelete(col().doc(id));
}
