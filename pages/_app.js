import { SessionProvider } from 'next-auth/react';

/**
 * Custom App component to wrap all pages with the NextAuth session provider.
 * This makes the user session available throughout the client-side application
 * via the useSession() hook.
 */
export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}