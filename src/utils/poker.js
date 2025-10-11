// Poker hand evaluation and utilities

// Hand rankings (higher number = better hand)
export const HAND_RANKINGS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

// Position types for GTO calculations
export const POSITIONS = {
  SB: 'SB', // Small Blind
  BB: 'BB', // Big Blind
  UTG: 'UTG', // Under the Gun
  MP: 'MP', // Middle Position
  CO: 'CO', // Cut Off
  BTN: 'BTN' // Button
};

// Get card numerical value for comparison
export function getCardValue(card) {
  const rank = card.rank;
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank);
}

// Evaluate the best 5-card hand from 7 cards (2 hole + 5 community)
export function evaluateHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return { rank: 0, description: 'Incomplete hand' };

  // Generate all possible 5-card combinations
  const combinations = getCombinations(allCards, 5);
  let bestHand = { rank: 0, value: 0 };

  for (const combo of combinations) {
    const hand = evaluateFiveCards(combo);
    if (hand.rank > bestHand.rank || (hand.rank === bestHand.rank && hand.value > bestHand.value)) {
      bestHand = hand;
      bestHand.cards = combo;
    }
  }

  return bestHand;
}

// Evaluate exactly 5 cards
function evaluateFiveCards(cards) {
  const values = cards.map(getCardValue).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  
  const isFlush = suits.every(suit => suit === suits[0]);
  const isStraight = checkStraight(values);
  
  // Count occurrences of each value
  const counts = {};
  values.forEach(val => counts[val] = (counts[val] || 0) + 1);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => b - a);

  // Royal Flush
  if (isFlush && isStraight && values[0] === 14) {
    return { rank: HAND_RANKINGS.ROYAL_FLUSH, value: 14, description: 'Royal Flush' };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: HAND_RANKINGS.STRAIGHT_FLUSH, value: values[0], description: 'Straight Flush' };
  }

  // Four of a Kind
  if (countValues[0] === 4) {
    const quadValue = uniqueValues.find(val => counts[val] === 4);
    const kicker = uniqueValues.find(val => counts[val] === 1);
    return { 
      rank: HAND_RANKINGS.FOUR_OF_A_KIND, 
      value: quadValue * 1000 + kicker,
      description: 'Four of a Kind'
    };
  }

  // Full House
  if (countValues[0] === 3 && countValues[1] === 2) {
    const tripValue = uniqueValues.find(val => counts[val] === 3);
    const pairValue = uniqueValues.find(val => counts[val] === 2);
    return { 
      rank: HAND_RANKINGS.FULL_HOUSE, 
      value: tripValue * 100 + pairValue,
      description: 'Full House'
    };
  }

  // Flush
  if (isFlush) {
    return { 
      rank: HAND_RANKINGS.FLUSH, 
      value: values.reduce((acc, val, i) => acc + val * Math.pow(100, 4 - i), 0),
      description: 'Flush'
    };
  }

  // Straight
  if (isStraight) {
    return { rank: HAND_RANKINGS.STRAIGHT, value: values[0], description: 'Straight' };
  }

  // Three of a Kind
  if (countValues[0] === 3) {
    const tripValue = uniqueValues.find(val => counts[val] === 3);
    const kickers = uniqueValues.filter(val => counts[val] === 1).sort((a, b) => b - a);
    return { 
      rank: HAND_RANKINGS.THREE_OF_A_KIND, 
      value: tripValue * 10000 + kickers[0] * 100 + kickers[1],
      description: 'Three of a Kind'
    };
  }

  // Two Pair
  if (countValues[0] === 2 && countValues[1] === 2) {
    const pairs = uniqueValues.filter(val => counts[val] === 2).sort((a, b) => b - a);
    const kicker = uniqueValues.find(val => counts[val] === 1);
    return { 
      rank: HAND_RANKINGS.TWO_PAIR, 
      value: pairs[0] * 10000 + pairs[1] * 100 + kicker,
      description: 'Two Pair'
    };
  }

  // One Pair
  if (countValues[0] === 2) {
    const pairValue = uniqueValues.find(val => counts[val] === 2);
    const kickers = uniqueValues.filter(val => counts[val] === 1).sort((a, b) => b - a);
    return { 
      rank: HAND_RANKINGS.PAIR, 
      value: pairValue * 1000000 + kickers[0] * 10000 + kickers[1] * 100 + kickers[2],
      description: 'Pair'
    };
  }

  // High Card
  return { 
    rank: HAND_RANKINGS.HIGH_CARD, 
    value: values.reduce((acc, val, i) => acc + val * Math.pow(100, 4 - i), 0),
    description: 'High Card'
  };
}

// Check if values form a straight
function checkStraight(values) {
  // Check regular straight
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // Check for A-5 straight (wheel)
      if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        return true;
      }
      return false;
    }
  }
  return true;
}

