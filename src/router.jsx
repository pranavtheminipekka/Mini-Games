

import { useGame } from './GameContext';
import StatsSidebar from './components/StatsSidebar';
import { useLocation, Link, Routes, Route } from 'react-router-dom';
import { Baccarat } from './pages';
import Home from './pages/Home';
import SelectGame from './pages/SelectGame';
import BlackjackPage from './pages/BlackjackPage';

export default function AppRouter() {
  const { chips, showStats, setShowStats } = useGame();
  const location = useLocation();
  let game = '';
  if (location.pathname.startsWith('/blackjack')) game = 'blackjack';
  if (location.pathname.startsWith('/baccarat')) game = 'baccarat';

  return (
    <div className="app-background" style={{ padding: '8px 20px 0 20px', marginRight: showStats ? 270 : 0, minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
        <h1 className="casino-title" style={{ margin: 0, fontSize: 44, lineHeight: 1.1, textAlign: 'left' }}>Pranav's Casino</h1>
      </header>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, marginTop: 0 }}>
        <nav>
          <Link to="/" style={{ color: location.pathname === '/' ? '#1976d2' : '#90caf9', marginRight: 16, textDecoration: 'none', fontWeight: location.pathname === '/' ? 700 : 500 }}>Home</Link>
          <Link to="/blackjack" style={{ color: location.pathname.startsWith('/blackjack') ? '#1976d2' : '#90caf9', marginRight: 16, textDecoration: 'none', fontWeight: location.pathname.startsWith('/blackjack') ? 700 : 500 }}>Blackjack</Link>
          <Link to="/baccarat" style={{ color: location.pathname.startsWith('/baccarat') ? '#1976d2' : '#90caf9', marginRight: 16, textDecoration: 'none', fontWeight: location.pathname.startsWith('/baccarat') ? 700 : 500 }}>Baccarat</Link>
        </nav>
        <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
          Chips: {chips}
          <button style={{ marginLeft: 16 }} onClick={() => setShowStats(s => !s)}>
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/select-game" element={<SelectGame />} />
        <Route path="/blackjack" element={<BlackjackPage />} />
        <Route path="/baccarat" element={<Baccarat />} />
      </Routes>
      {game && <StatsSidebar game={game} />}
    </div>
  );
}
