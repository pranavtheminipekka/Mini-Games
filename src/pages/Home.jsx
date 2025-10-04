import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';

export default function Home() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser, logout } = useGame();

  function handleAuth(e) {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password.');
      return;
    }
    const users = JSON.parse(localStorage.getItem('baccarat_users') || '{}');
    if (mode === 'signup') {
      if (users[username]) {
        setError('Username already exists.');
        return;
      }
      users[username] = { password, stats: {} };
      localStorage.setItem('baccarat_users', JSON.stringify(users));
    } else {
      if (!users[username] || users[username].password !== password) {
        setError('Invalid username or password.');
        return;
      }
    }
    localStorage.setItem('baccarat_current_user', username);
    setError('');
    navigate('/');
    window.location.reload(); // force context reload
  }

  if (currentUser) {
    // Show game selection if logged in
    return (
      <div style={{ maxWidth: 500, margin: '8vh auto', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px #0002', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 24 }}>Welcome, {currentUser}!</h2>
        <button onClick={() => navigate('/blackjack')} style={{ width: '80%', padding: 18, fontSize: 24, borderRadius: 12, background: '#222', color: '#fff', fontWeight: 700, border: 'none', marginBottom: 24 }}>Play Blackjack</button><br />
        <button onClick={() => navigate('/baccarat')} style={{ width: '80%', padding: 18, fontSize: 24, borderRadius: 12, background: '#2e8b57', color: '#fff', fontWeight: 700, border: 'none', marginBottom: 24 }}>Play Baccarat</button><br />
        <button onClick={logout} style={{ marginTop: 16, background: '#fff', color: '#e60026', border: '1.5px solid #e60026', borderRadius: 8, padding: '6px 24px', fontWeight: 600, fontSize: 16 }}>Log Out</button>
      </div>
    );
  }

  // Show login/signup if not logged in
  return (
    <div style={{ maxWidth: 400, margin: '8vh auto', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px #0002', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 24 }}>Welcome to Mini Casino</h2>
      <form onSubmit={handleAuth}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '90%', marginBottom: 12, padding: 8, fontSize: 18, borderRadius: 8, border: '1.5px solid #888' }} /><br />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '90%', marginBottom: 12, padding: 8, fontSize: 18, borderRadius: 8, border: '1.5px solid #888' }} /><br />
        <button type="submit" style={{ width: '90%', padding: 12, fontSize: 20, borderRadius: 8, background: '#2e8b57', color: '#fff', fontWeight: 700, border: 'none', marginBottom: 8 }}>{mode === 'login' ? 'Log In' : 'Sign Up'}</button>
      </form>
      <div style={{ marginBottom: 12, color: 'red', minHeight: 24 }}>{error}</div>
      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ background: 'none', color: '#2e8b57', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
        {mode === 'login' ? 'Create an account' : 'Already have an account? Log in'}
      </button>
    </div>
  );
}