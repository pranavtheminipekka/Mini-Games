// GTO-inspired bot AI for poker
import { 
  calculatePreflopStrength, 
  getPosition, 
  GTO_RANGES, 
  POSITIONS,
  calculatePotOdds,
  estimateEquity,
  evaluateHand
} from './poker.js';

export class PokerBot {
  constructor(id, name, chips, style = 'GTO') {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.style = style;
    this.aggression = 0.7; // Base aggression factor
    this.tightness = 0.6; // Base tightness factor
    
    // Style adjustments
    this.applyStyle(style);
  }

  applyStyle(style) {
    switch (style) {
      case 'GTO':
        this.aggression = 0.7;
        this.tightness = 0.6;
        this.bluffFreq = 0.25;
        break;
      case 'Tight':
        this.aggression = 0.5;
        this.tightness = 0.8;
        this.bluffFreq = 0.1;
        break;
      case 'Loose':
        this.aggression = 0.8;
        this.tightness = 0.3;
        this.bluffFreq = 0.4;
        break;
      case 'Maniac':
        this.aggression = 0.95;
        this.tightness = 0.2;
        this.bluffFreq = 0.6;
        break;
    }
  }

  // Main decision-making function
  makeDecision(gameState, playerState) {
    const {
      pot,
      currentBet,
      communityCards,
      bettingRound,
      numActivePlayers,
      buttonPosition,
      numPlayers
    } = gameState;

    const {
      holeCards,
      chips,
      seatIndex,
      amountInPot,
      position
    } = playerState;

    // Calculate basic metrics
    const betToCall = currentBet - amountInPot;
    const potOdds = calculatePotOdds(betToCall, pot);
    const handStrength = this.evaluateHandStrength(holeCards, communityCards, bettingRound);
    const pos = getPosition(seatIndex, buttonPosition, numPlayers);
    
    // Preflop decisions
    if (bettingRound === 'preflop') {
      return this.makePreflopDecision(handStrength, betToCall, pot, pos, numActivePlayers);
    }

    // Postflop decisions
    return this.makePostflopDecision(
      holeCards,
      communityCards, 
      handStrength,
      betToCall,
      pot,
      potOdds,
      pos,
      numActivePlayers
    );
  }

  makePreflopDecision(handStrength, betToCall, pot, position, numActivePlayers) {
    const positionThreshold = GTO_RANGES[position] || 0.5;
    const adjustedThreshold = positionThreshold * this.tightness;

    // Facing no bet - decide to raise or call/check (only BB can check preflop with no raises)
    if (betToCall === 0) {
      if (handStrength > adjustedThreshold + 0.2) {
        // Strong hand - raise (when no bet to call, this is a bet)
        const betSize = this.calculateRaiseSize(pot, 'value', handStrength);
        console.log(`No bet - strong hand bet: betSize=${betSize}`);
        return { action: 'bet', amount: betSize };
      } else if (handStrength > adjustedThreshold) {
        // Marginal hand - sometimes raise for balance
        if (Math.random() < this.aggression * 0.3) {
          const betSize = this.calculateRaiseSize(pot, 'bluff', handStrength);
          console.log(`No bet - marginal hand bet: betSize=${betSize}`);
          return { action: 'bet', amount: betSize };
        }
        return { action: 'check' }; // Only valid if BB with no raises
      } else {
        return { action: 'check' }; // Only valid if BB with no raises
      }
    }

    // Facing a bet
    const potOdds = calculatePotOdds(betToCall, pot);
    const equity = estimateEquity([{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'hearts' }], [], numActivePlayers);

    if (handStrength > 0.8) {
      // Premium hands - always raise/call
      if (Math.random() < this.aggression) {
        const raiseSize = this.calculateRaiseSize(pot + betToCall, 'value', handStrength);
        const totalBetSize = betToCall + raiseSize; // Total amount to bet (call + raise)
        console.log(`Premium hand raise: betToCall=${betToCall}, raiseSize=${raiseSize}, totalBetSize=${totalBetSize}`);
        return { action: 'raise', amount: totalBetSize };
      }
      return { action: 'call' };
    }

    if (handStrength > adjustedThreshold) {
      // Good hands - call or raise based on position and aggression
      if (position === POSITIONS.BTN && Math.random() < this.aggression * 0.6) {
        const raiseSize = this.calculateRaiseSize(pot + betToCall, 'value', handStrength);
        const totalBetSize = betToCall + raiseSize; // Total amount to bet
        console.log(`Button raise: betToCall=${betToCall}, raiseSize=${raiseSize}, totalBetSize=${totalBetSize}`);
        return { action: 'raise', amount: totalBetSize };
      }
      return { action: 'call' };
    }

    if (handStrength > adjustedThreshold * 0.7 && potOdds < 0.3) {
      // Marginal hands with good pot odds
      return { action: 'call' };
    }

    // Bluff occasionally with position
    if (position === POSITIONS.BTN && Math.random() < this.bluffFreq * 0.3) {
      const raiseSize = this.calculateRaiseSize(pot + betToCall, 'bluff', handStrength);
      const totalBetSize = betToCall + raiseSize; // Total amount to bet
      console.log(`Bluff raise: betToCall=${betToCall}, raiseSize=${raiseSize}, totalBetSize=${totalBetSize}`);
      return { action: 'raise', amount: totalBetSize };
    }

    return { action: 'fold' };
  }

