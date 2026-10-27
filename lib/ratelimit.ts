import 'server-only';
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';

/** 요청 횟수 제한(Firestore). 허용이면 true, 한도 초과면 false. 접속 주소는 해시로만 저장. */
export async function limit(action: string, extra: string | null, max: number, windowSec: number): Promise<boolean> {
  try {
    const h = await headers();
    const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
    const key = createHash('sha256').update(`${action}|${ip}|${extra ?? ''}`).digest('hex').slice(0, 40);
    const ref = db().collection('ratelimits').doc(key);
    const now = Date.now();
    return await db().runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data();
      if (!d || now - d.start > windowSec * 1000) {
        tx.set(ref, { action, start: now, count: 1, expireAt: Timestamp.fromMillis(now + windowSec * 2000) });
        return true;
      }
      if (d.count >= max) return false;
      tx.update(ref, { count: FieldValue.increment(1) });
      return true;
    });
  } catch (e) {
    console.error('ratelimit error', e);
    return true;
  }
}
