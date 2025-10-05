import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shuffle, createDeck } from '../utils/deck';
import { useGame } from '../GameContext';
import Card from '../components/Card';

export default function BlackjackPage() {
  const navigate = useNavigate();
  // ...existing code...
  function getCardValue(card) {
    if (card.rank === "A") return 11;
    if (["K", "Q", "J"].includes(card.rank)) return 10;
    return parseInt(card.rank);
  }

  function calculateHand(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
      value += getCardValue(card);
      if (card.rank === "A") aces++;
    }
    while (value > 21 && aces) {
      value -= 10;
      aces--;
    }
    return value;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && calculateHand(hand) === 21;
  }

  const [deck, setDeck] = useState(shuffle(createDeck(6)));
  const [hands, setHands] = useState([]); // Array of player hands
  const [dealer, setDealer] = useState([]);
  const [animatedDealer, setAnimatedDealer] = useState([]); // For animation
  const [dealerDrawing, setDealerDrawing] = useState(false);
  const [dealing, setDealing] = useState(false); // Animation state
  const [activeHand, setActiveHand] = useState(0);
  // (removed duplicate bets/setBets declaration)
  const [status, setStatus] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [numHands, setNumHands] = useState(1);
  // Each hand has its own bet amount
  const [bets, setBets] = useState([0]);
  // Chip selection state
  const chipValues = [1, 5, 25, 100, 1000, 5000, 25000];
  const chipColors = ['#fff', '#d32f2f', '#388e3c', '#222', '#ff9800', '#ffd600', '#8e24aa'];
  const [selectedChip, setSelectedChip] = useState(100);
  const [showRefill, setShowRefill] = useState(false);
  const [insurance, setInsurance] = useState([]); // insurance[i]: null | 'offered' | 'taken' | 'declined'
  const [surrendered, setSurrendered] = useState([]); // surrendered[i]: true/false
  const { chips, spendChips, addChips, blackjackStats, setBlackjackStats } = useGame();

  function cardCountValue(card) {
    if (["2", "3", "4", "5", "6"].includes(card.rank)) return 1;
    if (["10", "J", "Q", "K", "A"].includes(card.rank)) return -1;
    return 0;
  }

  function updateCounts(newCards, deckSize) {
    setBlackjackStats(stats => {
      const runningCount = stats.runningCount + newCards.reduce((acc, c) => acc + cardCountValue(c), 0);
      const trueCount = deckSize > 0 ? Math.round(runningCount / (deckSize / 52)) : runningCount;
      return { ...stats, runningCount, trueCount };
    });
  }

  async function startGame() {
    // Must have a bet on every hand
    if (bets.length !== numHands || bets.some(b => b <= 0)) {
      setStatus('Place a bet for every hand.');
      return;
    }
    const totalBet = bets.reduce((a, b) => a + b, 0);
    if (chips < totalBet) {
      setShowRefill(true);
      return;
    }
    let newDeck = [...deck];
    if (newDeck.length < 20) newDeck = shuffle(createDeck(6));
    spendChips(totalBet);
    setDealing(true);
    // Prepare empty hands and dealer
    let newHands = Array(numHands).fill().map(() => []);
    let newDealer = [];
    setHands(newHands);
    setDealer(newDealer);
    setActiveHand(0);
    setStatus("");
    setGameOver(false);
    setInsurance(Array(numHands).fill(null));
    setSurrendered(Array(numHands).fill(false));
    // Deal cards one by one: player1, player2..., dealer1, player1, player2..., dealer2
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < numHands; i++) {
        await new Promise(res => setTimeout(res, 600));
        newHands = newHands.map((h, j) => j === i ? [...h, newDeck.pop()] : h);
        setHands([...newHands]);
      }
      await new Promise(res => setTimeout(res, 600));
      newDealer = [...newDealer, newDeck.pop()];
      setDealer([...newDealer]);
    }
    setDeck(newDeck);
    setInsurance(newHands.map(() => newDealer[0].rank === 'A' ? 'offered' : null));
    updateCounts([...newDealer, ...newHands.flat()], newDeck.length);
    setDealing(false);
    // Do NOT end game if any hand has blackjack; let all hands play out
  }

  // Add chip to a hand's bet (before deal)
  function addChipToHandBet(i) {
    if (hands.length > 0 || dealing) return; // Only before deal
    if (chips < selectedChip) {
      setShowRefill(true);
      return;
    }
    setBets(b => b.map((amt, j) => j === i ? amt + selectedChip : amt));
    spendChips(selectedChip);
  }
  // Remove all chips from a hand's bet (right-click)
  function clearHandBet(i) {
    if (hands.length > 0 || dealing) return;
    if (bets[i] > 0) {
      addChips(bets[i]);
      setBets(b => b.map((amt, j) => j === i ? 0 : amt));
    }
  }

  function hit() {
    if (gameOver || surrendered[activeHand]) return;
    const newDeck = [...deck];
    const newHands = hands.map((h, i) => i === activeHand ? [...h, newDeck.pop()] : h);
    setHands(newHands);
    setDeck(newDeck);
    updateCounts([newHands[activeHand][newHands[activeHand].length - 1]], newDeck.length);
    const value = calculateHand(newHands[activeHand]);
    if (value > 21) {
      nextHand();
    }
  }

  function stand() {
    if (gameOver || surrendered[activeHand]) return;
    nextHand();
  }

  function double() {
    if (gameOver || chips < bets[activeHand] || surrendered[activeHand]) return;
    spendChips(bets[activeHand]);
    const newBets = bets.map((b, i) => i === activeHand ? b * 2 : b);
    setBets(newBets);
    hit();
    nextHand();
  }

  function takeInsurance() {
    if (insurance[activeHand] !== 'offered' || chips < bets[activeHand] / 2) return;
    spendChips(bets[activeHand] / 2);
    setInsurance(ins => ins.map((v, i) => i === activeHand ? 'taken' : v));
  }

  function declineInsurance() {
    if (insurance[activeHand] !== 'offered') return;
    setInsurance(ins => ins.map((v, i) => i === activeHand ? 'declined' : v));
  }

  function surrender() {
    if (gameOver || hands[activeHand].length > 2 || surrendered[activeHand]) return;
    setSurrendered(arr => arr.map((v, i) => i === activeHand ? true : v));
    setStatus(s => s + ` | Hand ${activeHand + 1} surrendered`);
    addChips(bets[activeHand] / 2);
    nextHand();
  }

  function split() {
    if (gameOver) return;
    const hand = hands[activeHand];
    if (hand.length === 2 && hand[0].rank === hand[1].rank && chips >= bets[activeHand]) {
      spendChips(bets[activeHand]);
      const newHands = [...hands];
      newHands[activeHand] = [hand[0], deck.pop()];
      newHands.splice(activeHand + 1, 0, [hand[1], deck.pop()]);
      const newBets = [...bets];
      newBets.splice(activeHand + 1, 0, bets[activeHand]);
      setHands(newHands);
      setBets(newBets);
      setDeck(deck);
    }
  }

  function nextHand() {
    if (activeHand < hands.length - 1) {
      setActiveHand(activeHand + 1);
    } else {
      finishGame();
    }
  }

  async function finishGame() {
    // Only draw for dealer if at least one hand is not bust or surrendered
    const handResults = hands.map((hand, i) => {
      if (surrendered[i]) return 'surrendered';
      const playerValue = calculateHand(hand);
      return playerValue > 21 ? 'bust' : 'active';
    });
    const anyActive = handResults.some(r => r === 'active');
    let newDeck = [...deck];
    let newDealer = [...dealer];
    let drawn = [];
    if (anyActive) {
      setDealerDrawing(true);
      setAnimatedDealer([...newDealer]);
      while (calculateHand(newDealer) < 17) {
        await new Promise(res => setTimeout(res, 800));
        const card = newDeck.pop();
        newDealer.push(card);
        drawn.push(card);
        setAnimatedDealer([...newDealer]);
      }
      await new Promise(res => setTimeout(res, 800));
      setDealerDrawing(false);
      setDealer([...newDealer]);
    } else {
      setDealer([...newDealer]);
    }
    setDeck(newDeck);
    updateCounts(drawn, newDeck.length);

    let results = [];
    let handProfits = [];
    let totalNet = 0;
    const dealerValue = calculateHand(newDealer);
    const dealerHasBlackjack = isBlackjack(newDealer);

    hands.forEach((hand, i) => {
      let profit = 0;
      let result = "";
      const playerValue = calculateHand(hand);
      const playerHasBlackjack = isBlackjack(hand);
      // Surrender
      if (surrendered[i]) {
        profit = -bets[i] / 2;
        result = "Surrendered";
        handProfits.push(profit);
        results.push(result);
        totalNet += profit;
        return;
      }
      // Insurance
      if (insurance[i] === 'taken') {
        if (dealerHasBlackjack) {
          // Insurance pays 2:1 on half bet
          profit += bets[i];
          result += "Insurance win. ";
        } else {
          profit -= bets[i] / 2;
          result += "Insurance lose. ";
        }
      }
      // Player blackjack
      if (playerHasBlackjack && !dealerHasBlackjack) {
        // Blackjack pays 3:2, bet is already spent
        profit += bets[i] * 1.5;
        result += "Blackjack!";
      } else if (playerHasBlackjack && dealerHasBlackjack) {
        // Both have blackjack: push
        result += "Push!";
        // profit = 0
      } else if (dealerHasBlackjack && !playerHasBlackjack) {
        // Dealer blackjack, player loses
        profit -= bets[i];
        result += "Lose!";
      } else if (playerValue > 21) {
        // Player busts
        profit -= bets[i];
        result += "Bust!";
      } else if (dealerValue > 21) {
        // Dealer busts, player wins if not bust
        profit += bets[i];
        result += "Win!";
      } else if (playerValue > dealerValue) {
        profit += bets[i];
        result += "Win!";
      } else if (playerValue < dealerValue) {
        profit -= bets[i];
        result += "Lose!";
      } else {
        result += "Push!";
        // profit = 0
      }
      handProfits.push(profit);
      results.push(result);
      totalNet += profit;
    });
    setStatus(results.join(" | "));
    setGameOver(true);
    if (totalNet !== 0) addChips(totalNet);
    setHandProfits(handProfits);
  }
  // Track per-hand profit for display
  const [handProfits, setHandProfits] = useState([]);

  function handleRefill(amount) {
    addChips(amount);
    setShowRefill(false);
  }

  return (
    <div style={{
      background: 'linear-gradient(180deg, #1e2a38 60%, #0d1a26 100%)',
      borderRadius: 32,
      padding: '2.5vh 2vw 110px 2vw', // extra bottom padding for chip tray
      width: '80vw',
      minWidth: 900,
      maxWidth: 1200,
      minHeight: 600,
      margin: '4vh auto 0 auto',
      overflow: 'visible',
      boxShadow: '0 4px 32px #0004',
      color: '#fff',
      fontFamily: 'serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      position: 'relative',
    }}>
      <h2 style={{ textAlign: 'center', letterSpacing: 2, fontWeight: 700 }}>Blackjack</h2>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
        <label>Number of Hands: </label>
            <input type="number" min={1} max={7} value={numHands} disabled={hands.length > 0 && !gameOver} onChange={e => {
            if (hands.length > 0 && !gameOver) return;
            const n = Number(e.target.value);
            setNumHands(n);
            setBets(b => Array(n).fill(0));
            }} style={{ width: 40, borderRadius: 6, border: '1px solid #888', padding: 4 }} />
            <button onClick={startGame} disabled={dealing || (hands.length > 0 && !gameOver)} style={{ marginLeft: 10, background: '#ffd700', color: '#222', fontWeight: 700, border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 18, boxShadow: '0 2px 8px #0002', opacity: dealing ? 0.5 : 1 }}>Deal</button>
        {gameOver && (
          <button onClick={() => {
            setHands([]);
            setDealer([]);
            setAnimatedDealer([]);
            setDealerDrawing(false);
            setDealing(false);
            setActiveHand(0);
            setStatus("");
            setGameOver(false);
            setInsurance(Array(numHands).fill(null));
            setSurrendered(Array(numHands).fill(false));
            setHandProfits([]);
            setBets(Array(numHands).fill(0));
          }} style={{ marginLeft: 16, background: '#fff', color: '#222', fontWeight: 700, border: '1.5px solid #888', borderRadius: 8, padding: '8px 24px', fontSize: 16 }}>New Hand</button>
        )}
      </div>
      {showRefill && (
        <div style={{ marginBottom: 10, textAlign: 'center' }}>
          <span style={{ color: 'red' }}>Not enough chips!</span>
          <br />
          <button onClick={() => handleRefill(10000)} style={{ margin: 8 }}>Add 10,000 Chips</button>
          <button onClick={() => handleRefill(50000)} style={{ margin: 8 }}>Add 50,000 Chips</button>
        </div>
      )}
      <div style={{ marginTop: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3>Dealer Hand ({gameOver || dealerDrawing ? calculateHand(dealerDrawing ? animatedDealer : dealer) : dealer[0] ? getCardValue(dealer[0]) + ' + ?' : ''})</h3>
        <div style={{ marginBottom: 32 }}>
          {(dealerDrawing ? animatedDealer : dealer).map((c, i) => {
            // Always show correct card, never fake a 4 for Ace
            return (gameOver || dealerDrawing || i === 0 ? <Card key={i} rank={c.rank} suit={c.suit} size="small" /> : <span key={i} style={{ width: 48, height: 72, display: 'inline-block', background: '#888', borderRadius: 8, margin: 2 }}></span>);
          })}
        </div>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 0, marginTop: 0 }}>
          {Array(numHands).fill().map((_, i) => {
            // Wide, slight U curve: use a shallow parabola
            const n = numHands - 1;
            const t = n === 0 ? 0.5 : i / n;
            const arc = 32 * (4 * (t - 0.5) * (t - 0.5) - 1);
            const handDealt = hands[i] && hands[i].length > 0;
            return (
              <div
                key={i}
                onClick={() => (!handDealt && !dealing) ? addChipToHandBet(i) : undefined}
                onContextMenu={e => { if (!handDealt && !dealing) { e.preventDefault(); clearHandBet(i); } }}
                style={{
                  margin: '0 8px 32px 8px', // extra bottom margin for hand boxes
                  maxHeight: 220, // prevent hand box from growing too tall
                  overflow: 'visible',
                  border: i === activeHand ? '2px solid #007bff' : '1px solid #ccc',
                  borderRadius: 12,
                  padding: 8,
                  background: i === activeHand ? '#e6f0ff' : '#f9f9f9',
                  minWidth: 120,
                  minHeight: 120,
                  color: '#222',
                  boxShadow: i === activeHand ? '0 0 12px #007bff44' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  cursor: !handDealt && !dealing ? 'pointer' : 'default',
                  position: 'relative',
                }}
              >
                <h3 style={{ fontSize: 16, margin: 0, marginBottom: 4, textAlign: 'center' }}>
                  Hand {i + 1} {handDealt ? `(${calculateHand(hands[i])})` : ''} {handDealt && isBlackjack(hands[i]) && 'Blackjack!'}
                </h3>
                {/* Bet text always inside the box, centered below hand title */}
                <div style={{ width: '100%', textAlign: 'center', margin: '2px 0 6px 0', fontWeight: 700, color: '#111', fontSize: 17, minHeight: 22 }}>
                  {bets[i] > 0 && `Bet: ${bets[i]}`}
                  {/* Return button for bet removal before deal */}
                  {!handDealt && bets[i] > 0 && (
                    <button onClick={e => { e.stopPropagation(); clearHandBet(i); }} style={{ marginTop: 4, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 10px', fontWeight: 600, fontSize: 14 }}>Return</button>
                  )}
                </div>
                {/* Cards row */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 36, marginBottom: 4 }}>
                  {handDealt && hands[i].map((c, j) => <Card key={j} rank={c.rank} suit={c.suit} size="small" />)}
                </div>
                {/* Action buttons only after cards are dealt */}
                {handDealt && i === activeHand && !gameOver && !surrendered[i] && (
                  <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, maxHeight: 80, overflowY: 'auto', width: '100%' }}>
                    {/* Insurance button if dealer upcard is Ace and insurance not yet taken/declined */}
                    {insurance[i] === 'offered' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={takeInsurance}>Insurance</button>
                        <button onClick={declineInsurance}>No Insurance</button>
                      </div>
                    )}
                    {/* Surrender button only on first action */}
                    {hands[i] && hands[i].length === 2 && (
                      <button onClick={surrender}>Surrender</button>
                    )}
                    <button onClick={hit}>Hit</button>
                    <button onClick={stand}>Stand</button>
                    {/* Double only if hand has exactly 2 cards and no hit/stand/double/split has been taken */}
                    {hands[i] && hands[i].length === 2 && (
                      <button onClick={double}>Double</button>
                    )}
                    {/* Split only if hand has exactly 2 cards of same rank */}
                    {hands[i] && hands[i].length === 2 && hands[i][0].rank === hands[i][1].rank && (
                      <button onClick={split}>Split</button>
                    )}
                  </div>
                )}
                {/* Surrendered label */}
                {surrendered[i] && <span style={{ color: '#e60026', marginTop: 6 }}>Surrendered</span>}
                {/* Show profit/loss after game over */}
                {gameOver && handProfits[i] !== undefined && (
                  <span style={{ color: handProfits[i] > 0 ? '#4caf50' : handProfits[i] < 0 ? '#e60026' : '#888', fontWeight: 700, marginTop: 4 }}>
                    {handProfits[i] > 0 ? '+' : ''}{handProfits[i]}
                  </span>
                )}
              </div>
            );
          })}

      {/* Chip tray at bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, zIndex: 10 }}>
        {chipValues.map((val, i) => (
          <button key={val} onClick={() => setSelectedChip(val)} style={{
            width: 54, height: 54, borderRadius: '50%', border: selectedChip === val ? '4px solid #ffd700' : '2px solid #888',
            background: chipColors[i], color: i === 0 ? '#222' : '#fff', fontWeight: 900, fontSize: val >= 10000 ? 15 : val >= 1000 ? 17 : 20, boxShadow: selectedChip === val ? '0 0 16px #ffd70088' : '0 2px 8px #0002', outline: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden', textAlign: 'center', lineHeight: '54px', letterSpacing: val >= 10000 ? '-1px' : 0
          }}>
            <span style={{ width: '100%', textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 900, fontSize: val >= 10000 ? 15 : val >= 1000 ? 17 : 20, lineHeight: '54px' }}>{val >= 1000 ? (val/1000)+'K' : val}</span>
          </button>
        ))}
      </div>
        </div>
      </div>
      <h3 style={{ color: 'red', marginTop: 32 }}>{status}</h3>
    </div>
  );
}
