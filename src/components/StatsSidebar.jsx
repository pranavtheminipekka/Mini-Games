import React from 'react';
import { useGame } from '../GameContext';

export default function StatsSidebar({ game }) {
  const { showStats, setShowStats, baccaratStats, blackjackStats } = useGame();
  if (!showStats || game === '') return null;
  return (
    <aside style={{ width: 250, background: '#e0e0e0', color: '#222', padding: 16, borderLeft: '1px solid #ccc', position: 'fixed', right: 0, top: 0, height: '100vh', overflowY: 'auto' }}>
      <button onClick={() => setShowStats(false)} style={{ float: 'right' }}>Close</button>
      <h3>Stats</h3>
      {game === 'baccarat' ? (
        <div>
          <h4>Baccarat Big Road</h4>
          <div style={{ fontSize: 12, marginBottom: 8 }}>{baccaratStats.history.join(' | ') || 'No history yet.'}</div>
          <div>Player Wins: {baccaratStats.player}</div>
          <div>Banker Wins: {baccaratStats.banker}</div>
          <div>Ties: {baccaratStats.tie}</div>
          <div>Naturals: {baccaratStats.naturals}</div>
          <div>Tiger Ties: {baccaratStats.tigerTies}</div>
          <div>Big Tigers: {baccaratStats.bigTigers}</div>
          <div>Small Tigers: {baccaratStats.smallTigers}</div>
        </div>
      ) : (
        <div>
          <h4>Blackjack Count</h4>
          <div>Running Count: {blackjackStats.runningCount}</div>
          <div>True Count: {blackjackStats.trueCount}</div>
        </div>
      )}
    </aside>
  );
}
