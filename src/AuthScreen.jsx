import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function AuthScreen({ onLogin, onAdminLogin }) {
  const [mode, setMode] = useState('login') // 'login', 'register', 'admin'
  const [zones, setZones] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Login fields
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Admin login fields
  const [adminUser, setAdminUser] = useState('')
  const [adminPass, setAdminPass] = useState('')

  // Register fields
  const [regData, setRegData] = useState({
    fname: '', lname: '', phone: '', password: '',
    zoneid: '', aadharno: '', wishtovolunteer: false
  })

  useEffect(() => {
    async function fetchZones() {
      const { data } = await supabase.from('zone').select('*')
      if (data) setZones(data)
    }
    fetchZones()
  }, [])

  // Helper: query the User table (uppercase as per schema)
  async function queryUser(filters) {
    const { data, error: err } = await supabase
      .from('User')
      .select('*')
      .match(filters)
      .single()

    if (err) throw new Error(err.message)
    return data
  }

  async function insertUser(row) {
    const { data, error: err } = await supabase
      .from('User')
      .insert([row])
      .select()
      .single()

    if (err) throw new Error(err.message)
    return data
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await queryUser({ phone: loginPhone, passwordhash: loginPassword })
      if (!user) {
        setError('Invalid phone number or password.')
        setLoading(false)
        return
      }
      onLogin(user)
    } catch {
      setError('Invalid phone number or password.')
    }
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check if phone is already registered
      let existing = null
      try {
        existing = await queryUser({ phone: regData.phone })
      } catch {
        // No existing user found — that's good
      }
      if (existing) {
        setError('An account with this phone number already exists. Please login.')
        setLoading(false)
        return
      }

      const user = await insertUser({
        fname: regData.fname,
        lname: regData.lname || null,
        phone: regData.phone,
        passwordhash: regData.password,
        zoneid: parseInt(regData.zoneid),
        aadharno: regData.wishtovolunteer ? regData.aadharno : null,
        level: 1,
        wishtovolunteer: regData.wishtovolunteer
      })

      onLogin(user)
    } catch (err) {
      setError('Registration failed: ' + err.message)
    }
    setLoading(false)
  }

  async function handleAdminLogin(e) {
    e.preventDefault()
    setError('')
    if (adminUser === 'admin' && adminPass === 'admin123') {
      onAdminLogin()
    } else {
      setError('Invalid admin credentials.')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🚨 Disaster Management Center</h1>
        <p className="auth-subtitle">Report crises, volunteer, and protect your community</p>

        {mode !== 'admin' ? (
          <>
            <div className="auth-tabs">
              <button
                className={mode === 'login' ? 'active' : ''}
                onClick={() => { setMode('login'); setError('') }}
              >
                Login
              </button>
              <button
                className={mode === 'register' ? 'active' : ''}
                onClick={() => { setMode('register'); setError('') }}
              >
                Register
              </button>
            </div>

            {error && <div className="auth-error">{error}</div>}

            {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                type="text" required
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                type="password" required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-row">
              <div className="input-group">
                <label>First Name *</label>
                <input
                  type="text" required
                  value={regData.fname}
                  onChange={e => setRegData({ ...regData, fname: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div className="input-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={regData.lname}
                  onChange={e => setRegData({ ...regData, lname: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="input-group">
              <label>Phone Number *</label>
              <input
                type="text" required
                value={regData.phone}
                onChange={e => setRegData({ ...regData, phone: e.target.value })}
                placeholder="Phone number (used to login)"
              />
            </div>
            <div className="input-group">
              <label>Zone *</label>
              <select
                required
                value={regData.zoneid}
                onChange={e => setRegData({ ...regData, zoneid: e.target.value })}
              >
                <option value="">Select your zone</option>
                {zones.map(z => (
                  <option key={z.zoneid} value={z.zoneid}>{z.zonename}</option>
                ))}
              </select>
            </div>
            <div className="input-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={regData.wishtovolunteer}
                  onChange={e => setRegData({ ...regData, wishtovolunteer: e.target.checked, aadharno: '' })}
                />
                I wish to volunteer in crises
              </label>
            </div>
            {regData.wishtovolunteer && (
              <div className="input-group">
                <label>Aadhaar Number *</label>
                <input
                  type="text" required
                  value={regData.aadharno}
                  onChange={e => setRegData({ ...regData, aadharno: e.target.value })}
                  placeholder="Required for volunteers"
                />
              </div>
            )}
            <div className="input-group">
              <label>Password *</label>
              <input
                type="password" required
                value={regData.password}
                onChange={e => setRegData({ ...regData, password: e.target.value })}
                placeholder="Create a password"
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>
        )}

            <p className="admin-link" onClick={() => { setMode('admin'); setError('') }}>
              Admin / Dispatcher Login →
            </p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: '18px' }}>Admin Login</h2>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleAdminLogin}>
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text" required
                  value={adminUser}
                  onChange={e => setAdminUser(e.target.value)}
                  placeholder="Admin username"
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input
                  type="password" required
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="Admin password"
                />
              </div>
              <button type="submit" className="btn">Login as Admin</button>
            </form>
            <p className="admin-link" onClick={() => { setMode('login'); setError('') }}>
              ← Back to User Login
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthScreen
