import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shuffle, createDeck } from '../utils/deck';
import { useGame } from '../GameContext';
import Card from '../components/Card';

export default function BlackjackPage() {
  // For insurance: track if we are in the insurance decision phase
  const [insurancePhase, setInsurancePhase] = useState(false);
  const [insuranceChoices, setInsuranceChoices] = useState([]); // temp storage for insurance decisions
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
  // handInProgress: true = hand is being played, false = before first deal or after New Hand is clicked
  // controlsEnabled: true = can change numHands and click Deal, false = locked out (during or after hand until New Hand)
  const [handInProgress, setHandInProgress] = useState(false);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [activeHand, setActiveHand] = useState(0);
  // (removed duplicate bets/setBets declaration)
  const [status, setStatus] = useState("");
  const [gameOver, setGameOver] = useState(false);
  // Always 7 hand boxes, only play hands with a bet > 0
  const NUM_HANDS = 7;
  const [bets, setBets] = useState(Array(NUM_HANDS).fill(0));
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
    // Only play hands with a bet > 0
    const playIndexes = bets.map((b, i) => b > 0 ? i : -1).filter(i => i !== -1);
    if (playIndexes.length === 0) {
      setStatus('Place a bet on at least one hand.');
      return;
    }
    let newDeck = [...deck];
    if (newDeck.length < 20) newDeck = shuffle(createDeck(6));
    setDealing(true);
    setHandInProgress(true);
    setControlsEnabled(false);
    // Prepare only the hands being played
    let newHands = playIndexes.map(() => []);
    let newDealer = [];
    setHands(newHands);
    setDealer(newDealer);
    setActiveHand(0);
    setStatus("");
    setGameOver(false);
    setInsurance(Array(newHands.length).fill(null));
    setSurrendered(Array(newHands.length).fill(false));
    // Deal cards one by one: player1, player2..., dealer1, player1, player2..., dealer2
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < newHands.length; i++) {
        await new Promise(res => setTimeout(res, 600));
        newHands = newHands.map((h, j) => j === i ? [...h, newDeck.pop()] : h);
        setHands([...newHands]);
      }
      await new Promise(res => setTimeout(res, 600));
      newDealer = [...newDealer, newDeck.pop()];
      setDealer([...newDealer]);
    }
    setDeck(newDeck);
    // If dealer upcard is Ace, enter insurance phase for all hands
    if (newDealer[0] && newDealer[0].rank === 'A') {
      setInsurancePhase(true);
      setInsuranceChoices(Array(newHands.length).fill(null));
      setInsurance(Array(newHands.length).fill('offered'));
      setDealing(false);
      updateCounts([...newDealer, ...newHands.flat()], newDeck.length);
      return;
    } else {
      setInsurance(newHands.map(() => null));
      updateCounts([...newDealer, ...newHands.flat()], newDeck.length);
      setDealing(false);
    }
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
    if (gameOver || surrendered[activeHand] || insurancePhase) return;
    // Prevent double-click: if hand is already bust, do nothing
    const valueBefore = calculateHand(hands[activeHand]);
    if (valueBefore > 21) return;
    const newDeck = [...deck];
    const newHands = hands.map((h, i) => i === activeHand ? [...h, newDeck.pop()] : h);
    setHands(newHands);
    setDeck(newDeck);
    updateCounts([newHands[activeHand][newHands[activeHand].length - 1]], newDeck.length);
    const value = calculateHand(newHands[activeHand]);
    // Mark bust immediately and move to next hand
    if (value > 21) {
      setStatus(s => s + ` | Hand ${activeHand + 1} busts`);
      setTimeout(() => nextHand(), 0); // ensure UI disables actions before moving to next hand
    }
  }

  function stand() {
  if (gameOver || surrendered[activeHand] || insurancePhase) return;
  nextHand();
  }

  function double() {
  if (gameOver || chips < bets[activeHand] || surrendered[activeHand] || insurancePhase) return;
  // Only allow double if player has enough chips, but do NOT spend chips here; just increase the bet
  // The chips were already spent when the bet was placed
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
  if (gameOver || hands[activeHand].length > 2 || surrendered[activeHand] || insurancePhase) return;
  setSurrendered(arr => arr.map((v, i) => i === activeHand ? true : v));
  setStatus(s => s + ` | Hand ${activeHand + 1} surrendered`);
  addChips(bets[activeHand] / 2);
  nextHand();
  }

  function split() {
    if (gameOver) return;
    const hand = hands[activeHand];
    if (
      hand.length === 2 &&
      hand[0].rank === hand[1].rank &&
      chips >= bets[activeHand]
    ) {
      spendChips(bets[activeHand]);
      const newDeck = [...deck];
      const newHands = [...hands];
      // Each split hand gets a new card
      newHands[activeHand] = [hand[0], newDeck.pop()];
      newHands.splice(activeHand + 1, 0, [hand[1], newDeck.pop()]);
      const newBets = [...bets];
      newBets.splice(activeHand + 1, 0, bets[activeHand]);
      // Also update insurance and surrendered arrays for new hand
      const newInsurance = [...insurance];
      newInsurance.splice(activeHand + 1, 0, null);
      const newSurrendered = [...surrendered];
      newSurrendered.splice(activeHand + 1, 0, false);
      setHands(newHands);
      setBets(newBets);
      setDeck(newDeck);
      setInsurance(newInsurance);
      setSurrendered(newSurrendered);
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

    for (let i = 0; i < hands.length; i++) {
      let payout = 0;
      let profit = 0;
      let result = "";
      const hand = hands[i];
      const playerValue = calculateHand(hand);
      const playerHasBlackjack = isBlackjack(hand);
      const bet = bets[i]; // always use the current bet (handles double down)
      // Surrender
      if (surrendered[i]) {
        payout = bet / 2;
        profit = -bet / 2;
        result = "Surrendered";
        handProfits.push(profit);
        results.push(result);
        totalNet += profit;
        // Pay out half the bet for surrender
        if (payout > 0) addChips(payout);
        continue;
      }
      // Insurance
      if (insurance[i] === 'taken') {
        if (dealerHasBlackjack) {
          // Insurance pays 2:1 on half bet
          addChips(bet);
          profit += bet / 2;
          result += "Insurance win. ";
        } else {
          profit -= bet / 2;
          result += "Insurance lose. ";
        }
      }
      // Player busts always lose (bet already deducted)
      if (playerValue > 21) {
        profit = -bet;
        result += "Bust!";
        handProfits.push(profit);
        results.push(result);
        totalNet += profit;
        continue;
      }
      // Player blackjack
      if (playerHasBlackjack && !dealerHasBlackjack) {
        payout = bet * 2.5;
        profit = bet * 1.5;
        result += "Blackjack!";
      } else if (playerHasBlackjack && dealerHasBlackjack) {
        payout = bet;
        // profit = 0
        result += "Push!";
      } else if (dealerHasBlackjack && !playerHasBlackjack) {
        profit = -bet;
        result += "Lose!";
      } else if (dealerValue > 21) {
        // Dealer busts, player wins if not bust (already checked above)
        payout = bet * 2;
        profit = bet;
        result += "Win!";
      } else if (playerValue > dealerValue) {
        payout = bet * 2;
        profit = bet;
        result += "Win!";
      } else if (playerValue < dealerValue) {
        profit = -bet;
        result += "Lose!";
      } else {
        payout = bet;
        // profit = 0
        result += "Push!";
      }
      handProfits.push(profit);
      results.push(result);
      totalNet += profit;
      // Pay out only for hands that win or push (bet + profit)
      if (payout > 0) addChips(payout);
    }
    setStatus(totalNet === 0 ? 'Push!' : (totalNet > 0 ? `+${totalNet}` : `${totalNet}`));
    setGameOver(true);
    setHandProfits(handProfits);
    setHandInProgress(false);
    // Do NOT clear hands/dealer here; keep them until New Hand is clicked
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
        {/* No number of hands input, always show 7 hand boxes */}
        <button
          onClick={startGame}
          disabled={!controlsEnabled || dealing}
          style={{ marginLeft: 10, background: '#ffd700', color: '#222', fontWeight: 700, border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 18, boxShadow: '0 2px 8px #0002', opacity: !controlsEnabled || dealing ? 0.5 : 1 }}
        >
          Deal
        </button>
        {gameOver && (
          <button
            onClick={() => {
              setHands([]);
              setDealer([]);
              setAnimatedDealer([]);
              setDealerDrawing(false);
              setDealing(false);
              setActiveHand(0);
              setStatus("");
              setGameOver(false);
              setInsurance(Array(NUM_HANDS).fill(null));
              setSurrendered(Array(NUM_HANDS).fill(false));
              setHandProfits([]);
              setBets(Array(NUM_HANDS).fill(0));
              setHandInProgress(false);
              setControlsEnabled(true);
            }}
            style={{ marginLeft: 16, background: '#fff', color: '#222', fontWeight: 700, border: '1.5px solid #888', borderRadius: 8, padding: '8px 24px', fontSize: 16 }}
          >
            New Hand
          </button>
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
          {/* Only show 7 empty hand boxes if not in a round and not gameOver */}
          {(!gameOver && hands.length === 0) ? (
            Array(NUM_HANDS).fill().map((_, i) => (
              <div
                key={i}
                onClick={() => (!dealing) ? addChipToHandBet(i) : undefined}
                onContextMenu={e => { if (!dealing) { e.preventDefault(); clearHandBet(i); } }}
                style={{
                  margin: '0 8px 32px 8px',
                  maxHeight: 220,
                  overflow: 'visible',
                  border: '1px solid #ccc',
                  borderRadius: 12,
                  padding: 8,
                  background: '#f9f9f9',
                  minWidth: 120,
                  minHeight: 120,
                  color: '#222',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  cursor: !dealing ? 'pointer' : 'default',
                  position: 'relative',
                }}
              >
                <h3 style={{ fontSize: 16, margin: 0, marginBottom: 4, textAlign: 'center' }}>
                  Hand {i + 1}
                </h3>
                <div style={{ width: '100%', textAlign: 'center', margin: '2px 0 6px 0', fontWeight: 700, color: '#111', fontSize: 17, minHeight: 22 }}>
                  {bets[i] > 0 && `Bet: ${bets[i]}`}
                  {bets[i] > 0 && (
                    <button onClick={e => { e.stopPropagation(); clearHandBet(i); }} style={{ marginTop: 4, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 10px', fontWeight: 600, fontSize: 14 }}>Return</button>
                  )}
                </div>
              </div>
            ))
          ) : (
            // Show only the played hands/results after deal or game over
            hands.map((hand, j) => {
              // Find the original hand index (for bet display)
              const playIndexes = bets.map((b, idx) => b > 0 ? idx : -1).filter(idx => idx !== -1);
              const i = playIndexes[j];
              const handDealt = hand && hand.length > 0;
              return (
                <div
                  key={i}
                  style={{
                    margin: '0 8px 32px 8px',
                    maxHeight: 220,
                    overflow: 'visible',
                    border: j === activeHand && !gameOver ? '2px solid #007bff' : '1px solid #ccc',
                    borderRadius: 12,
                    padding: 8,
                    background: j === activeHand && !gameOver ? '#e6f0ff' : '#f9f9f9',
                    minWidth: 120,
                    minHeight: 120,
                    color: '#222',
                    boxShadow: j === activeHand && !gameOver ? '0 0 12px #007bff44' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    position: 'relative',
                  }}
                >
                  <h3 style={{ fontSize: 16, margin: 0, marginBottom: 4, textAlign: 'center' }}>
                    Hand {i + 1} {handDealt ? `(${calculateHand(hand)})` : ''} {handDealt && isBlackjack(hand) && 'Blackjack!'}
                  </h3>
                  <div style={{ width: '100%', textAlign: 'center', margin: '2px 0 6px 0', fontWeight: 700, color: '#111', fontSize: 17, minHeight: 22 }}>
                    {bets[i] > 0 && `Bet: ${bets[i]}`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 36, marginBottom: 4 }}>
                    {handDealt && hand.map((c, k) => <Card key={k} rank={c.rank} suit={c.suit} size="small" />)}
                  </div>
                  {/* Action buttons only after cards are dealt and not game over */}
                  {!gameOver && j === activeHand && !surrendered[j] && !insurancePhase && (
                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, maxHeight: 80, overflowY: 'auto', width: '100%' }}>
                      {hand && hand.length === 2 && (
                        <button onClick={surrender}>Surrender</button>
                      )}
                      <button onClick={hit}>Hit</button>
                      <button onClick={stand}>Stand</button>
                      {hand && hand.length === 2 && (
                        <button onClick={double}>Double</button>
                      )}
                      {hand && hand.length === 2 && hand[0].rank === hand[1].rank && (
                        <button onClick={split}>Split</button>
                      )}
                    </div>
                  )}
                  {/* Surrendered label */}
                  {surrendered[j] && <span style={{ color: '#e60026', marginTop: 6 }}>Surrendered</span>}
                  {/* Show profit/loss after game over */}
                  {gameOver && handProfits[i] !== undefined && (
                    <span style={{ color: handProfits[i] > 0 ? '#4caf50' : handProfits[i] < 0 ? '#e60026' : '#888', fontWeight: 700, marginTop: 4 }}>
                      {handProfits[i] > 0 ? '+' : ''}{handProfits[i]}
                    </span>
                  )}
                </div>
              );
            })
          )}

      {/* Chip tray at bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, zIndex: 10 }}>
        {chipValues.map((val, i) => (
          <button
            key={val}
            onClick={() => chips >= val && setSelectedChip(val)}
            disabled={chips < val}
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              border: selectedChip === val ? '4px solid #ffd700' : '2px solid #888',
              background: chipColors[i],
              color: i === 0 ? '#222' : '#fff',
              fontWeight: 900,
              fontSize: val >= 10000 ? 15 : val >= 1000 ? 17 : 20,
              boxShadow: selectedChip === val ? '0 0 16px #ffd70088' : '0 2px 8px #0002',
              outline: 'none',
              cursor: chips < val ? 'not-allowed' : 'pointer',
              opacity: chips < val ? 0.5 : 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              overflow: 'hidden',
              textAlign: 'center',
              lineHeight: '54px',
              letterSpacing: val >= 10000 ? '-1px' : 0
            }}
          >
            <span style={{ width: '100%', textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 900, fontSize: val >= 10000 ? 15 : val >= 1000 ? 17 : 20, lineHeight: '54px' }}>{val >= 1000 ? (val/1000)+'K' : val}</span>
          </button>
        ))}
      </div>
        </div>
      </div>
  <h3 style={{ color: status.startsWith('+') ? '#4caf50' : status.startsWith('-') ? '#e60026' : '#fff', marginTop: 32, fontWeight: 700, fontSize: 28 }}>{status}</h3>
    </div>
  );
}
