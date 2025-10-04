


import { BrowserRouter as Router } from 'react-router-dom';
import { GameProvider } from './GameContext';
import AppRouter from './router';

export default function App() {
  return (
    <GameProvider>
      <Router>
        <AppRouter />
      </Router>
    </GameProvider>
  );
}