  makePostflopDecision(holeCards, communityCards, handStrength, betToCall, pot, potOdds, position, numActivePlayers) {
    const equity = estimateEquity(holeCards, communityCards, numActivePlayers);
    const handEvaluation = evaluateHand(holeCards, communityCards);
    
    // Strong hands (top pair or better)
    if (handEvaluation.rank >= 2) {
      if (betToCall === 0) {
        // No bet to us - bet for value
        if (Math.random() < this.aggression) {
          const betSize = this.calculateBetSize(pot, 'value', handStrength);
          return { action: 'bet', amount: betSize };
        }
        return { action: 'check' };
      } else {
        // Facing a bet
        if (handStrength > 0.7) {
          // Very strong - raise/call
          if (Math.random() < this.aggression * 0.7) {
            const raiseSize = this.calculateRaiseSize(pot + betToCall, 'value', handStrength);
            return { action: 'raise', amount: raiseSize };
          }
          return { action: 'call' };
        }
        // Decent hand - call if good odds
        if (equity > potOdds) {
          return { action: 'call' };
        }
      }
    }

    // Drawing hands
    if (this.hasDrawingPotential(holeCards, communityCards) && equity > potOdds) {
      if (betToCall === 0) {
        // Semi-bluff bet
        if (Math.random() < this.aggression * 0.4) {
          const betSize = this.calculateBetSize(pot, 'semibluff', handStrength);
          return { action: 'bet', amount: betSize };
        }
        return { action: 'check' };
      } else {
        return { action: 'call' };
      }
    }

    // Bluff attempts
    if (betToCall === 0 && Math.random() < this.bluffFreq && position === POSITIONS.BTN) {
      const betSize = this.calculateBetSize(pot, 'bluff', handStrength);
      return { action: 'bet', amount: betSize };
    }

    // Default fold/check
    return betToCall === 0 ? { action: 'check' } : { action: 'fold' };
  }

  evaluateHandStrength(holeCards, communityCards, bettingRound) {
    if (bettingRound === 'preflop') {
      return calculatePreflopStrength(holeCards);
    }

    const handEval = evaluateHand(holeCards, communityCards);
    // Convert hand evaluation to 0-1 strength scale
    return Math.min(1, (handEval.rank + handEval.value / 1000000) / 10);
  }

  hasDrawingPotential(holeCards, communityCards) {
    if (communityCards.length < 3) return false;
    
    const allCards = [...holeCards, ...communityCards];
    
    // Check for flush draws
    const suitCounts = {};
    allCards.forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    
    if (Object.values(suitCounts).some(count => count === 4)) {
      return true; // Flush draw
    }

    // Check for straight draws (simplified)
    const values = allCards.map(card => {
      if (card.rank === 'A') return 14;
      if (card.rank === 'K') return 13;
      if (card.rank === 'Q') return 12;
      if (card.rank === 'J') return 11;
      return parseInt(card.rank);
    }).sort((a, b) => a - b);

    const uniqueValues = [...new Set(values)];
    
    // Look for 4-card straights
    for (let i = 0; i <= uniqueValues.length - 4; i++) {
      const sequence = uniqueValues.slice(i, i + 4);
      let consecutive = true;
      for (let j = 1; j < sequence.length; j++) {
        if (sequence[j] - sequence[j - 1] !== 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) return true;
    }

    return false;
  }

  calculateRaiseSize(currentPot, raiseType, handStrength) {
    const baseSizes = {
      value: currentPot * 0.75,
      bluff: currentPot * 0.6,
      semibluff: currentPot * 0.5
    };

    let baseSize = baseSizes[raiseType] || currentPot * 0.7;
    
    // Adjust based on hand strength and aggression
    if (raiseType === 'value') {
      baseSize *= (0.8 + handStrength * 0.4);
    }
    
    baseSize *= (0.8 + this.aggression * 0.4);
    
    return Math.max(1, Math.round(baseSize));
  }

  calculateBetSize(currentPot, betType, handStrength) {
    const baseSizes = {
      value: currentPot * 0.7,
      bluff: currentPot * 0.5,
      semibluff: currentPot * 0.4
    };

    let baseSize = baseSizes[betType] || currentPot * 0.6;
    
    if (betType === 'value') {
      baseSize *= (0.7 + handStrength * 0.6);
    }

    baseSize *= (0.7 + this.aggression * 0.6);
    
    return Math.max(1, Math.round(baseSize));
  }
}

// Create bots with different styles for variety
export function createBots(numBots, stakes) {
  const botNames = [
    'Alex Chen', 'Maria Rodriguez', 'David Kim', 'Sarah Johnson', 
    'Mike Thompson', 'Lisa Wang', 'Chris Brown', 'Emma Davis'
  ];
  
  const styles = ['GTO', 'Tight', 'Loose', 'GTO', 'GTO', 'Maniac', 'Tight', 'GTO'];
  
  return Array.from({ length: numBots }, (_, i) => {
    return new PokerBot(
      `bot_${i}`,
      botNames[i] || `Bot ${i + 1}`,
      stakes.buyIn,
      styles[i] || 'GTO'
    );
  });
}

export default PokerBot;