import { useEffect } from 'react';
  // Clear all bets at once
  function clearAllBets() {
    Object.keys(bets).forEach(type => {
      if (bets[type] > 0) clearBet(type);
    });
  }

import Card from '../components/Card';
import React, { useState } from 'react';
import { shuffle, createDeck } from '../utils/deck';
import { useGame } from '../GameContext';


import { useNavigate } from 'react-router-dom';

export default function Baccarat() {
  // Track if a hand is in progress (cards on table or dealing)
  const [handInProgress, setHandInProgress] = useState(false);
  // Baccarat variant: 'commission' or 'evenMoney'
  const [variant, setVariant] = useState(null); // null until chosen
  function baccaratValue(card) {
    if (["K", "Q", "J", "10"].includes(card.rank)) return 0;
    if (card.rank === "A") return 1;
    return parseInt(card.rank);
  }

  function handValue(hand) {
    const sum = hand.reduce((acc, card) => acc + baccaratValue(card), 0);
    return sum % 10;
  }

  // Betting state: allow multiple bets
  const [deck, setDeck] = useState(shuffle(createDeck(6)));
  const [player, setPlayer] = useState([]);
  const [banker, setBanker] = useState([]);
  const [dealing, setDealing] = useState(false);
  const [result, setResult] = useState("");
  const [betAmount, setBetAmount] = useState(100);
  // Each bet is an amount, not a boolean
  const [bets, setBets] = useState({ player: 0, banker: 0, tie: 0, tigerTie: 0, bigTiger: 0, smallTiger: 0 });
  // Chip selection state
  const chipValues = [1, 5, 25, 100, 1000, 5000, 25000];
  const chipColors = ['#fff', '#d32f2f', '#388e3c', '#222', '#ff9800', '#ffd600', '#8e24aa'];
  const [selectedChip, setSelectedChip] = useState(100);
  const [showRefill, setShowRefill] = useState(false);
  const [lastWin, setLastWin] = useState(null); // true/false/null
  const { chips, spendChips, addChips, baccaratStats, setBaccaratStats } = useGame();
  const navigate = useNavigate();

  // Clear the table for a new hand
  function newHand() {
    setPlayer([]);
    setBanker([]);
    setResult("");
    setLastWin(null);
    setBets({ player: 0, banker: 0, tie: 0, tigerTie: 0, bigTiger: 0, smallTiger: 0 });
    setDealing(false);
  }

  // Add chip to bet
  function addChipToBet(type) {
    if (chips < selectedChip) {
      setShowRefill(true);
      return;
    }
    setBets(b => ({ ...b, [type]: b[type] + selectedChip }));
    spendChips(selectedChip);
  }
  // Remove all chips from a bet (right-click)
  function clearBet(type) {
    if (bets[type] > 0) {
      addChips(bets[type]);
      setBets(b => ({ ...b, [type]: 0 }));
    }
  }

  // Drawing rules for third card
  function shouldPlayerDraw(playerHand) {
    return handValue(playerHand) <= 5;
  }
  // Returns true if banker should draw, given both hands
  function shouldBankerDraw(bankerHand, playerHand, playerDrew, playerThirdCard) {
    const b = handValue(bankerHand);
    // If player did not draw, banker draws on 0-5, stands on 6-7
    if (!playerDrew) {
      if (b <= 5) return true;
      return false;
    }
    // If player drew, use standard table
    if (b <= 2) return true;
    if (b === 3) return playerThirdCard.rank !== "8";
    if (b === 4) return ["2","3","4","5","6","7"].includes(playerThirdCard.rank);
    if (b === 5) return ["4","5","6","7"].includes(playerThirdCard.rank);
    if (b === 6) return ["6","7"].includes(playerThirdCard.rank);
    return false;
  }

  async function deal() {
    setHandInProgress(true);
    if (!variant) {
      setResult("Please select a baccarat variant.");
      return;
    }
    // Calculate total bet
    const totalBet = Object.values(bets).reduce((sum, v) => sum + v, 0);
    if (totalBet === 0) {
      setResult("Please place at least one bet.");
      return;
    }
    if (chips < 0) { // Should never happen, but just in case
      setShowRefill(true);
      return;
    }
    let newDeck = [...deck];
    if (newDeck.length < 10) newDeck = shuffle(createDeck(6));
    setDealing(true);
    setPlayer([]);
    setBanker([]);
    let playerHand = [];
    let bankerHand = [];
    setPlayer([]);
    setBanker([]);
    // Deal 2 cards to player and banker, one by one
    for (let i = 0; i < 2; i++) {
      await new Promise(res => setTimeout(res, 700));
      playerHand.push(newDeck.pop());
      setPlayer([...playerHand]);
      await new Promise(res => setTimeout(res, 700));
      bankerHand.push(newDeck.pop());
      setBanker([...bankerHand]);
    }
    let playerThird = null;
    let bankerThird = null;
    const pVal0 = handValue(playerHand);
    const bVal0 = handValue(bankerHand);
    // Natural
    if (pVal0 >= 8 || bVal0 >= 8) {
      // Stand, no draw
    } else {
      // Player draws?
      if (shouldPlayerDraw(playerHand)) {
    await new Promise(res => setTimeout(res, 800));
        playerThird = newDeck.pop();
        playerHand.push(playerThird);
        setPlayer([...playerHand]);
      }
      // Banker draws?
      if (playerThird) {
        if (shouldBankerDraw(bankerHand, playerHand, true, playerThird)) {
          await new Promise(res => setTimeout(res, 800));
          bankerThird = newDeck.pop();
          bankerHand.push(bankerThird);
          setBanker([...bankerHand]);
        }
      } else {
        if (shouldBankerDraw(bankerHand, playerHand, false, null)) {
    await new Promise(res => setTimeout(res, 800));
          bankerThird = newDeck.pop();
          bankerHand.push(bankerThird);
          setBanker([...bankerHand]);
        }
      }
    }
    setDeck(newDeck);
  setDealing(false);
  // Do not clear player/banker here; require user to click New Hand to clear table and re-enable Deal
    const pVal = handValue(playerHand);
    const bVal = handValue(bankerHand);
  // Special outcomes
  const tigerTie = pVal === 6 && bVal === 6;
  // New tiger logic:
  // Big Tiger: Banker wins with 6, 3 cards
  const bigTiger = bVal > pVal && bVal === 6 && bankerHand.length === 3;
  // Small Tiger: Banker wins with 6, 2 cards
  const smallTiger = bVal > pVal && bVal === 6 && bankerHand.length === 2;

    // New chip-based betting system
    // betAmounts: { player: 0, banker: 0, tie: 0, tigerTie: 0, bigTiger: 0, smallTiger: 0 }
    // (UI and logic for chip selection will be added next)
    let outcome = [];
    let payout = 0;
    let win = false;
    // Player
    if (bets.player > 0) {
      if (pVal > bVal) {
        outcome.push("Player win");
        payout += bets.player * 2;
        win = true;
      } else if (pVal === bVal) {
        outcome.push("Player bet void (tie)");
        payout += bets.player;
      } else {
        outcome.push("Player lose");
      }
    }
    // Banker
    if (bets.banker > 0) {
      if (bVal > pVal) {
        outcome.push("Banker win");
        if (variant === 'commission') {
          payout += bets.banker + bets.banker * 0.95;
        } else {
          payout += bets.banker * 2;
        }
        win = true;
      } else if (pVal === bVal) {
        outcome.push("Banker bet void (tie)");
        payout += bets.banker;
      } else {
        outcome.push("Banker lose");
      }
    }
    // Tie
    if (bets.tie > 0) {
      if (pVal === bVal) { outcome.push("Tie win"); payout += bets.tie * 9; win = true; }
      else { outcome.push("Tie lose"); }
    }
    // Tiger Tie
    if (bets.tigerTie > 0) {
      if (tigerTie) { outcome.push("Tiger Tie win"); payout += bets.tigerTie * 20; win = true; }
      else { outcome.push("Tiger Tie lose"); }
    }
    // Big Tiger
    if (bets.bigTiger > 0) {
      if (bigTiger) { outcome.push("Big Tiger win"); payout += bets.bigTiger * 55; win = true; }
      else { outcome.push("Big Tiger lose"); }
    }
    // Small Tiger
    if (bets.smallTiger > 0) {
      if (smallTiger) { outcome.push("Small Tiger win"); payout += bets.smallTiger * 22; win = true; }
      else { outcome.push("Small Tiger lose"); }
    }
    if (payout > 0) addChips(payout);
    setResult(outcome.join(" | "));
    setLastWin(win);
    // Stats tracking
    setBaccaratStats(stats => {
      const history = [...stats.history, (pVal > bVal ? "Player" : bVal > pVal ? "Banker" : "Tie")];
      return {
        ...stats,
        history,
        player: stats.player + (pVal > bVal ? 1 : 0),
        banker: stats.banker + (bVal > pVal ? 1 : 0),
        tie: stats.tie + (pVal === bVal ? 1 : 0),
        naturals: stats.naturals + ((pVal0 >= 8 || bVal0 >= 8) ? 1 : 0),
        tigerTies: stats.tigerTies + (tigerTie ? 1 : 0),
        bigTigers: stats.bigTigers + (bigTiger ? 1 : 0),
        smallTigers: stats.smallTigers + (smallTiger ? 1 : 0),
      };
    });
  }

  function handleRefill(amount) {
    addChips(amount);
    setShowRefill(false);
  }


  // Baccarat table layout
  // If either player or banker has cards, hand is in progress
  useEffect(() => {
    // Hand is in progress ONLY if dealing or cards are on table
    if (dealing || (player.length > 0 || banker.length > 0)) {
      setHandInProgress(true);
    } else {
      setHandInProgress(false);
    }
  }, [dealing, player, banker]);

  return (
    <div style={{
      background: 'linear-gradient(180deg, #2e8b57 60%, #1b4d3e 100%)',
      borderRadius: 32,
      padding: '2.5vh 2vw',
      width: '80vw',
      minWidth: 900,
      maxWidth: 1200,
      minHeight: 600,
      height: 'auto',
      margin: '4vh auto 0 auto',
      boxShadow: '0 4px 32px #0004',
      color: '#fff',
      fontFamily: 'serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      position: 'relative',
    }}>
      <h2 style={{ textAlign: 'center', letterSpacing: 2, fontWeight: 700 }}>Baccarat</h2>

      {/* Variant selection UI */}
      {!variant && (
        <div style={{ margin: '24px 0', textAlign: 'center' }}>
          <h3 style={{ color: '#ffd700', marginBottom: 12 }}>Choose Baccarat Variant:</h3>
          <button onClick={() => setVariant('commission')} style={{ background: '#ffd700', color: '#222', fontWeight: 700, border: 'none', borderRadius: 12, padding: '12px 36px', fontSize: 22, marginRight: 24 }}>Commission (Banker win pays 0.95:1)</button>
          <button onClick={() => setVariant('evenMoney')} style={{ background: '#00bfff', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 12, padding: '12px 36px', fontSize: 22 }}>Even Money (Banker win pays 1:1)</button>
        </div>
      )}
      {variant && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 18, color: '#ffd700' }}>Variant: {variant === 'commission' ? 'Commission (Banker win 0.95:1)' : 'Even Money (Banker win 1:1)'}</span>
          <button onClick={() => setVariant(null)} style={{ marginLeft: 24, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '4px 16px', fontWeight: 600, fontSize: 16 }}>Change</button>
        </div>
      )}

      {/* Only show bet/chip UI after variant is selected, below cards */}
      {/* Always show cards area, even if empty */}
      <div style={{
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', margin: '0 0 24px 0', minHeight: 120, maxHeight: 160
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 200 }}>
          <h3 style={{ color: '#00bfff', marginBottom: 6, fontSize: 24, fontWeight: 700, marginLeft: 12 }}>Player Hand ({handValue(player)})</h3>
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 12, minHeight: 80, maxHeight: 100 }}>
            {player.length === 0
              ? null
              : player.map((c, i) => <Card key={i} rank={c.rank} suit={c.suit} />)}
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 200 }}>
          <h3 style={{ color: '#e60026', marginBottom: 6, fontSize: 24, fontWeight: 700, marginRight: 12 }}>Banker Hand ({handValue(banker)})</h3>
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 12, minHeight: 80, maxHeight: 100 }}>
            {banker.length === 0
              ? null
              : banker.map((c, i) => <Card key={i} rank={c.rank} suit={c.suit} />)}
          </div>
        </div>
      </div>
      {/* Only show bet/chip UI after variant is selected, below cards */}
      {variant && (
  <React.Fragment>
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 48, position: 'relative', zIndex: 2 }}>
      {/* Bet buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('player')} onContextMenu={e => { e.preventDefault(); clearBet('player'); }} style={{ background: bets.player ? '#00bfff' : '#fff', color: bets.player ? '#fff' : '#222', border: '2.5px solid #00bfff', borderRadius: 24, width: 180, height: 60, fontSize: 28, fontWeight: 700, boxShadow: bets.player ? '0 0 16px #00bfff88' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative' }}>Player
            {bets.player > 0 && <span style={{ position: 'absolute', right: 16, top: 8, fontSize: 18, color: '#ffd700', fontWeight: 700 }}>{bets.player}</span>}
          </button>
          {bets.player > 0 && !handInProgress && <button onClick={() => clearBet('player')} style={{ position: 'absolute', left: 8, bottom: -32, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 10px', fontWeight: 600, fontSize: 14, zIndex: 3 }}>Return</button>}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('banker')} onContextMenu={e => { e.preventDefault(); clearBet('banker'); }} style={{ background: bets.banker ? '#e60026' : '#fff', color: bets.banker ? '#fff' : '#222', border: '2.5px solid #e60026', borderRadius: 24, width: 180, height: 60, fontSize: 28, fontWeight: 700, boxShadow: bets.banker ? '0 0 16px #e6002688' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative' }}>Banker
            {bets.banker > 0 && <span style={{ position: 'absolute', right: 16, top: 8, fontSize: 18, color: '#ffd700', fontWeight: 700 }}>{bets.banker}</span>}
          </button>
          {bets.banker > 0 && !handInProgress && <button onClick={() => clearBet('banker')} style={{ position: 'absolute', left: 8, bottom: -32, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 10px', fontWeight: 600, fontSize: 14, zIndex: 3 }}>Return</button>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('tie')} onContextMenu={e => { e.preventDefault(); clearBet('tie'); }} style={{ background: bets.tie ? '#ffd700' : '#fff', color: bets.tie ? '#222' : '#222', border: '2px solid #ffd700', borderRadius: 18, width: 120, height: 48, fontSize: 20, fontWeight: 700, boxShadow: bets.tie ? '0 0 12px #ffd70088' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative' }}>Tie
            {bets.tie > 0 && <span style={{ position: 'absolute', right: 12, top: 6, fontSize: 16, color: '#222', fontWeight: 700 }}>{bets.tie}</span>}
          </button>
          {bets.tie > 0 && !handInProgress && <button onClick={() => clearBet('tie')} style={{ position: 'absolute', left: 4, bottom: -28, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 8px', fontWeight: 600, fontSize: 13, zIndex: 3 }}>Return</button>}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('tigerTie')} onContextMenu={e => { e.preventDefault(); clearBet('tigerTie'); }} style={{ background: bets.tigerTie ? '#ff9800' : '#fff', color: bets.tigerTie ? '#fff' : '#222', border: '2px solid #ff9800', borderRadius: 18, width: 120, height: 48, fontSize: 18, fontWeight: 700, boxShadow: bets.tigerTie ? '0 0 12px #ff980088' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative' }}>Tiger Tie
            {bets.tigerTie > 0 && <span style={{ position: 'absolute', right: 12, top: 6, fontSize: 16, color: '#fff', fontWeight: 700 }}>{bets.tigerTie}</span>}
          </button>
          {bets.tigerTie > 0 && !handInProgress && <button onClick={() => clearBet('tigerTie')} style={{ position: 'absolute', left: 4, bottom: -28, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 8px', fontWeight: 600, fontSize: 13, zIndex: 3 }}>Return</button>}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('bigTiger')} onContextMenu={e => { e.preventDefault(); clearBet('bigTiger'); }} style={{ background: bets.bigTiger ? '#8bc34a' : '#fff', color: bets.bigTiger ? '#fff' : '#222', border: '2px solid #8bc34a', borderRadius: 18, width: 120, height: 48, fontSize: 18, fontWeight: 700, boxShadow: bets.bigTiger ? '0 0 12px #8bc34a88' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative' }}>Big Tiger
            {bets.bigTiger > 0 && <span style={{ position: 'absolute', right: 12, top: 6, fontSize: 16, color: '#fff', fontWeight: 700 }}>{bets.bigTiger}</span>}
          </button>
          {bets.bigTiger > 0 && !handInProgress && <button onClick={() => clearBet('bigTiger')} style={{ position: 'absolute', left: 4, bottom: -28, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 8px', fontWeight: 600, fontSize: 13, zIndex: 3 }}>Return</button>}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => addChipToBet('smallTiger')} onContextMenu={e => { e.preventDefault(); clearBet('smallTiger'); }} style={{ background: bets.smallTiger ? '#9c27b0' : '#fff', color: bets.smallTiger ? '#fff' : '#222', border: '2px solid #9c27b0', borderRadius: 18, width: 140, height: 48, fontSize: 17, fontWeight: 700, boxShadow: bets.smallTiger ? '0 0 12px #9c27b088' : 'none', margin: 0, transition: 'all 0.2s', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <span style={{
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: 700,
              fontSize: 17,
              lineHeight: '48px',
              position: 'relative',
              zIndex: 1
            }}>Small Tiger</span>
            {bets.smallTiger > 0 && <span style={{ position: 'absolute', right: 12, top: 6, fontSize: 16, color: '#fff', fontWeight: 700 }}>{bets.smallTiger}</span>}
          </button>
          {bets.smallTiger > 0 && !handInProgress && <button onClick={() => clearBet('smallTiger')} style={{ position: 'absolute', left: 4, bottom: -28, background: '#fff', color: '#222', border: '1.5px solid #888', borderRadius: 8, padding: '2px 8px', fontWeight: 600, fontSize: 13, zIndex: 3 }}>Return</button>}
        </div>
      </div>
      {/* Chip tray below bets */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, margin: '24px 0 0 0' }}>
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
      {/* Deal button at the bottom */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '32px 0 0 0', gap: 16 }}>
        <button
          onClick={deal}
          disabled={dealing || player.length > 0 || banker.length > 0}
          style={{
            background: '#ffd700',
            color: '#222',
            fontWeight: 700,
            border: 'none',
            borderRadius: 12,
            padding: '12px 36px',
            fontSize: 22,
            boxShadow: '0 2px 8px #0002',
            zIndex: 2,
            opacity: (dealing || player.length > 0 || banker.length > 0) ? 0.5 : 1
          }}
        >
          Deal
        </button>
        {handInProgress && (player.length > 0 || banker.length > 0) && (
          <button
            onClick={newHand}
            disabled={dealing}
            style={{
              background: '#fff',
              color: '#222',
              fontWeight: 700,
              border: '1.5px solid #888',
              borderRadius: 8,
              padding: '12px 36px',
              fontSize: 18,
              opacity: dealing ? 0.5 : 1,
              cursor: dealing ? 'not-allowed' : 'pointer'
            }}
          >
            New Hand
          </button>
        )}
      </div>
    </div>
  </React.Fragment>
      )}

      {showRefill && (
        <div style={{ marginBottom: 10, textAlign: 'center' }}>
          <span style={{ color: 'red' }}>Not enough chips!</span>
          <br />
          <button onClick={() => handleRefill(10000)} style={{ margin: 8 }}>Add 10,000 Chips</button>
          <button onClick={() => handleRefill(50000)} style={{ margin: 8 }}>Add 50,000 Chips</button>
        </div>
      )}
      <h3 style={{ color: lastWin === null ? '#fff' : lastWin ? '#4caf50' : '#e60026', textAlign: 'center', marginTop: 32 }}>{result}</h3>
    </div>
  );
}