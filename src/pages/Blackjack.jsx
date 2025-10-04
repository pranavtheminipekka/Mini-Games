import React, { useState } from 'react';
import { createDeck, shuffle } from '../utils/deck';
import { useGame } from '../GameContext';
import Card from '../components/Card';

function getCardValue(card) {
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function calculateHand(hand) {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    value += getCardValue(card);
    if (card.rank === 'A') aces++;
  }
  while (value > 21 && aces) {
    value -= 10;
    aces--;
  }
  return value;
}

export default function Blackjack() {
  const [deck, setDeck] = useState([]);
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [status, setStatus] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [bet, setBet] = useState(100);
  const [showRefill, setShowRefill] = useState(false);
  const { chips, spendChips, addChips, blackjackStats, setBlackjackStats } = useGame();

  function cardCountValue(card) {
    if (['2', '3', '4', '5', '6'].includes(card.rank)) return 1;
    if (['10', 'J', 'Q', 'K', 'A'].includes(card.rank)) return -1;
    return 0;
  }

  function updateCounts(newCards, deckSize) {
    setBlackjackStats(stats => {
      const runningCount = stats.runningCount + newCards.reduce((acc, c) => acc + cardCountValue(c), 0);
      const trueCount = deckSize > 0 ? Math.round(runningCount / (deckSize / 52)) : runningCount;
      return { ...stats, runningCount, trueCount };
    });
  }

  function startGame() {
    if (chips < bet) {
      setShowRefill(true);
      return;
    }
    spendChips(bet);
    const newDeck = shuffle(createDeck());
    const playerCards = [newDeck.pop(), newDeck.pop()];
    const dealerCards = [newDeck.pop(), newDeck.pop()];
    setPlayer(playerCards);
    setDealer(dealerCards);
    setDeck(newDeck);
    setStatus('');
    setGameOver(false);
    updateCounts([...playerCards, ...dealerCards], newDeck.length);
  }

  function hit() {
    if (gameOver) return;
    const newDeck = [...deck];
    const newCard = newDeck.pop();
    const newPlayer = [...player, newCard];
    setPlayer(newPlayer);
    setDeck(newDeck);
    updateCounts([newCard], newDeck.length);
    const value = calculateHand(newPlayer);
    if (value > 21) {
      setStatus('Bust! You lose.');
      setGameOver(true);
    }
  }

  function stand() {
    if (gameOver) return;
    let newDeck = [...deck];
    let newDealer = [...dealer];
    let drawn = [];
    while (calculateHand(newDealer) < 17) {
      const card = newDeck.pop();
      newDealer.push(card);
      drawn.push(card);
    }
    setDealer(newDealer);
    setDeck(newDeck);
    updateCounts(drawn, newDeck.length);
    const playerValue = calculateHand(player);
    const dealerValue = calculateHand(newDealer);
    let result = '';
    if (dealerValue > 21 || playerValue > dealerValue) result = 'You win!';
    else if (playerValue < dealerValue) result = 'Dealer wins!';
    else result = 'Push!';
    setStatus(result);
    setGameOver(true);
  }

  function handleRefill(amount) {
    addChips(amount);
    setShowRefill(false);
  }

  return (
    <div>
      <h2>Blackjack</h2>
      <div style={{ marginBottom: 10 }}>
        <label>Bet Amount: </label>
        <input type="number" min="1" value={bet} onChange={e => setBet(Number(e.target.value))} style={{ width: 80 }} />
        <button onClick={startGame} disabled={!gameOver && player.length} style={{ marginLeft: 10 }}>Deal</button>
        <button onClick={hit} disabled={gameOver || !player.length} style={{ marginLeft: 10 }}>Hit</button>
        <button onClick={stand} disabled={gameOver || !player.length} style={{ marginLeft: 10 }}>Stand</button>
      </div>
      {showRefill && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: 'red' }}>Not enough chips!</span>
          <br />
          <button onClick={() => handleRefill(10000)}>Add 10,000 Chips</button>
          <button onClick={() => handleRefill(50000)} style={{ marginLeft: 10 }}>Add 50,000 Chips</button>
        </div>
      )}
      <div style={{ marginTop: 20 }}>
        <h3>Your Hand ({calculateHand(player)})</h3>
        <div>{player.map((c, i) => <Card key={i} rank={c.rank} suit={c.suit} />)}</div>
        <h3>Dealer Hand ({gameOver ? calculateHand(dealer) : dealer[0] ? getCardValue(dealer[0]) + ' + ?' : ''})</h3>
        <div>{dealer.map((c, i) => (gameOver || i === 0 ? <Card key={i} rank={c.rank} suit={c.suit} /> : <span key={i} style={{ width: 40, height: 60, display: 'inline-block', background: '#888', borderRadius: 6, margin: 2 }}></span>))}</div>
      </div>
      <h3 style={{ color: 'red' }}>{status}</h3>
    </div>
  );
}