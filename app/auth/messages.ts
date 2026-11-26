export function authMessage(code?: string) {
  switch (code) {
    case 'invalid': return 'Complete the required fields and use a password with at least 8 characters.'
    case 'password-mismatch': return 'Your passwords do not match. Please try again.'
    case 'login-failed': return 'We could not sign you in. Check your details and try again.'
    case 'admin-only': return 'This area is for administrator accounts. Sign in with an admin account to continue.'
    case 'signup-failed': return 'We could not create the account because the database rejected the user or address record. Check the table constraints and ID sequences, then try again.'
    case 'email-exists': return 'An account with this email already exists. Please sign in instead.'
    case 'address-save-failed': return 'We could not save your address. No account was created; check the address table columns and try again.'
    case 'database-conflict': return 'The database found a conflicting user record ID. Check the users table ID sequence, then try again.'
    case 'session-expired': return 'Your session expired. Please sign in again.'
    case 'configuration': return 'Resilico cannot reach its database. The administrator should verify the Supabase project URL and connection.'
    default: return null
  }
}
