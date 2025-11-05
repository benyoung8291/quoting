import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Protected page. Renders the quotes application inside an iframe.
 * Users must be authenticated via NextAuth to access this page. If
 * the session is loading or missing, the user is redirected to
 * the login page. A sign-out button allows the user to end their
 * session.
 */
export default function ProtectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading…</p>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.5rem 1rem', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
        <div>Welcome, {session.user?.name || session.user.email}</div>
        <button onClick={() => signOut()} style={{ background: '#e5e7eb', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>Sign Out</button>
      </header>
      <iframe
        src="/quotes.html"
        style={{ flex: 1, border: 'none' }}
        title="Quotes Application"
      />
    </div>
  );
}