import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const GameContext = createContext();


export function useGame() {
  return useContext(GameContext);
}

export function GameProvider({ children }) {
  // Track current user
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('baccarat_current_user') || null);
  const [chips, setChips] = useState(10000);
  const [showStats, setShowStats] = useState(false);
  const [baccaratStats, setBaccaratStats] = useState({
    history: [],
    player: 0,
    banker: 0,
    tie: 0,
    naturals: 0,
    tigerTies: 0,
    bigTigers: 0,
    smallTigers: 0,
  });
  const [blackjackStats, setBlackjackStats] = useState({
    runningCount: 0,
    trueCount: 0,
  });
  const [pokerStats, setPokerStats] = useState({
    handsPlayed: 0,
    handsWon: 0,
    totalWinnings: 0,
    biggestPot: 0,
    vpip: 0, // Voluntarily Put money In Pot
    pfr: 0, // Pre-Flop Raise
    aggression: 0,
  });
  // Track if loaded from storage
  const loadedRef = useRef(false);

  // Load user profile on login
  useEffect(() => {
    const user = localStorage.getItem('baccarat_current_user');
    setCurrentUser(user);
    if (user) {
      const users = JSON.parse(localStorage.getItem('baccarat_users') || '{}');
      const profile = users[user] || {};
      setChips(profile.chips ?? 10000);
      setBaccaratStats(profile.stats?.baccaratStats ?? {
        history: [], player: 0, banker: 0, tie: 0, naturals: 0, tigerTies: 0, bigTigers: 0, smallTigers: 0
      });
      setBlackjackStats(profile.stats?.blackjackStats ?? { runningCount: 0, trueCount: 0 });
      setPokerStats(profile.stats?.pokerStats ?? {
        handsPlayed: 0, handsWon: 0, totalWinnings: 0, biggestPot: 0, vpip: 0, pfr: 0, aggression: 0
      });
      loadedRef.current = true;
    } else {
      setChips(10000);
      setBaccaratStats({ history: [], player: 0, banker: 0, tie: 0, naturals: 0, tigerTies: 0, bigTigers: 0, smallTigers: 0 });
      setBlackjackStats({ runningCount: 0, trueCount: 0 });
      setPokerStats({ handsPlayed: 0, handsWon: 0, totalWinnings: 0, biggestPot: 0, vpip: 0, pfr: 0, aggression: 0 });
      loadedRef.current = false;
    }
  }, [localStorage.getItem('baccarat_current_user')]);

  // Save profile on change (chips)
  useEffect(() => {
    if (!currentUser || !loadedRef.current) return;
    const users = JSON.parse(localStorage.getItem('baccarat_users') || '{}');
    users[currentUser] = users[currentUser] || { password: '', stats: {} };
    users[currentUser].chips = chips;
    localStorage.setItem('baccarat_users', JSON.stringify(users));
  }, [chips, currentUser]);

  // Save profile on change (stats)
  useEffect(() => {
    if (!currentUser || !loadedRef.current) return;
    const users = JSON.parse(localStorage.getItem('baccarat_users') || '{}');
    users[currentUser] = users[currentUser] || { password: '', stats: {} };
    users[currentUser].stats = {
      baccaratStats,
      blackjackStats,
      pokerStats,
    };
    localStorage.setItem('baccarat_users', JSON.stringify(users));
  }, [baccaratStats, blackjackStats, pokerStats, currentUser]);

  function addChips(amount) {
    setChips(c => c + amount);
  }
  function spendChips(amount) {
    setChips(c => Math.max(0, c - amount));
  }
  function resetChips() {
    setChips(10000);
  }
  function logout() {
    localStorage.removeItem('baccarat_current_user');
    setCurrentUser(null);
    setChips(10000);
    setBaccaratStats({ history: [], player: 0, banker: 0, tie: 0, naturals: 0, tigerTies: 0, bigTigers: 0, smallTigers: 0 });
    setBlackjackStats({ runningCount: 0, trueCount: 0 });
    setPokerStats({ handsPlayed: 0, handsWon: 0, totalWinnings: 0, biggestPot: 0, vpip: 0, pfr: 0, aggression: 0 });
  }

  return (
    <GameContext.Provider value={{
      chips,
      addChips,
      spendChips,
      resetChips,
      showStats,
      setShowStats,
      baccaratStats,
      setBaccaratStats,
      blackjackStats,
      setBlackjackStats,
      pokerStats,
      setPokerStats,
      currentUser,
      logout,
    }}>
      {children}
    </GameContext.Provider>
  );
}
