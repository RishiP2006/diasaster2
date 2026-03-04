// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthScreen from './AuthScreen'
import './App.css'

function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('disasterUser')
    return saved ? JSON.parse(saved) : null
  })
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('disasterAdmin') === 'true'
  })

  const [role, setRole] = useState('citizen') // 'citizen', 'admin', 'authority'
  
  // Data State
  const [requests, setRequests] = useState([])
  const [zones, setZones] = useState([])
  const [crisisTypes, setCrisisTypes] = useState([])
  const [authorities, setAuthorities] = useState([])
  
  // Family State
  const [myFamily, setMyFamily] = useState(null)
  const [availableFamilies, setAvailableFamilies] = useState([])
  const [newFamilyName, setNewFamilyName] = useState('')
  const [joinFamilyId, setJoinFamilyId] = useState('')
  
  // Form State
  const [formData, setFormData] = useState({ title: '', description: '', crisistypeid: '', zoneid: '', severity: 5 })
  const [assignData, setAssignData] = useState({}) 

  function handleLogin(user) {
    setCurrentUser(user)
    setIsAdmin(false)
    localStorage.setItem('disasterUser', JSON.stringify(user))
    localStorage.removeItem('disasterAdmin')
  }

  function handleAdminLogin() {
    setCurrentUser({ userid: 0, fname: 'Admin' })
    setIsAdmin(true)
    setRole('admin')
    localStorage.setItem('disasterUser', JSON.stringify({ userid: 0, fname: 'Admin' }))
    localStorage.setItem('disasterAdmin', 'true')
  }

  function handleLogout() {
    setCurrentUser(null)
    setIsAdmin(false)
    localStorage.removeItem('disasterUser')
    localStorage.removeItem('disasterAdmin')
    setMyFamily(null)
    setRequests([])
    setRole('citizen')
  }

  useEffect(() => {
    if (currentUser) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  async function fetchData() {
    // 1. Fetch main requests
    const { data: reqData } = await supabase
      .from('request')
      .select('*, zone(zonename), crisistype(typename), authorityassignment(authorityid, status, authority(fname, lname)), userhelp(userid, status)')
      .order('requestid', { ascending: false })
    if (reqData) setRequests(reqData)

    // 2. Fetch dropdown data
    const { data: zoneData } = await supabase.from('zone').select('*')
    if (zoneData) setZones(zoneData)

    const { data: crisisData } = await supabase.from('crisistype').select('*')
    if (crisisData) setCrisisTypes(crisisData)

    const { data: authData } = await supabase.from('authority').select('*')
    if (authData) setAuthorities(authData)

    // 3. Fetch all Families
    const { data: famData } = await supabase.from('family').select('*')
    if (famData) setAvailableFamilies(famData)

    // 4. Fetch Current User's Family Status 
    let { data: userData, error: userErr } = await supabase.from('User').select('familyowner').eq('userid', currentUser.userid).single()
    
    // Fallback if Supabase forced it to lowercase behind the scenes
    if (userErr) {
      const { data: fallbackUser } = await supabase.from('user').select('familyowner').eq('userid', currentUser.userid).single()
      userData = fallbackUser
    }

    if (userData?.familyowner && famData) {
      const userFam = famData.find(f => f.createdby === userData.familyowner)
      setMyFamily(userFam || null)
    } else {
      setMyFamily(null)
    }
  }

  // --- FAMILY ACTIONS ---
  async function handleCreateFamily(e) {
    e.preventDefault()
    
    // 1. Upsert into Family table
    const { error: famError } = await supabase.from('family').upsert([{
      createdby: currentUser.userid,
      familyname: newFamilyName,
      nummembers: 1,
      cumulativelevel: currentUser.level || 1
    }])
    
    if (famError) return alert('Error creating family: ' + famError.message)

    // 2. Update User table to link them (familyowner points to family creator)
    await supabase.from('User').update({ familyowner: currentUser.userid }).eq('userid', currentUser.userid)
    
    alert('Family Created!')
    setNewFamilyName('')
    fetchData()
  }

  async function handleJoinFamily(e) {
    e.preventDefault()
    if (!joinFamilyId) return

    const targetFam = availableFamilies.find(f => f.createdby === parseInt(joinFamilyId))
    if (!targetFam || targetFam.nummembers >= 6) return alert("Family is full or invalid!")

    // 1. Update User to point to the new family creator's ID
    const { error } = await supabase.from('User').update({ familyowner: parseInt(joinFamilyId) }).eq('userid', currentUser.userid)
    if (error) return alert('Error joining: ' + error.message)

    // 2. Increment family member count and update cumulative level
    await supabase.from('family').update({
      nummembers: targetFam.nummembers + 1,
      cumulativelevel: (targetFam.cumulativelevel || 0) + (currentUser.level || 1)
    }).eq('createdby', parseInt(joinFamilyId))
    
    alert('Successfully joined family!')
    setJoinFamilyId('')
    fetchData()
  }

  async function handleLeaveFamily() {
    if (!myFamily) return

    const isCreator = myFamily.createdby === currentUser.userid

    if (isCreator) {
      // Creator disbands: reset ALL members' familyowner first, then delete the family
      await supabase.from('User').update({ familyowner: null }).eq('familyowner', myFamily.createdby)
      await supabase.from('family').delete().eq('createdby', myFamily.createdby)
      alert('Family disbanded. All members have been removed.')
    } else {
      // Regular member leaves
      await supabase.from('User').update({ familyowner: null }).eq('userid', currentUser.userid)
      await supabase.from('family').update({
        nummembers: Math.max(1, myFamily.nummembers - 1),
        cumulativelevel: Math.max(0, (myFamily.cumulativelevel || 0) - (currentUser.level || 1))
      }).eq('createdby', myFamily.createdby)
      alert('You left the family.')
    }

    fetchData()
  }

  // --- CITIZEN ACTIONS ---
  async function handleSubmitRequest(e) {
    e.preventDefault()
    const { error } = await supabase.from('request').insert([{
      title: formData.title, description: formData.description,
      crisistypeid: parseInt(formData.crisistypeid), zoneid: parseInt(formData.zoneid),
      severity: parseInt(formData.severity), createdby: currentUser.userid, status: 'Open'
    }])
    if (error) alert('Error: ' + error.message)
    else {
      alert('Request Added!')
      fetchData()
      setFormData({ title: '', description: '', crisistypeid: '', zoneid: '', severity: 5 })
    }
  }

  async function handleVolunteer(requestId) {
    const { error } = await supabase.from('userhelp').insert([{
      requestid: requestId, userid: currentUser.userid, status: 'Active'
    }])
    if (error) alert('Error volunteering: ' + error.message)
    else { alert('You are now volunteering for this crisis!'); fetchData() }
  }

  // --- ADMIN ACTIONS ---
  async function handleAssignAuthority(requestId) {
    const authId = assignData[requestId]
    if (!authId) return alert("Please select an authority first.")

    const { error } = await supabase.from('authorityassignment').insert([{
      requestid: requestId, authorityid: parseInt(authId), status: 'Assigned'
    }])
    
    // Update Request status to InProgress
    await supabase.from('request').update({ status: 'InProgress' }).eq('requestid', requestId)

    if (error) alert('Assignment Error: ' + error.message)
    else { alert('Authority Assigned!'); fetchData() }
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onAdminLogin={handleAdminLogin} />
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>🚨 Disaster Management Center</h1>
        <div className="user-info">
          <span>Welcome, <strong>{currentUser.fname}</strong></span>
          <button className="btn btn-small btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      
      {/* ROLE SWITCHER (Admin only) */}
      {isAdmin && (
        <div className="role-switcher">
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>Dispatcher Console</button>
        </div>
      )}

      <div className="dashboard">

        {/* ========================================== */}
        {/* CITIZEN VIEW */}
        {/* ========================================== */}
        {role === 'citizen' && (
          <div className="grid">
            
            {/* FAMILY HUB SECTION */}
            <div className="card family-section">
              <h2>My Family Hub</h2>
              {myFamily ? (
                <div>
                  <h3>{myFamily.familyname}</h3>
                  <p><strong>Members:</strong> {myFamily.nummembers} / 6</p>
                  <p><strong>Cumulative Level:</strong> {myFamily.cumulativelevel}</p>
                  {myFamily.createdby === currentUser.userid
                    ? <span className="badge badge-open" style={{marginRight: '10px'}}>👑 Creator</span>
                    : <span className="badge badge-resolved" style={{marginRight: '10px'}}>✅ Member</span>
                  }
                  <button className="btn btn-small" style={{backgroundColor: '#6b7280'}} onClick={handleLeaveFamily}>
                    {myFamily.createdby === currentUser.userid ? 'Disband Family' : 'Leave Family'}
                  </button>
                </div>
              ) : (
                <div>
                  <form onSubmit={handleCreateFamily} style={{marginBottom: '20px'}}>
                    <div className="input-group">
                      <label>Create a New Family</label>
                      <input type="text" placeholder="Family Name" required value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-small">Create & Join</button>
                  </form>
                  <hr style={{margin: '20px 0', border: '0', borderTop: '1px solid #e5e7eb'}}/>
                  <form onSubmit={handleJoinFamily}>
                    <div className="input-group">
                      <label>Join Existing Family</label>
                      <select required value={joinFamilyId} onChange={e => setJoinFamilyId(e.target.value)}>
                        <option value="">Select a family...</option>
                        {availableFamilies.filter(f => f.nummembers < 6).map(f => (
                          <option key={f.createdby} value={f.createdby}>{f.familyname} ({f.nummembers}/6 members)</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="btn btn-small btn-volunteer">Join Family</button>
                  </form>
                </div>
              )}
            </div>

            {/* FORM SECTION */}
            <div className="card form-section">
              <h2>Report a Crisis</h2>
              <form onSubmit={handleSubmitRequest}>
                <div className="input-group">
                  <label>Title</label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Description</label>
                  <textarea required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Crisis Type</label>
                  <select required value={formData.crisistypeid} onChange={(e) => setFormData({...formData, crisistypeid: e.target.value})}>
                    <option value="">Select...</option>
                    {crisisTypes.map(c => <option key={c.crisistypeid} value={c.crisistypeid}>{c.typename}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Zone</label>
                  <select required value={formData.zoneid} onChange={(e) => setFormData({...formData, zoneid: e.target.value})}>
                    <option value="">Select...</option>
                    {zones.map(z => <option key={z.zoneid} value={z.zoneid}>{z.zonename}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Severity (1-10)</label>
                  <input type="number" min="1" max="10" required value={formData.severity} onChange={(e) => setFormData({...formData, severity: e.target.value})} />
                </div>
                <button type="submit" className="btn">Submit Request</button>
              </form>
            </div>

            {/* LIST SECTION */}
            <div className="card list-section full-width" style={{gridColumn: '1 / -1'}}>
              <h2>Community Feed</h2>
              {requests.length === 0 ? <p>No active requests yet.</p> : null}
              {requests.map((req) => (
                <div key={req.requestid} className="request-item">
                  <h3>{req.title} <span className="badge badge-open">{req.status}</span></h3>
                  <p>{req.description}</p>
                  <small><strong>Zone:</strong> {req.zone?.zonename} | <strong>Severity:</strong> {req.severity}</small>
                  
                  {/* Show Volunteer button if they haven't volunteered yet */}
                  {!req.userhelp?.some(v => v.userid === currentUser.userid) && req.status !== 'Resolved' && req.status !== 'Closed' && (
                    <button className="btn btn-small btn-volunteer" onClick={() => handleVolunteer(req.requestid)}>
                      Hand Raise to Volunteer
                    </button>
                  )}
                  {req.userhelp?.some(v => v.userid === currentUser.userid) && (
                    <p className="success-text">✅ You are volunteering for this.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* ADMIN VIEW */}
        {/* ========================================== */}
        {role === 'admin' && (
          <div className="card full-width">
            <h2>Dispatcher Console</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>Crisis</th><th>Zone</th><th>Severity</th><th>Status</th><th>Assignment</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.requestid}>
                    <td>#{req.requestid}</td>
                    <td>{req.title} <br/><small>{req.crisistype?.typename}</small></td>
                    <td>{req.zone?.zonename}</td>
                    <td>{req.severity}/10</td>
                    <td><span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span></td>
                    <td>
                      {req.authorityassignment?.length > 0 ? (
                        <strong>Assigned to: {req.authorityassignment[0].authority.fname} {req.authorityassignment[0].authority.lname}</strong>
                      ) : (
                        <div className="assign-action">
                          <select 
                            onChange={(e) => setAssignData({...assignData, [req.requestid]: e.target.value})}
                            value={assignData[req.requestid] || ''}
                          >
                            <option value="">Select Authority...</option>
                            {authorities.map(a => <option key={a.badgenumber} value={a.badgenumber}>{a.fname} {a.lname} ({a.rank})</option>)}
                          </select>
                          <button className="btn btn-small" onClick={() => handleAssignAuthority(req.requestid)}>Assign</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

export default App