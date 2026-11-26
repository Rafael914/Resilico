import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOut } from '../../auth/actions'
import { dbHeaders } from '../../api/v1/_lib'
import { adminDatabaseConfig, getCurrentAdmin } from '../security'
import PendingButton from '../PendingButton'
import { createAdminManagedUser, deleteAdminManagedUser } from './actions'
import '../admin.css'

type ManagedUser = {
  user_id: number
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  role: string
}

function statusMessage(status?: string) {
  switch (status) {
    case 'created': return 'User created successfully.'
    case 'deleted': return 'User deleted successfully.'
    case 'invalid': return 'Enter the user’s name, a valid email, and a password with at least 8 characters.'
    case 'email-exists': return 'A user with that email already exists.'
    case 'cannot-delete-self': return 'You cannot delete the account you are currently using.'
    case 'admin-protected': return 'Admin accounts cannot be deleted here.'
    case 'user-not-found': return 'That user could not be found.'
    case 'user-has-orders': return 'This user has existing orders and cannot be deleted.'
    case 'user-has-records': return 'This user is linked to other records and cannot be deleted.'
    case 'save-failed': return 'User could not be saved. Check the users table permissions and required fields.'
    case 'configuration': return 'Database configuration is missing on the server.'
    default: return null
  }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin/users?status=configuration')

  const query = new URLSearchParams({
    select: 'user_id,first_name,last_name,email,phone_number,role',
    order: 'user_id.desc',
  })
  const response = await fetch(`${config.url}/rest/v1/users?${query}`, {
    headers: dbHeaders(config),
    cache: 'no-store',
  })
  const users = response.ok ? await response.json() as ManagedUser[] : []
  const { status } = await searchParams
  const message = statusMessage(status)

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin"><span className="brand-mark">R</span><span>resilico</span></Link>
        <p className="sidebar-label">WORKSPACE</p>
        <Link className="sidebar-link" href="/admin"><span aria-hidden="true">▦</span> Products</Link>
        <Link className="sidebar-link active" href="/admin/users"><span aria-hidden="true">♙</span> Users</Link>
        <div className="sidebar-bottom"><span className="admin-avatar">{admin.first_name.slice(0, 1).toUpperCase()}</span><div><strong>{admin.first_name} {admin.last_name}</strong><small>Administrator</small></div></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><span>Resilico <span className="breadcrumb-divider">/</span> Users <Link href="/admin/orders" className="admin-orders-link">Orders &amp; J&amp;T</Link></span><form action={signOut}><PendingButton className="signout-button" pendingText="Signing out…">Sign out</PendingButton></form></header>
        <div className="admin-content">
          <div className="admin-heading"><div><p className="admin-kicker">ACCOUNT MANAGEMENT</p><h1>Users</h1><p>Add customer accounts and review registered users.</p></div><span className="admin-role-pill">ADMIN</span></div>
          {message && <p className={`admin-alert ${status === 'created' ? 'success' : ''}`} role="status">{message}</p>}
          {!response.ok && <p className="admin-alert">Users could not be loaded. Check the users table permissions.</p>}

          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Add a user</h2><p>New accounts are created with the customer role.</p></div><span className="add-icon" aria-hidden="true">＋</span></div>
            <form action={createAdminManagedUser} className="product-form">
              <div className="product-form-grid">
                <div className="admin-field"><label htmlFor="user-first-name">First name</label><input id="user-first-name" name="first_name" autoComplete="given-name" maxLength={100} required /></div>
                <div className="admin-field"><label htmlFor="user-last-name">Last name</label><input id="user-last-name" name="last_name" autoComplete="family-name" maxLength={100} required /></div>
                <div className="admin-field"><label htmlFor="user-email">Email</label><input id="user-email" name="email" type="email" autoComplete="email" maxLength={255} required /></div>
                <div className="admin-field"><label htmlFor="user-phone">Phone <span className="field-optional">(optional)</span></label><input id="user-phone" name="phone_number" type="tel" autoComplete="tel" maxLength={30} /></div>
                <div className="admin-field"><label htmlFor="user-password">Temporary password</label><input id="user-password" name="password" type="password" autoComplete="new-password" minLength={8} required /><small className="field-hint">At least 8 characters.</small></div>
              </div>
              <div className="product-form-footer"><span className="field-hint">Share the temporary password with the user securely.</span><PendingButton className="add-product-button" pendingText="Adding user…">＋ Add user</PendingButton></div>
            </form>
          </section>

          <section className="admin-panel records-panel">
            <div className="panel-heading records-heading"><div><h2>User records</h2><p>{users.length} {users.length === 1 ? 'user' : 'users'} in your account list</p></div><span className="records-count">{users.length} TOTAL</span></div>
            {users.length === 0 ? <div className="empty-products"><strong>No users found</strong></div> : <div className="product-table-wrap"><table className="product-table"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {users.map((user) => <tr key={user.user_id}><td>#{user.user_id}</td><td>{user.first_name} {user.last_name}</td><td>{user.email}</td><td>{user.phone_number || '—'}</td><td><span className={`product-status ${user.role === 'admin' ? 'is-active' : ''}`}>{user.role}</span></td><td>{user.role === 'admin' ? <span>Protected</span> : <form action={deleteAdminManagedUser}><input type="hidden" name="user_id" value={user.user_id} /><PendingButton className="delete-product-button" pendingText="Deleting…">Delete</PendingButton></form>}</td></tr>)}
            </tbody></table></div>}
          </section>
        </div>
      </section>
    </main>
  )
}
