import Link from 'next/link';
import React from 'react';

function Home() {
  return (
    <main>
      <div>Hello World</div>
      <Link href="/new">Create New User</Link>
    </main>
  );
}

export default Home;