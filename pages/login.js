import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

/**
 * Login page. Provides a simple email/password form. On submit
 * the credentials are sent to NextAuth's signIn method with
 * redirect disabled. If authentication succeeds the user is
 * redirected to the protected area.
 */
export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // If already logged in redirect to quotes
  if (session) {
    if (typeof window !== 'undefined') {
      router.replace('/protected');
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password
    });
    if (res?.error) {
      setError(res.error || 'Unable to login');
    } else {
      router.replace('/protected');
    }
  }

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: '320px', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Login</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
          <button type="submit" style={{ width: '100%', padding: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>Sign In</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          Don&apos;t have an account?{' '}
          <a href="/signup" style={{ color: '#2563eb', textDecoration: 'underline' }}>Sign up</a>
        </p>
      </div>
    </main>
  );
}