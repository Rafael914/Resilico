'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <section className="card" aria-labelledby="counter-title">
      <h2 id="counter-title">Client-side interaction</h2>
      <p className="count" aria-live="polite">{count}</p>
      <button className="counter-button" onClick={() => setCount(count + 1)}>
        Add one
      </button>
      <p className="hint">
        This component uses <code>useState</code>, so it needs the{' '}
        <code>&apos;use client&apos;</code> directive.
      </p>
    </section>
  )
}
