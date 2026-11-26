import Link from 'next/link'
import { register } from '../../server/actions/auth'
import { authMessage } from '../auth/messages'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/" aria-label="Resilico home"><span className="brand-mark">R</span><span>resilico</span></Link>
        <p className="eyebrow">GET STARTED</p>
        <h1>Create your account</h1>
        <p className="auth-description">Join Resilico with a few details.</p>
        {authMessage(message) && <p className="form-message" role="status">{authMessage(message)}</p>}
        <form className="auth-form" action={register}>
          <div className="name-fields">
            <div className="field-group"><label htmlFor="first_name">First name</label><input id="first_name" name="first_name" type="text" autoComplete="given-name" placeholder="First name" required /></div>
            <div className="field-group"><label htmlFor="last_name">Last name</label><input id="last_name" name="last_name" type="text" autoComplete="family-name" placeholder="Last name" required /></div>
          </div>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          <label htmlFor="phone_number">Phone number <span className="optional-label">(optional)</span></label>
          <input id="phone_number" name="phone_number" type="tel" autoComplete="tel" placeholder="Your phone number" />
          <p className="form-section-title">Your address</p>
          <label htmlFor="address_line1">Address line 1</label>
          <input id="address_line1" name="address_line1" type="text" autoComplete="address-line1" placeholder="Street address" required />
          <label htmlFor="address_line2">Address line 2 <span className="optional-label">(optional)</span></label>
          <input id="address_line2" name="address_line2" type="text" autoComplete="address-line2" placeholder="Apartment, unit, etc." />
          <div className="name-fields address-fields">
            <div className="field-group"><label htmlFor="country">Country</label><input id="country" name="country" type="text" autoComplete="country-name" placeholder="Country" required /></div>
            <div className="field-group"><label htmlFor="province_state">Province / state <span className="optional-label">(optional)</span></label><input id="province_state" name="province_state" type="text" autoComplete="address-level1" placeholder="Province or state" /></div>
          </div>
          <div className="name-fields address-fields">
            <div className="field-group"><label htmlFor="city">City</label><input id="city" name="city" type="text" autoComplete="address-level2" placeholder="City" required /></div>
            <div className="field-group"><label htmlFor="postal_code">Postal code</label><input id="postal_code" name="postal_code" type="text" autoComplete="postal-code" placeholder="Postal code" required /></div>
          </div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
          <label htmlFor="confirm_password">Confirm password</label>
          <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" placeholder="Re-enter your password" minLength={8} required />
          <button className="primary-button" type="submit">Create account <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        <p className="security-note"><span aria-hidden="true">✳</span> Your account is protected with secure authentication.</p>
      </section>
    </main>
  )
}
