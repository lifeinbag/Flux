// client/src/pages/Admin.jsx
import { useEffect, useState } from 'react';
import API from '../services/api';
import NavBar from '../components/NavBar';
import './Admin.css';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState('edit'); // 'edit', 'add-account-set', 'add-broker', 'view-details'
  const [systemStats, setSystemStats] = useState({});
  const [selectedAccountSet, setSelectedAccountSet] = useState(null);
  const [selectedBroker, setSelectedBroker] = useState(null);

  // Form states
  const [newAccountSet, setNewAccountSet] = useState({
    name: '',
    brokers: [
      { terminal: 'MT4', accountNumber: '', password: '', server: '' },
      { terminal: 'MT5', accountNumber: '', password: '', server: '' }
    ]
  });

  const [newBroker, setNewBroker] = useState({
    terminal: 'MT4',
    accountNumber: '',
    password: '',
    server: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchSystemStats();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const res = await API.get('/admin/stats');
      setSystemStats(res.data);
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This will also delete all their account sets and brokers.')) return;

    try {
      await API.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      setShowModal(false);
      await fetchSystemStats();
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await API.put(`/admin/users/${userId}`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setShowModal(false);
      await fetchSystemStats();
    } catch (err) {
      setError('Failed to update user role');
      console.error(err);
    }
  };

  const handleAddAccountSet = async () => {
    try {
      const res = await API.post(`/admin/users/${selectedUser.id}/account-sets`, newAccountSet);
      
      // Update local state
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { 
              ...u, 
              accountSetsCount: (u.accountSetsCount || 0) + 1,
              mt4Count: (u.mt4Count || 0) + (newAccountSet.brokers.filter(b => b.terminal === 'MT4').length),
              mt5Count: (u.mt5Count || 0) + (newAccountSet.brokers.filter(b => b.terminal === 'MT5').length)
            }
          : u
      ));
      
      setShowModal(false);
      setNewAccountSet({
        name: '',
        brokers: [
          { terminal: 'MT4', accountNumber: '', password: '', server: '' },
          { terminal: 'MT5', accountNumber: '', password: '', server: '' }
        ]
      });
      await fetchSystemStats();
    } catch (err) {
      setError('Failed to add account set');
      console.error(err);
    }
  };

  const handleAddBroker = async () => {
    try {
      const res = await API.post(`/admin/account-sets/${selectedAccountSet.id}/brokers`, newBroker);
      
      // Update local state
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { 
              ...u, 
              mt4Count: newBroker.terminal === 'MT4' ? (u.mt4Count || 0) + 1 : u.mt4Count,
              mt5Count: newBroker.terminal === 'MT5' ? (u.mt5Count || 0) + 1 : u.mt5Count
            }
          : u
      ));
      
      setShowModal(false);
      setNewBroker({
        terminal: 'MT4',
        accountNumber: '',
        password: '',
        server: ''
      });
      await fetchSystemStats();
    } catch (err) {
      setError('Failed to add broker');
      console.error(err);
    }
  };

  const handleDeleteAccountSet = async (accountSetId) => {
    if (!window.confirm('Are you sure you want to delete this account set? This will also delete all associated brokers.')) return;

    try {
      await API.delete(`/admin/account-sets/${accountSetId}`);
      
      // Refresh user data
      await fetchUsers();
      await fetchSystemStats();
      setShowModal(false);
    } catch (err) {
      setError('Failed to delete account set');
      console.error(err);
    }
  };

  const handleDeleteBroker = async (brokerId) => {
    if (!window.confirm('Are you sure you want to delete this broker?')) return;

    try {
      await API.delete(`/admin/brokers/${brokerId}`);
      
      // Refresh user data
      await fetchUsers();
      await fetchSystemStats();
    } catch (err) {
      setError('Failed to delete broker');
      console.error(err);
    }
  };

  const openModal = (type, user = null, accountSet = null, broker = null) => {
    setModalType(type);
    setSelectedUser(user);
    setSelectedAccountSet(accountSet);
    setSelectedBroker(broker);
    setShowModal(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const userStats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    users: users.filter(u => u.role === 'user').length,
    withAccountSets: users.filter(u => u.accountSetsCount > 0).length,
    totalTerminals: users.reduce((sum, u) => sum + (u.mt4Count || 0) + (u.mt5Count || 0), 0),
  };

  return (
    <div className="admin-dashboard">
      <NavBar />

      <div className="admin-content">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Manage all users and system settings in Flux Network</p>
        </div>

        {error && (
          <div className="error-alert">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

<div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>{userStats.total}</h3>
              <p>Total Users</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛡️</div>
            <div className="stat-info">
              <h3>{userStats.admins}</h3>
              <p>Admins</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>{userStats.withAccountSets}</h3>
              <p>With Account Sets</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔗</div>
            <div className="stat-info">
              <h3>{userStats.totalTerminals}</h3>
              <p>Total Terminals</p>
            </div>
          </div>
          
          {/* EXTENDED STATISTICS */}
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <h3>{systemStats.recentUsers || 0}</h3>
              <p>Recent Users (30d)</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <h3>{systemStats.recentAccountSets || 0}</h3>
              <p>Recent Account Sets (30d)</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🟢</div>
            <div className="stat-info">
              <h3>{systemStats.mt4Brokers || 0}</h3>
              <p>MT4 Brokers</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔵</div>
            <div className="stat-info">
              <h3>{systemStats.mt5Brokers || 0}</h3>
              <p>MT5 Brokers</p>
            </div>
          </div>
        </div>

        <div className="users-section">
          <div className="section-header">
            <h2>User Management</h2>
            <div className="controls">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading users...</p>
            </div>
          ) : (
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Account Sets</th>
                    <th>MT4</th>
                    <th>MT5</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="user-email">{user.email}</div>
                            <div className="user-date">
                              Joined {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className="account-count">
                          {user.accountSetsCount || 0}
                        </span>
                      </td>
                      <td>
                        <span className="terminal-count">
                          {user.mt4Count || 0}
                        </span>
                      </td>
                      <td>
                        <span className="terminal-count">
                          {user.mt5Count || 0}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge active">
                          Active
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openModal('view-details', user)}
                            className="btn-view"
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => openModal('edit', user)}
                            className="btn-edit"
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => openModal('add-account-set', user)}
                            className="btn-add"
                            title="Add Account Set"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="btn-delete"
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Enhanced Modal System */}
        {showModal && selectedUser && (
          <div className="modal-overlay">
            <div className="modal large">
              <div className="modal-header">
                <h3>
                  {modalType === 'edit' && 'Edit User'}
                  {modalType === 'add-account-set' && 'Add Account Set'}
                  {modalType === 'add-broker' && 'Add Broker'}
                  {modalType === 'view-details' && 'User Details'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                {modalType === 'edit' && (
                  <EditUserForm 
                    user={selectedUser}
                    onRoleChange={handleRoleChange}
                    onClose={() => setShowModal(false)}
                  />
                )}
                
                {modalType === 'add-account-set' && (
                  <AddAccountSetForm 
                    user={selectedUser}
                    accountSet={newAccountSet}
                    setAccountSet={setNewAccountSet}
                    onSubmit={handleAddAccountSet}
                    onClose={() => setShowModal(false)}
                  />
                )}
                
                {modalType === 'add-broker' && (
                  <AddBrokerForm 
                    user={selectedUser}
                    accountSet={selectedAccountSet}
                    broker={newBroker}
                    setBroker={setNewBroker}
                    onSubmit={handleAddBroker}
                    onClose={() => setShowModal(false)}
                  />
                )}
                
                {modalType === 'view-details' && (
                  <UserDetailsView 
                    user={selectedUser}
                    onDeleteAccountSet={handleDeleteAccountSet}
                    onDeleteBroker={handleDeleteBroker}
                    onAddBroker={(accountSet) => openModal('add-broker', selectedUser, accountSet)}
                    onClose={() => setShowModal(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Modal Components
function EditUserForm({ user, onRoleChange, onClose }) {
  const [role, setRole] = useState(user.role);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRoleChange(user.id, role);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Email</label>
        <input type="text" value={user.email} disabled />
      </div>
      <div className="form-group">
        <label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="form-group">
        <label>Account Sets</label>
        <input type="text" value={user.accountSetsCount || 0} readOnly />
      </div>
      <div className="form-group">
        <label>MT4 Terminals</label>
        <input type="text" value={user.mt4Count || 0} readOnly />
      </div>
      <div className="form-group">
        <label>MT5 Terminals</label>
        <input type="text" value={user.mt5Count || 0} readOnly />
      </div>
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn-cancel">
          Cancel
        </button>
        <button type="submit" className="btn-save">
          Save Changes
        </button>
      </div>
    </form>
  );
}

function AddAccountSetForm({ user, accountSet, setAccountSet, onSubmit, onClose }) {
  const handleBrokerChange = (index, field, value) => {
    const newBrokers = [...accountSet.brokers];
    newBrokers[index][field] = value;
    setAccountSet({ ...accountSet, brokers: newBrokers });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Account Set Name</label>
        <input 
          type="text" 
          value={accountSet.name}
          onChange={(e) => setAccountSet({ ...accountSet, name: e.target.value })}
          placeholder="Enter account set name"
          required
        />
      </div>
      
      <h4>Brokers (MT4 + MT5)</h4>
      {accountSet.brokers.map((broker, index) => (
        <div key={index} className="broker-form">
          <h5>Broker {index + 1} ({broker.terminal})</h5>
          <div className="form-row">
            <div className="form-group">
              <label>Terminal</label>
              <select 
                value={broker.terminal}
                onChange={(e) => handleBrokerChange(index, 'terminal', e.target.value)}
              >
                <option value="MT4">MT4</option>
                <option value="MT5">MT5</option>
              </select>
            </div>
            <div className="form-group">
              <label>Account Number</label>
              <input 
                type="text" 
                value={broker.accountNumber}
                onChange={(e) => handleBrokerChange(index, 'accountNumber', e.target.value)}
                placeholder="Account number"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={broker.password}
                onChange={(e) => handleBrokerChange(index, 'password', e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            <div className="form-group">
              <label>Server</label>
              <input 
                type="text" 
                value={broker.server}
                onChange={(e) => handleBrokerChange(index, 'server', e.target.value)}
                placeholder="Server address"
                required
              />
            </div>
          </div>
        </div>
      ))}
      
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn-cancel">
          Cancel
        </button>
        <button type="submit" className="btn-save">
          Add Account Set
        </button>
      </div>
    </form>
  );
}

function AddBrokerForm({ user, accountSet, broker, setBroker, onSubmit, onClose }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Account Set</label>
        <input type="text" value={accountSet?.name || 'N/A'} disabled />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Terminal</label>
          <select 
            value={broker.terminal}
            onChange={(e) => setBroker({ ...broker, terminal: e.target.value })}
          >
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
          </select>
        </div>
        <div className="form-group">
          <label>Account Number</label>
          <input 
            type="text" 
            value={broker.accountNumber}
            onChange={(e) => setBroker({ ...broker, accountNumber: e.target.value })}
            placeholder="Account number"
            required
          />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            value={broker.password}
            onChange={(e) => setBroker({ ...broker, password: e.target.value })}
            placeholder="Password"
            required
          />
        </div>
        <div className="form-group">
          <label>Server</label>
          <input 
            type="text" 
            value={broker.server}
            onChange={(e) => setBroker({ ...broker, server: e.target.value })}
            placeholder="Server address"
            required
          />
        </div>
      </div>
      
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn-cancel">
          Cancel
        </button>
        <button type="submit" className="btn-save">
          Add Broker
        </button>
      </div>
    </form>
  );
}

function UserDetailsView({ user, onDeleteAccountSet, onDeleteBroker, onAddBroker, onClose }) {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const res = await API.get(`/admin/users/${user.id}/details`);
        setUserDetails(res.data);
      } catch (err) {
        console.error('Failed to fetch user details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [user.id]);

  if (loading) {
    return <div className="loading">Loading user details...</div>;
  }

  return (
    <div className="user-details">
      <div className="user-info-section">
        <h4>User Information</h4>
        <div className="info-grid">
          <div className="info-item">
            <label>Email:</label>
            <span>{user.email}</span>
          </div>
          <div className="info-item">
            <label>Role:</label>
            <span className={`role-badge ${user.role}`}>{user.role}</span>
          </div>
          <div className="info-item">
            <label>Joined:</label>
            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="info-item">
            <label>Account Sets:</label>
            <span>{user.accountSetsCount || 0}</span>
          </div>
        </div>
      </div>

      <div className="account-sets-section">
        <h4>Account Sets & Brokers</h4>
        {userDetails?.accountSets?.map(accountSet => (
          <div key={accountSet.id} className="account-set-item">
            <div className="account-set-header">
              <h5>{accountSet.name}</h5>
              <div className="account-set-actions">
                <button
                  onClick={() => onAddBroker(accountSet)}
                  className="btn-add-small"
                  title="Add Broker"
                >
                  ➕ Broker
                </button>
                <button
                  onClick={() => onDeleteAccountSet(accountSet.id)}
                  className="btn-delete-small"
                  title="Delete Account Set"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className="brokers-list">
              {accountSet.brokers?.map(broker => (
                <div key={broker.id} className="broker-item">
                  <div className="broker-info">
                    <span className={`terminal-badge ${broker.terminal.toLowerCase()}`}>
                      {broker.terminal}
                    </span>
                    <span className="broker-account">{broker.accountNumber}</span>
                    <span className="broker-server">{broker.server}</span>
                  </div>
                  <button
                    onClick={() => onDeleteBroker(broker.id)}
                    className="btn-delete-small"
                    title="Delete Broker"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="modal-footer">
        <button onClick={onClose} className="btn-cancel">
          Close
        </button>
      </div>
    </div>
  );
}