import { getSession } from 'next-auth/react';

/**
 * The root page. On the server it checks if a session exists. If
 * authenticated the user is forwarded to the protected area. Otherwise
 * they are redirected to the login page. The component itself
 * returns null because redirection occurs via getServerSideProps.
 */
export default function Index() {
  return null;
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (session) {
    return {
      redirect: {
        destination: '/protected',
        permanent: false
      }
    };
  }
  return {
    redirect: {
      destination: '/login',
      permanent: false
    }
  };
}