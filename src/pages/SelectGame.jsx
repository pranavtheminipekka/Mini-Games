import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SelectGame() {
  const navigate = useNavigate();
  const username = localStorage.getItem('baccarat_current_user');
  if (!username) {
    navigate('/');
    return null;
  }
  return (
    <div style={{ maxWidth: 500, margin: '8vh auto', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px #0002', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 24 }}>Welcome, {username}!</h2>
      <button onClick={() => navigate('/blackjack')} style={{ width: '80%', padding: 18, fontSize: 24, borderRadius: 12, background: '#222', color: '#fff', fontWeight: 700, border: 'none', marginBottom: 24 }}>Play Blackjack</button><br />
      <button onClick={() => navigate('/baccarat')} style={{ width: '80%', padding: 18, fontSize: 24, borderRadius: 12, background: '#2e8b57', color: '#fff', fontWeight: 700, border: 'none' }}>Play Baccarat</button>
    </div>
  );
}