// Generate combinations of r elements from array
function getCombinations(arr, r) {
  const result = [];
  
  function combine(start, combo) {
    if (combo.length === r) {
      result.push([...combo]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  
  combine(0, []);
  return result;
}

// Calculate hand strength (0-1) for preflop decisions
export function calculatePreflopStrength(holeCards) {
  const [card1, card2] = holeCards;
  const val1 = getCardValue(card1);
  const val2 = getCardValue(card2);
  const isPair = val1 === val2;
  const isSuited = card1.suit === card2.suit;
  const highCard = Math.max(val1, val2);
  const lowCard = Math.min(val1, val2);
  const gap = highCard - lowCard;

  // Premium hands
  if (isPair) {
    if (highCard >= 10) return 0.9 + (highCard - 10) * 0.02; // TT-AA
    if (highCard >= 7) return 0.7 + (highCard - 7) * 0.05; // 77-99
    return 0.4 + (highCard - 2) * 0.05; // 22-66
  }

  // Strong suited/unsuited combinations
  if (highCard === 14) { // Ace high
    if (lowCard >= 10) return isSuited ? 0.85 : 0.75; // AK, AQ, AJ, AT
    if (lowCard >= 7) return isSuited ? 0.65 : 0.45; // A9, A8, A7
    return isSuited ? 0.4 : 0.2; // A6 and below
  }

  if (highCard === 13) { // King high
    if (lowCard >= 10) return isSuited ? 0.7 : 0.6; // KQ, KJ, KT
    if (lowCard >= 7) return isSuited ? 0.5 : 0.3; // K9, K8, K7
    return isSuited ? 0.3 : 0.15;
  }

  if (highCard >= 11) { // Queen/Jack high
    if (gap <= 1 && lowCard >= 9) return isSuited ? 0.6 : 0.5; // QJ, QT, JT
    if (gap <= 2 && lowCard >= 8) return isSuited ? 0.45 : 0.3; // Q9, J9, etc.
  }

  // Suited connectors and one-gappers
  if (isSuited && gap <= 1 && lowCard >= 5) return 0.4;
  if (isSuited && gap <= 2 && lowCard >= 6) return 0.3;

  // Default weak hands
  return 0.1;
}

// GTO-inspired position ranges (simplified)
export const GTO_RANGES = {
  [POSITIONS.UTG]: 0.65, // Tight range
  [POSITIONS.MP]: 0.55,
  [POSITIONS.CO]: 0.45,
  [POSITIONS.BTN]: 0.35, // Widest range
  [POSITIONS.SB]: 0.5,
  [POSITIONS.BB]: 0.6 // Defending range
};

// Get position based on seat and button position
export function getPosition(seatIndex, buttonIndex, numPlayers) {
  const positions = numPlayers === 6 ? 
    [POSITIONS.SB, POSITIONS.BB, POSITIONS.UTG, POSITIONS.MP, POSITIONS.CO, POSITIONS.BTN] :
    [POSITIONS.SB, POSITIONS.BB, POSITIONS.UTG, POSITIONS.UTG, POSITIONS.MP, POSITIONS.MP, POSITIONS.CO, POSITIONS.BTN];
    
  const relativePosition = (seatIndex - buttonIndex - 1 + numPlayers) % numPlayers;
  return positions[relativePosition] || POSITIONS.UTG;
}

// Calculate pot odds
export function calculatePotOdds(betToCall, potSize) {
  return betToCall / (potSize + betToCall);
}

// Estimate hand equity against random hand (simplified)
export function estimateEquity(holeCards, communityCards, numOpponents = 1) {
  const handStrength = calculatePreflopStrength(holeCards);
  const boardFactor = communityCards.length / 5; // How much board affects equity
  
  // Adjust for number of opponents
  const opponentAdjustment = Math.pow(0.85, numOpponents - 1);
  
  return Math.min(0.95, handStrength * opponentAdjustment * (1 - boardFactor * 0.3));
}

// Stakes configuration
export const STAKES = [
  { sb: 0.25, bb: 0.5, buyIn: 50, name: '$0.25/$0.5' },
  { sb: 0.5, bb: 1, buyIn: 100, name: '$0.50/$1' },
  { sb: 1, bb: 2, buyIn: 200, name: '$1/$2' },
  { sb: 2.5, bb: 5, buyIn: 500, name: '$2.50/$5' },
  { sb: 5, bb: 10, buyIn: 1000, name: '$5/$10' },
  { sb: 12.5, bb: 25, buyIn: 2500, name: '$12.50/$25' },
  { sb: 25, bb: 50, buyIn: 5000, name: '$25/$50' }
];

export default {
  evaluateHand,
  calculatePreflopStrength,
  getPosition,
  calculatePotOdds,
  estimateEquity,
  GTO_RANGES,
  POSITIONS,
  STAKES,
  HAND_RANKINGS
};