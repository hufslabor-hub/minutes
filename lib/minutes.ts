import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
import type { Minute } from './format';

const col = () => db().collection('minutes');
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function fromDoc(d: FirebaseFirestore.DocumentSnapshot): Minute {
  const v = d.data()!;
  return {
    id: d.id, title: String(v.title ?? ''), meetingDate: String(v.meetingDate ?? ''), category: String(v.category ?? ''), place: String(v.place ?? ''),
    attendees: arr(v.attendees), overview: String(v.overview ?? ''), agenda: arr(v.agenda), decisions: arr(v.decisions),
    actionItems: (Array.isArray(v.actionItems) ? v.actionItems : []).map((x: { task?: unknown; owner?: unknown; due?: unknown }) => ({ task: String(x.task ?? ''), owner: String(x.owner ?? ''), due: String(x.due ?? '') })),
    keyPoints: arr(v.keyPoints), nextMeeting: String(v.nextMeeting ?? ''), warnings: arr(v.warnings),
    fileName: String(v.fileName ?? ''), memo: String(v.memo ?? ''), dateGuessed: v.dateGuessed === true,
    createdAt: v.createdAt?.toDate().toISOString() ?? '', updatedAt: v.updatedAt?.toDate().toISOString() ?? '',
  };
}

export async function listMinutes(): Promise<Minute[]> {
  const s = await col().orderBy('meetingDate', 'desc').limit(500).get();
  return s.docs.map(fromDoc);
}
export async function getMinute(id: string): Promise<Minute | null> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
  const d = await col().doc(id).get();
  return d.exists ? fromDoc(d) : null;
}
export async function createMinute(data: Omit<Minute, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = col().doc();
  await ref.set({ ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  return ref.id;
}
export async function updateMinute(id: string, data: Partial<Omit<Minute, 'id' | 'createdAt' | 'updatedAt'>>) {
  await col().doc(id).update({ ...data, updatedAt: Timestamp.now() });
}
export async function removeMinute(id: string) {
  if (/^[A-Za-z0-9]{10,40}$/.test(id)) await col().doc(id).delete();
}
