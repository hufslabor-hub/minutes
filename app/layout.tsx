import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { getUser } from '@/lib/auth';
import { logout } from './actions';

export const metadata: Metadata = { title: { default: '회의록 요약', template: '%s - 회의록 요약' }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#14213d' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="ko">
      <head><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" /></head>
      <body>
        <header className="top"><div className="wrap bar">
          <Link href="/" className="brand">회의록 <b>요약</b></Link>
          {user && (
            <nav className="nav" aria-label="주요 메뉴">
              <Link href="/">보관함</Link>
              <Link href="/new" className="btn sm">+ 새 회의록</Link>
              <form action={logout}><button className="linkbtn">로그아웃</button></form>
            </nav>
          )}
        </div></header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
