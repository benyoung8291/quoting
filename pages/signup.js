import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

/**
 * Sign-up page. Collects a name, email and password and posts
 * them to the custom `/api/auth/signup` endpoint. If registration
 * succeeds the user is automatically signed in and redirected to
 * the protected area. Basic client-side validation is performed.
 */
export default function SignupPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (session) {
    if (typeof window !== 'undefined') {
      router.replace('/protected');
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      // automatically sign in the newly registered user
      await signIn('credentials', { email, password, redirect: false });
      router.replace('/protected');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: '320px', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Sign Up</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="name" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            />
          </div>
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
          <button type="submit" style={{ width: '100%', padding: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>Create Account</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#2563eb', textDecoration: 'underline' }}>Sign in</a>
        </p>
      </div>
    </main>
  );
}