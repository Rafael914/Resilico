import Link from 'next/link'
import { login } from '../auth/actions'
import { authMessage } from '../auth/messages'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/" aria-label="Resilico home"><span className="brand-mark">R</span><span>resilico</span></Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p className="auth-description">Enter your details to continue to Resilico.</p>
        {authMessage(message) && <p className="form-message" role="status">{authMessage(message)}</p>}
        <form className="auth-form" action={login}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
          <button className="primary-button" type="submit">Sign in <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">New to Resilico? <Link href="/register">Create an account</Link></p>
        <p className="security-note"><span aria-hidden="true">✳</span> Your account is protected with secure authentication.</p>
      </section>
    </main>
  )
}
