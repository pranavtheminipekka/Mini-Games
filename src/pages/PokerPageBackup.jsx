import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PokerPage() {
  const navigate = useNavigate();
  const [test, setTest] = useState('Working!');

  return (
    <div style={{ padding: 20 }}>
      <h2>Poker Page Test</h2>
      <p>{test}</p>
      <button onClick={() => navigate('/')}>Back to Home</button>
    </div>
  );
}