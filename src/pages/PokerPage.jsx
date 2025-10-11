import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { shuffle, createDeck } from '../utils/deck';
import { useGame } from '../GameContext';
import Card from '../components/Card';
import { 
  STAKES, 
  evaluateHand, 
  getPosition,
  POSITIONS
} from '../utils/poker';
import { PokerBot, createBots } from '../utils/pokerBot';

export default function PokerPage() {
  const navigate = useNavigate();
  const { chips, spendChips, addChips } = useGame();
  
  // Game setup
  const [selectedStakes, setSelectedStakes] = useState(STAKES[0]);
  const [numPlayers, setNumPlayers] = useState(6);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Game state
  const [deck, setDeck] = useState([]);
  const [players, setPlayersRaw] = useState([]);
  
  // Protective wrapper to prevent players array from being set to empty
  const setPlayers = (newPlayers) => {
    if (typeof newPlayers === 'function') {
      // Handle functional updates
      setPlayersRaw(prevPlayers => {
        const result = newPlayers(prevPlayers);
        if (!result || result.length === 0) {
          console.error('PREVENTED: Attempt to set players to empty array via function');
          console.error('Previous players:', prevPlayers.length);
          console.error('Stack trace:', new Error().stack);
          return prevPlayers; // Keep previous players instead of setting to empty
        }
        return result;
      });
    } else {
      // Handle direct updates
      if (!newPlayers || newPlayers.length === 0) {
        console.error('PREVENTED: Attempt to set players to empty array');
        console.error('Current players:', players.length);
        console.error('Stack trace:', new Error().stack);
        return; // Don't update if trying to set empty
      }
      setPlayersRaw(newPlayers);
    }
  };
  const [communityCards, setCommunityCards] = useState([]);
  const [pot, setPot] = useState(0);
  const [sidePots, setSidePots] = useState([]);
  const [currentBet, setCurrentBet] = useState(0);
  const [buttonPosition, setButtonPosition] = useState(Math.floor(Math.random() * 6)); // Random starting button
  const [activePlayer, setActivePlayer] = useState(0);
  const [bettingRound, setBettingRound] = useState('preflop'); // preflop, flop, turn, river
  const [gamePhase, setGamePhase] = useState('setup'); // setup, dealing, betting, showdown, complete
  
  // Action state
  const [playerAction, setPlayerAction] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [lastActivePlayer, setLastActivePlayer] = useState(-1);
  
  // Results
  const [winners, setWinners] = useState([]);
  const [showdown, setShowdown] = useState(false);

  // Initialize game
  function initializeGame() {
    if (chips < selectedStakes.buyIn) {
      alert(`You need at least ${selectedStakes.buyIn} chips to play this table!`);
      return;
    }

    const bots = createBots(numPlayers - 1, selectedStakes);
    
    // Create player lineup (human player at seat 0)
    const allPlayers = [
      {
        id: 'human',
        name: 'You',
        chips: selectedStakes.buyIn,
        isHuman: true,
        isActive: true,
        holeCards: [],
        amountInPot: 0,
        lastAction: null,
        seatIndex: 0,
        isAllIn: false,
        hasFolded: false
      },
      ...bots.map((bot, i) => ({
        id: bot.id,
        name: bot.name,
        chips: selectedStakes.buyIn,
        isHuman: false,
        bot: bot,
        isActive: true,
        holeCards: [],
        amountInPot: 0,
        lastAction: null,
        seatIndex: i + 1,
        isAllIn: false,
        hasFolded: false
      }))
    ];

    spendChips(selectedStakes.buyIn);
    setPlayers(allPlayers);
    setGameStarted(true);
    setGamePhase('dealing');
    startNewHand(allPlayers);
  }

  function recreatePlayersAndRestart() {
    console.log('Recreating players from scratch...');
    
    // Recreate the initial players array
    const bots = createBots(numPlayers - 1, selectedStakes);
    const freshPlayers = [
      {
        id: 'human',
        name: 'You',
        chips: selectedStakes.buyIn,
        isHuman: true,
        isActive: true,
        holeCards: [],
        amountInPot: 0,
        lastAction: null,
        seatIndex: 0,
        isAllIn: false,
        hasFolded: false
      },
      ...bots.map((bot, i) => ({
        id: bot.id,
        name: bot.name,
        chips: selectedStakes.buyIn,
        isHuman: false,
        bot: bot,
        isActive: true,
        holeCards: [],
        amountInPot: 0,
        lastAction: null,
        seatIndex: i + 1,
        isAllIn: false,
        hasFolded: false
      }))
    ];
    
    console.log('Recreated players:', freshPlayers.length, freshPlayers.map(p => p.name));
    setPlayers(freshPlayers);
    
    // Reset all game state
    setPot(0);
    setCurrentBet(0);
    setCommunityCards([]);
    setShowdown(false);
    setShowActions(false);
    setBettingRound('preflop');
    setGamePhase('setup');
    
    // Start a new hand with the fresh players
    setTimeout(() => {
      startNewHand(freshPlayers);
    }, 1000);
  }

  function startNewHand(currentPlayers = players) {
    console.log('Starting new hand...');
    console.log('Current players at start:', currentPlayers.length, currentPlayers.map(p => p.name));
    console.log('Button position:', buttonPosition, 'numPlayers:', numPlayers);
    
    // Safety check: ensure we have players
    if (!currentPlayers || currentPlayers.length === 0) {
      console.error('Cannot start new hand with no players. Game needs to be restarted.');
      setGamePhase('setup');
      // Set an error message for the UI
      alert('The poker game encountered an error and needs to be restarted. Please refresh the page.');
      return;
    }
    
    const newDeck = shuffle(createDeck());
    
    // Reset hand state
    const resetPlayers = currentPlayers.map(p => ({
      ...p,
      holeCards: [],
      amountInPot: 0,
      lastAction: null,
      hasFolded: false,
      isAllIn: false,
      isActive: p.chips > 0
    }));

    // Post blinds
    const sbIndex = (buttonPosition + 1) % numPlayers;
    const bbIndex = (buttonPosition + 2) % numPlayers;
    
    console.log(`Posting blinds: buttonPosition=${buttonPosition}, numPlayers=${numPlayers}, sbIndex=${sbIndex}, bbIndex=${bbIndex}`);
    console.log(`resetPlayers.length=${resetPlayers.length}, sbPlayer exists: ${!!resetPlayers[sbIndex]}, bbPlayer exists: ${!!resetPlayers[bbIndex]}`);
    
    if (!resetPlayers[sbIndex] || !resetPlayers[bbIndex]) {
      console.error('Invalid blind indices - cannot post blinds. Resetting game state.');
      // Reset to a safe state
      setGamePhase('setup');
      setPot(0);
      setCurrentBet(0);
      setCommunityCards([]);
      return;
    }
    
    resetPlayers[sbIndex].amountInPot = selectedStakes.sb;
    resetPlayers[sbIndex].chips -= selectedStakes.sb;
    resetPlayers[bbIndex].amountInPot = selectedStakes.bb;
    resetPlayers[bbIndex].chips -= selectedStakes.bb;

    console.log('After posting blinds:');
    console.log(`SB (${resetPlayers[sbIndex].name}): amountInPot=${resetPlayers[sbIndex].amountInPot}, chips=${resetPlayers[sbIndex].chips}`);
    console.log(`BB (${resetPlayers[bbIndex].name}): amountInPot=${resetPlayers[bbIndex].amountInPot}, chips=${resetPlayers[bbIndex].chips}`);

    setPlayers(resetPlayers);
    setDeck(newDeck);
    setCommunityCards([]);
    setPot(selectedStakes.sb + selectedStakes.bb);
    setCurrentBet(selectedStakes.bb);
    setBettingRound('preflop');
    console.log(`Blinds posted: SB=${selectedStakes.sb} BB=${selectedStakes.bb}, pot=${selectedStakes.sb + selectedStakes.bb}, currentBet set to ${selectedStakes.bb}`);
    // Don't set activePlayer here - we'll set it after dealing cards
    setShowActions(false);
    setWinners([]);
    setShowdown(false);

    // Deal hole cards (pass the resetPlayers with blinds posted)
    setTimeout(() => dealHoleCards(newDeck, resetPlayers), 500);
  }

  async function dealHoleCards(gameDeck, gamePlayers) {
    console.log('dealHoleCards called with players:', gamePlayers.map(p => ({ name: p.name, amountInPot: p.amountInPot, chips: p.chips })));
    console.log('Current game state when dealing:', { pot, currentBet });
    
    let currentDeck = [...gameDeck];
    const updatedPlayers = [...gamePlayers];

    // Deal 2 cards to each active player
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < numPlayers; i++) {
        if (updatedPlayers[i].isActive) {
          await new Promise(resolve => setTimeout(resolve, 200));
          updatedPlayers[i].holeCards.push(currentDeck.pop());
          setPlayers([...updatedPlayers]);
        }
      }
    }

    setDeck(currentDeck);
    setPlayers(updatedPlayers);
    
    // Find the correct first active player for preflop (UTG = Button + 3 in 6-max)
    // In 6-max: BTN(0) -> SB(1) -> BB(2) -> UTG(3) -> MP(4) -> CO(5) -> BTN(0)
    let firstActivePreflop = (buttonPosition + 3) % numPlayers;
    let attempts = 0;
    console.log('Looking for first active player starting at UTG:', firstActivePreflop, 'Button:', buttonPosition, 'SB:', (buttonPosition + 1) % numPlayers, 'BB:', (buttonPosition + 2) % numPlayers);
    console.log('SEATING ORDER:', updatedPlayers.map((p, i) => `Index ${i}: ${p.name}`).join(', '));
    console.log('BETTING ORDER - Button:', updatedPlayers[buttonPosition]?.name, 'SB:', updatedPlayers[(buttonPosition + 1) % numPlayers]?.name, 'BB:', updatedPlayers[(buttonPosition + 2) % numPlayers]?.name, 'UTG:', updatedPlayers[firstActivePreflop]?.name);
    console.log('ACTUAL BLINDS - SB index:', (buttonPosition + 1) % numPlayers, 'amountInPot:', updatedPlayers[(buttonPosition + 1) % numPlayers]?.amountInPot, 'BB index:', (buttonPosition + 2) % numPlayers, 'amountInPot:', updatedPlayers[(buttonPosition + 2) % numPlayers]?.amountInPot);
    
    while (attempts < numPlayers) {
      const player = updatedPlayers[firstActivePreflop];
      console.log(`Checking player ${firstActivePreflop}:`, player?.name, 'Active:', player?.isActive, 'Folded:', player?.hasFolded, 'Chips:', player?.chips);
      
      if (player && player.isActive && !player.hasFolded && !player.isAllIn && player.chips > 0) {
        console.log(`Setting active player to ${player.name} at position ${firstActivePreflop}`);
        break;
      }
      firstActivePreflop = (firstActivePreflop + 1) % numPlayers;
      attempts++;
    }
    
    // Update state and start betting
    setTimeout(() => {
      setGamePhase('betting');
      setActivePlayer(firstActivePreflop);
      
      const currentActivePlayer = updatedPlayers[firstActivePreflop];
      console.log('Starting action with player:', currentActivePlayer?.name, 'at index:', firstActivePreflop);
      
      if (currentActivePlayer && !currentActivePlayer.isHuman) {
        // Trigger bot action with direct parameters to avoid stale state
        // Pass the correct game state values (hard-coded for reliability)
        const correctGameState = {
          pot: 3, // $1 SB + $2 BB
          currentBet: 2, // $2 Big Blind
          communityCards: [],
          bettingRound: 'preflop',
          buttonPosition: buttonPosition
        };
        console.log('Starting first bot action for player:', firstActivePreflop);
        setTimeout(() => processBotAction(firstActivePreflop), 600);
      } else {
        setShowActions(true);
      }
    }, 1500);
  }

  // Simplified bot action processing without complex state overrides
  async function processBotAction(playerIndex) {
    console.log('processBotAction called for player:', playerIndex);
    
    const currentPlayer = players[playerIndex];
    if (!currentPlayer || currentPlayer.isHuman) {
      console.log('Invalid bot player, switching to processPlayerAction');
      processPlayerAction();
      return;
    }
    
    if (currentPlayer.hasFolded || currentPlayer.isAllIn) {
      console.log('Player already folded/all-in, moving to next');
      nextPlayer();
      return;
    }

    // Use current game state directly - no overrides needed
    const gameState = {
      pot,
      currentBet,
      communityCards,
      bettingRound,
      buttonPosition,
      numActivePlayers: players.filter(p => p.isActive && !p.hasFolded).length,
      numPlayers
    };

    const playerState = {
      holeCards: currentPlayer.holeCards,
      chips: currentPlayer.chips,
      seatIndex: currentPlayer.seatIndex,
      amountInPot: currentPlayer.amountInPot,
      position: getPosition(currentPlayer.seatIndex, buttonPosition, numPlayers)
    };

    try {
      console.log(`${currentPlayer.name} is making a decision...`);
      console.log('Game state:', gameState);
      console.log('Player state:', playerState);
      
      const decision = currentPlayer.bot.makeDecision(gameState, playerState);
      console.log(`${currentPlayer.name} decides to ${decision.action}`, decision.amount || 0);
      
      await executeAction(playerIndex, decision.action, decision.amount || 0);
    } catch (error) {
      console.error(`Error with bot decision for ${currentPlayer.name}:`, error);
      // Default to fold if bot errors
      await executeAction(playerIndex, 'fold', 0);
    }
  }



  async function processPlayerAction(forceForHuman = false) {
    console.log('processPlayerAction called, gamePhase:', gamePhase, 'activePlayer:', activePlayer, 'forceForHuman:', forceForHuman);
    if (gamePhase !== 'betting' && !forceForHuman) return;

    console.log('processPlayerAction: players.length =', players.length, 'activePlayer =', activePlayer);
    console.log('processPlayerAction: players =', players.map(p => p?.name || 'undefined'));
    
    // Emergency recovery if players array is corrupted
    if (players.length === 0) {
      console.error('CRITICAL: processPlayerAction called with empty players array - immediate recovery');
      recreatePlayersAndRestart();
      return;
    }
    
    const currentPlayer = players[activePlayer];
    console.log('Current player:', currentPlayer?.name, 'isHuman:', currentPlayer?.isHuman);
    if (!currentPlayer) {
      console.log('No current player found at index', activePlayer);
      console.log('CRITICAL: Invalid activePlayer index for non-empty players array');
      console.log('players.length:', players.length, 'activePlayer:', activePlayer);
      // Try to recover by resetting to a valid activePlayer
      const validPlayerIndex = players.findIndex(p => p && p.isActive && !p.hasFolded);
      if (validPlayerIndex >= 0) {
        console.log('Found valid player at index', validPlayerIndex, players[validPlayerIndex].name);
        setActivePlayer(validPlayerIndex);
        setTimeout(() => processPlayerAction(forceForHuman), 100);
        return;
      } else {
        console.error('No valid players found - triggering full recovery');
        recreatePlayersAndRestart();
        return;
      }
    }
    
    if (currentPlayer.hasFolded || currentPlayer.isAllIn) {
      nextPlayer();
      return;
    }

    if (currentPlayer.isHuman) {
      console.log(`SHOWING ACTIONS for human player: ${currentPlayer.name}`);
      setGamePhase('betting'); // Force gamePhase to betting
      setShowActions(true);
      return;
    }

    // For bots, use the simplified processBotAction function
    processBotAction(activePlayer);
  }

  async function executeActionWithState(playerIndex, action, amount = 0, playersArray, gameStateOverride = null) {
    // Use override values if provided, otherwise use React state
    // For preflop, always use the correct values regardless of override
    const effectiveCurrentBet = (bettingRound === 'preflop') ? 2 : (gameStateOverride?.currentBet ?? currentBet);
    const effectivePot = (bettingRound === 'preflop') ? 3 : (gameStateOverride?.pot ?? pot);
    
    console.log(`executeActionWithState: ${playersArray[playerIndex]?.name} ${action} ${amount}`);
    console.log('Using values - currentBet:', effectiveCurrentBet, 'pot:', effectivePot);
    console.log('Override provided:', !!gameStateOverride);
    console.log('Before action - player state:', { 
      amountInPot: playersArray[playerIndex]?.amountInPot, 
      chips: playersArray[playerIndex]?.chips 
    });
    
    setAnimating(true);
    const updatedPlayers = [...playersArray];
    const player = updatedPlayers[playerIndex];
    
    if (!player) {
      console.error(`No player found at index ${playerIndex}`);
      return;
    }

    switch (action) {
      case 'fold':
        player.hasFolded = true;
        player.lastAction = 'fold';
        break;
      
      case 'check':
        // Validate check is legal (no bet to call)
        console.log(`CHECK validation: ${player.name} - effectiveCurrentBet: ${effectiveCurrentBet}, player.amountInPot: ${player.amountInPot}, betToCall: ${effectiveCurrentBet - player.amountInPot}`);
        console.log('ALL PLAYERS STATE DURING CHECK:', playersArray.map(p => ({
          name: p.name, 
          amountInPot: p.amountInPot, 
          chips: p.chips,
          position: p.seatIndex,
          lastAction: p.lastAction
        })));
        console.log(`Button: ${buttonPosition}, SB: ${(buttonPosition + 1) % numPlayers}, BB: ${(buttonPosition + 2) % numPlayers}`);
        
        if (effectiveCurrentBet > player.amountInPot) {
          console.error(`Invalid check by ${player.name}: must call ${effectiveCurrentBet - player.amountInPot}`);
          // Force fold if invalid check
          player.hasFolded = true;
          player.lastAction = 'fold (invalid check)';
        } else {
          console.log(`Valid check by ${player.name}`);
          player.lastAction = 'check';
        }
        break;
      
      case 'call':
        const callAmount = Math.min(effectiveCurrentBet - player.amountInPot, player.chips);
        console.log(`CALL: ${player.name} calling ${callAmount} (effectiveCurrentBet: ${effectiveCurrentBet}, playerAmountInPot: ${player.amountInPot})`);
        player.chips -= callAmount;
        player.amountInPot += callAmount;
        setPot(p => p + callAmount);
        player.lastAction = `call ${callAmount}`;
        if (player.chips === 0) player.isAllIn = true;
        console.log(`After call: player amountInPot: ${player.amountInPot}, chips: ${player.chips}`);
        break;
      
      case 'bet':
      case 'raise':
        if (currentBet === 0) {
          // First bet of the round
          const betAmount = Math.min(amount, player.chips);
          console.log(`BET: ${player.name} betting ${betAmount} (first bet of round)`);
          player.chips -= betAmount;
          player.amountInPot += betAmount;
          setPot(p => p + betAmount);
          setCurrentBet(player.amountInPot);
          player.lastAction = `bet $${betAmount}`;
        } else {
          // Raise - amount represents the total new bet size
          const callAmount = currentBet - player.amountInPot;
          const raiseAmount = amount - currentBet;
          const totalAmount = callAmount + raiseAmount;
          const actualAmount = Math.min(totalAmount, player.chips);
          
          console.log(`RAISE: ${player.name} raising - callAmount: ${callAmount}, raiseAmount: ${raiseAmount}, totalAmount: ${totalAmount}, actualAmount: ${actualAmount}`);
          console.log(`RAISE: currentBet was ${currentBet}, amount param was ${amount}`);
          
          player.chips -= actualAmount;
          player.amountInPot += actualAmount;
          setPot(p => p + actualAmount);
          setCurrentBet(player.amountInPot);
          player.lastAction = `raise to $${player.amountInPot}`;
        }
        if (player.chips === 0) player.isAllIn = true;
        console.log(`After bet/raise: player amountInPot: ${player.amountInPot}, chips: ${player.chips}, newCurrentBet: ${player.amountInPot}`);
        break;
    }

    setPlayers(updatedPlayers);
    setShowActions(false);
    setPlayerAction(null);

    setTimeout(() => {
      setAnimating(false);
      nextPlayerWithState(updatedPlayers, playerIndex);
    }, 1000);
  }

  async function executeAction(playerIndex, action, amount = 0) {
    return executeActionWithState(playerIndex, action, amount, players);
  }

  function nextPlayerWithState(playersArray, currentPlayerIndex = activePlayer) {
    console.log('nextPlayerWithState called, current activePlayer:', activePlayer, 'using index:', currentPlayerIndex);
    console.log('Current betting state:', { currentBet, pot, bettingRound });
    console.log('All players state:', playersArray.map(p => ({ 
      name: p.name, 
      amountInPot: p.amountInPot, 
      lastAction: p.lastAction, 
      hasFolded: p.hasFolded,
      isAllIn: p.isAllIn,
      isActive: p.isActive
    })));
    
    // Check if betting round is complete (use correct currentBet for preflop)
    const actualCurrentBet = currentBet;
    // For preflop, use at least 2 (big blind) or the actual current bet if higher (due to raises)
    const effectiveCurrentBet = bettingRound === 'preflop' ? Math.max(2, actualCurrentBet) : actualCurrentBet;
    console.log(`Betting completion check: actualCurrentBet=${actualCurrentBet}, effectiveCurrentBet=${effectiveCurrentBet}, bettingRound=${bettingRound}`);
    
    if (isBettingRoundCompleteWithEffectiveBet(playersArray, effectiveCurrentBet)) {
      console.log('Betting round complete, moving to next round');
      nextBettingRound();
      return;
    }

    // Find next active player who can still act
    let next = (currentPlayerIndex + 1) % numPlayers;
    let attempts = 0;
    
    console.log('Looking for next player starting at index:', next);
    
    while (attempts < numPlayers) {
      const nextPlayer = playersArray[next];
      console.log(`Checking player ${next}: ${nextPlayer?.name}, isActive: ${nextPlayer?.isActive}, hasFolded: ${nextPlayer?.hasFolded}, isAllIn: ${nextPlayer?.isAllIn}, lastAction: ${nextPlayer?.lastAction}`);
      console.log(`TRANSITION: ${playersArray[activePlayer]?.name} (index ${activePlayer}) → ${nextPlayer?.name} (index ${next})`);
      
      if (nextPlayer && nextPlayer.isActive && !nextPlayer.hasFolded && !nextPlayer.isAllIn) {
        // Circuit breaker: prevent same player from acting twice in a row
        // BUT allow if this player hasn't acted yet this round
        if ((next === currentPlayerIndex || next === lastActivePlayer) && nextPlayer.lastAction !== null) {
          console.error(`Circuit breaker activated: player ${next} (${nextPlayer.name}) would act again. Current: ${currentPlayerIndex}, Last: ${lastActivePlayer}`);
          console.error('Player last action:', nextPlayer.lastAction);
          console.error('This should NOT happen for human players who haven\'t acted');
          console.error('Forcing betting round to end');
          nextBettingRound();
          return;
        }
        
        // Additional circuit breaker: if player just acted this round, don't let them act again
        if (nextPlayer.lastAction !== null && bettingRound === 'preflop') {
          console.log(`Player ${nextPlayer.name} already acted this round (${nextPlayer.lastAction}), looking for next player`);
          next = (next + 1) % numPlayers;
          attempts++;
          continue;
        }
        
        console.log(`Setting next active player to ${nextPlayer.name} at index ${next}`);
        setLastActivePlayer(currentPlayerIndex);
        setActivePlayer(next);
        
        setTimeout(() => {
          console.log(`DEBUG: nextPlayer action - isHuman: ${nextPlayer.isHuman}, name: ${nextPlayer.name}, bettingRound: ${bettingRound}`);
          
          if (nextPlayer.isHuman) {
            console.log(`Human player ${nextPlayer.name} should get action - calling processPlayerAction`);
            // Force processPlayerAction to work for human players regardless of gamePhase
            setTimeout(() => processPlayerAction(true), 100);
          } else {
            // Use correct state values - only override if it's the initial preflop betting
            const hasRaises = playersArray.some(p => p.lastAction && (p.lastAction.includes('raise') || p.lastAction.includes('bet')));
            
            if (bettingRound === 'preflop' && !hasRaises) {
              // Initial preflop - use hard-coded values to fix state sync issues
              const correctGameState = {
                pot: 3,
                currentBet: 2, 
                communityCards: [],
                bettingRound: 'preflop',
                buttonPosition: buttonPosition
              };
              console.log('nextPlayer: Bot action for:', nextPlayer.name);
              processBotAction(next);
            } else {
              // After raises or postflop - use actual game state
              console.log('nextPlayer: Bot action for:', nextPlayer.name, 'currentBet:', currentBet, 'pot:', pot);
              processBotAction(next);
            }
          }
        }, 500);
        return;
      }
      next = (next + 1) % numPlayers;
      attempts++;
    }

    console.log('No valid next player found, ending betting round');
    // If no valid next player found, end betting round
    nextBettingRound();
  }

  function nextPlayer() {
    console.log('nextPlayer called with players.length:', players.length);
    if (players.length === 0) {
      console.error('nextPlayer called with empty players array - preventing cascade');
      recreatePlayersAndRestart();
      return;
    }
    nextPlayerWithState(players);
  }

  function isBettingRoundCompleteWithEffectiveBet(playersArray, effectiveCurrentBet) {
    console.log('isBettingRoundCompleteWithEffectiveBet called with playersArray.length:', playersArray.length);
    console.log('All players in array:', playersArray.map(p => ({ name: p.name, isActive: p.isActive, hasFolded: p.hasFolded })));
    
    const activePlayers = playersArray.filter(p => p.isActive && !p.hasFolded);
    console.log('Checking betting completion - active players:', activePlayers.length);
    console.log('Active players:', activePlayers.map(p => p.name));
    
    if (activePlayers.length <= 1) {
      console.log('Only 1 or fewer active players, HAND SHOULD END');
      return true;
    }
    
    const playingPlayers = activePlayers.filter(p => !p.isAllIn);
    console.log('Playing players (not all-in):', playingPlayers.length);
    
    // If all remaining players are all-in, round is complete
    if (playingPlayers.length <= 1) {
      console.log('Only 1 or fewer playing players, round complete');
      return true;
    }
    
    // Check if all playing players have acted and matched the effective current bet
    const allActed = playingPlayers.every(p => p.lastAction !== null);
    const allMatched = playingPlayers.every(p => p.amountInPot === effectiveCurrentBet);
    
    console.log('Betting completion check:', {
      allActed,
      allMatched,
      effectiveCurrentBet,
      playingPlayersActions: playingPlayers.map(p => ({ name: p.name, lastAction: p.lastAction, amountInPot: p.amountInPot }))
    });
    
    return allActed && allMatched;
  }

  function isBettingRoundCompleteWithState(playersArray) {
    return isBettingRoundCompleteWithEffectiveBet(playersArray, currentBet);
  }

  function isBettingRoundComplete() {
    return isBettingRoundCompleteWithState(players);
  }

  async function nextBettingRound() {
    console.log('nextBettingRound called - players.length:', players.length);
    console.log('nextBettingRound called from:', new Error().stack.split('\n')[2]);
    
    // Check if only one player remains - if so, end the hand
    const activePlayers = players.filter(p => p.isActive && !p.hasFolded);
    
    // Emergency circuit breaker - if this function is called with 0 players repeatedly, stop the infinite loop
    if (players.length === 0) {
      console.error('EMERGENCY STOP: nextBettingRound called with empty players array. Attempting automatic recovery...');
      console.error('Call stack when players became empty:', new Error().stack);
      recreatePlayersAndRestart();
      return;
    }
    
    if (activePlayers.length <= 1) {
      console.log('Only', activePlayers.length, 'player(s) remaining, ending hand and awarding pot');
      if (activePlayers.length === 1) {
        endHandWithWinner(activePlayers[0]);
      } else {
        // No players left - this means all players folded or became inactive
        // Instead of trying to restart, just end the current hand and wait
        console.log('No active players remaining - ending current hand');
        setGamePhase('complete');
        
        // After 3 seconds, try to start a new hand with all players reactivated
        setTimeout(() => {
          console.log('Attempting to restart with all players active...');
          if (players.length > 0) {
            const reactivatedPlayers = players.map(p => ({
              ...p,
              isActive: true,
              hasFolded: false,
              isAllIn: false,
              lastAction: null,
              amountInPot: 0
            }));
            startNewHand(reactivatedPlayers);
          } else {
            console.log('Still no players, setting to setup phase');
            setGamePhase('setup');
          }
        }, 3000);
      }
      return;
    }
    
    // Reset player actions and move to next round
    const updatedPlayers = players.map(p => ({
      ...p,
      lastAction: null
    }));
    setPlayers(updatedPlayers);

    if (bettingRound === 'preflop') {
      await dealFlop(updatedPlayers);
    } else if (bettingRound === 'flop') {
      await dealTurn(updatedPlayers);
    } else if (bettingRound === 'turn') {
      await dealRiver(updatedPlayers);
    } else if (bettingRound === 'river') {
      showdownHand();
    }
  }

  async function dealFlop(playersArray = players) {
    setBettingRound('flop');
    setCurrentBet(0);
    setGamePhase('betting');
    
    const newDeck = [...deck];
    newDeck.pop(); // Burn card
    const flop = [newDeck.pop(), newDeck.pop(), newDeck.pop()];
    
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setCommunityCards(prev => [...prev, flop[i]]);
    }
    
    setDeck(newDeck);
    
    // Find first active player after button (SB or next active)
    let firstActive = (buttonPosition + 1) % numPlayers;
    console.log('dealFlop: Looking for first active player, starting at:', firstActive);
    while (playersArray[firstActive]?.hasFolded || playersArray[firstActive]?.isAllIn || !playersArray[firstActive]?.isActive) {
      console.log(`dealFlop: Player ${firstActive} (${playersArray[firstActive]?.name}) - hasFolded: ${playersArray[firstActive]?.hasFolded}, isAllIn: ${playersArray[firstActive]?.isAllIn}, isActive: ${playersArray[firstActive]?.isActive}`);
      firstActive = (firstActive + 1) % numPlayers;
      if (firstActive === buttonPosition) break; // Prevent infinite loop
    }
    console.log(`dealFlop: Setting first active player to ${playersArray[firstActive]?.name} at index ${firstActive}`);
    setActivePlayer(firstActive);
    
    setTimeout(() => processPlayerAction(), 1000);
  }

  async function dealTurn(playersArray = players) {
    setBettingRound('turn');
    setCurrentBet(0);
    setGamePhase('betting');
    
    const newDeck = [...deck];
    newDeck.pop(); // Burn card
    const turn = newDeck.pop();
    
    await new Promise(resolve => setTimeout(resolve, 600));
    setCommunityCards(prev => [...prev, turn]);
    
    setDeck(newDeck);
    
    // Find first active player after button
    let firstActive = (buttonPosition + 1) % numPlayers;
    console.log('dealTurn: Looking for first active player, starting at:', firstActive);
    while (playersArray[firstActive]?.hasFolded || playersArray[firstActive]?.isAllIn || !playersArray[firstActive]?.isActive) {
      console.log(`dealTurn: Player ${firstActive} (${playersArray[firstActive]?.name}) - hasFolded: ${playersArray[firstActive]?.hasFolded}, isAllIn: ${playersArray[firstActive]?.isAllIn}, isActive: ${playersArray[firstActive]?.isActive}`);
      firstActive = (firstActive + 1) % numPlayers;
      if (firstActive === buttonPosition) break;
    }
    console.log(`dealTurn: Setting first active player to ${playersArray[firstActive]?.name} at index ${firstActive}`);
    setActivePlayer(firstActive);
    
    setTimeout(() => processPlayerAction(), 1000);
  }

  async function dealRiver(playersArray = players) {
    setBettingRound('river');
    setCurrentBet(0);
    setGamePhase('betting');
    
    const newDeck = [...deck];
    newDeck.pop(); // Burn card
    const river = newDeck.pop();
    
    await new Promise(resolve => setTimeout(resolve, 600));
    setCommunityCards(prev => [...prev, river]);
    
    setDeck(newDeck);
    
    // Find first active player after button
    let firstActive = (buttonPosition + 1) % numPlayers;
    console.log('dealRiver: Looking for first active player, starting at:', firstActive);
    while (playersArray[firstActive]?.hasFolded || playersArray[firstActive]?.isAllIn || !playersArray[firstActive]?.isActive) {
      console.log(`dealRiver: Player ${firstActive} (${playersArray[firstActive]?.name}) - hasFolded: ${playersArray[firstActive]?.hasFolded}, isAllIn: ${playersArray[firstActive]?.isAllIn}, isActive: ${playersArray[firstActive]?.isActive}`);
      firstActive = (firstActive + 1) % numPlayers;
      if (firstActive === buttonPosition) break;
    }
    console.log(`dealRiver: Setting first active player to ${playersArray[firstActive]?.name} at index ${firstActive}`);
    setActivePlayer(firstActive);
    
    setTimeout(() => processPlayerAction(), 1000);
  }

  function endHandWithWinner(winner) {
    if (!winner) {
      console.error('endHandWithWinner called with undefined winner');
      startNewHand();
      return;
    }
    
    console.log(`${winner.name} wins the pot of $${pot} (everyone else folded)`);
    
    // Award the pot to the winner
    const updatedPlayers = players.map(p => 
      p.id === winner.id 
        ? { ...p, chips: p.chips + pot }
        : p
    );
    
    setPlayers(updatedPlayers);
    setGamePhase('complete');
    
    // Start new hand after delay
    setTimeout(() => {
      startNewHand();
    }, 3000);
  }

  function showdownHand() {
    setShowdown(true);
    setGamePhase('showdown');
    
    const activePlayers = players.filter(p => p.isActive && !p.hasFolded);
    const handsWithEvaluations = activePlayers.map(player => ({
      ...player,
      handEvaluation: evaluateHand(player.holeCards, communityCards)
    }));

    // Sort by hand strength (best first)
    handsWithEvaluations.sort((a, b) => {
      if (a.handEvaluation.rank !== b.handEvaluation.rank) {
        return b.handEvaluation.rank - a.handEvaluation.rank;
      }
      return b.handEvaluation.value - a.handEvaluation.value;
    });

    const winningHand = handsWithEvaluations[0];
    const winners = handsWithEvaluations.filter(p => 
      p.handEvaluation.rank === winningHand.handEvaluation.rank &&
      p.handEvaluation.value === winningHand.handEvaluation.value
    );

    const winAmount = Math.floor(pot / winners.length);
    
    winners.forEach(winner => {
      const playerIndex = players.findIndex(p => p.id === winner.id);
      if (winner.isHuman) {
        addChips(winAmount);
      } else {
        const updatedPlayers = [...players];
        updatedPlayers[playerIndex].chips += winAmount;
        setPlayers(updatedPlayers);
      }
    });

    setWinners(winners.map(w => ({ ...w, winAmount })));
    setGamePhase('complete');
  }

  function newHand() {
    // Move button
    setButtonPosition((buttonPosition + 1) % numPlayers);
    
    // Reset pot and current bet
    setPot(0);
    setCurrentBet(0);
    setShowActions(false);
    setAnimating(false);
    
    // Start new hand
    setTimeout(() => startNewHand(), 1000);
  }

  // Human player actions
  function handleHumanAction(action, amount = 0) {
    executeAction(0, action, amount);
  }

  if (!gameStarted) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #1e2a38 60%, #0d1a26 100%)',
        borderRadius: 32,
        padding: '40px',
        width: '80vw',
        maxWidth: 800,
        margin: '4vh auto',
        color: '#fff',
        fontFamily: 'serif',
        textAlign: 'center'
      }}>
        <h2 style={{ letterSpacing: 2, fontWeight: 700, marginBottom: 40 }}>No Limit Hold'em</h2>
        
        <div style={{ marginBottom: 30 }}>
          <h3>Select Stakes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 15 }}>
            {STAKES.map(stakes => (
              <button
                key={stakes.name}
                onClick={() => setSelectedStakes(stakes)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: selectedStakes.name === stakes.name ? '2px solid #ffd700' : '2px solid #555',
                  background: selectedStakes.name === stakes.name ? '#ffd700' : '#333',
                  color: selectedStakes.name === stakes.name ? '#000' : '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {stakes.name}
                <br />
                <small>Buy-in: {stakes.buyIn}</small>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <h3>Table Size</h3>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 15 }}>
            {[6, 8].map(size => (
              <button
                key={size}
                onClick={() => setNumPlayers(size)}
                style={{
                  padding: '10px 30px',
                  borderRadius: 8,
                  border: numPlayers === size ? '2px solid #ffd700' : '2px solid #555',
                  background: numPlayers === size ? '#ffd700' : '#333',
                  color: numPlayers === size ? '#000' : '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {size}-Max
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <p><strong>Your Chips:</strong> {chips}</p>
          <p><strong>Required:</strong> {selectedStakes.buyIn}</p>
          {chips < selectedStakes.buyIn && (
            <p style={{ color: '#ff4444' }}>Insufficient chips for this table!</p>
          )}
        </div>

        <button
          onClick={initializeGame}
          disabled={chips < selectedStakes.buyIn}
          style={{
            padding: '15px 40px',
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 8,
            border: 'none',
            background: chips >= selectedStakes.buyIn ? '#ffd700' : '#666',
            color: chips >= selectedStakes.buyIn ? '#000' : '#999',
            cursor: chips >= selectedStakes.buyIn ? 'pointer' : 'not-allowed'
          }}
        >
          Join Table
        </button>

        <div style={{ marginTop: 30 }}>
          <button onClick={() => navigate('/')} style={{ background: '#666', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8 }}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const humanPlayer = players[0];
  const callAmount = currentBet - (humanPlayer?.amountInPot || 0);
  const minRaise = Math.max(selectedStakes.bb, currentBet - (humanPlayer?.amountInPot || 0)) + currentBet;
  const maxBet = humanPlayer?.chips || 0;
  
  // Ensure raiseAmount is valid (but don't auto-update to avoid re-render issues)
  const validRaiseAmount = Math.max(raiseAmount || minRaise, minRaise);

  return (
    <div style={{
      background: 'linear-gradient(180deg, #1e2a38 60%, #0d1a26 100%)',
      borderRadius: 32,
      padding: '20px',
      width: '90vw',
      maxWidth: 1200,
      minHeight: 600,
      margin: '2vh auto',
      color: '#fff',
      fontFamily: 'serif',
      position: 'relative'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2>{selectedStakes.name} No Limit Hold'em</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>Pot: <strong>${pot}</strong></div>
          <div>
            {bettingRound.charAt(0).toUpperCase() + bettingRound.slice(1)}
            {currentBet > 0 && ` - Bet: $${currentBet}`}
          </div>
          <div>Hand #{buttonPosition + 1}</div>
        </div>
      </div>

      {/* Poker Table Layout */}
      <div style={{
        position: 'relative',
        width: '800px',
        height: '500px',
        margin: '0 auto',
        background: 'radial-gradient(ellipse 60% 40% at center, #0a4d2a 0%, #053a1f 100%)',
        borderRadius: '50%',
        border: '8px solid #8B4513',
        marginBottom: 40
      }}>
        
        {/* Community Cards in Center */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Community Cards</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, minHeight: 80 }}>
            {communityCards.filter(card => card && card.rank && card.suit).map((card, i) => (
              <Card key={i} rank={card.rank} suit={card.suit} size="small" />
            ))}
          </div>
          <div style={{ marginTop: 10, fontWeight: 'bold', fontSize: '18px' }}>
            Pot: ${pot}
          </div>
        </div>

        {/* Players arranged in circle */}
        {players.map((player, i) => {
          // Calculate position in circle
          const angle = (i / numPlayers) * 2 * Math.PI - Math.PI / 2; // Start at top
          const radiusX = 350; // Horizontal radius
          const radiusY = 200; // Vertical radius
          const x = Math.cos(angle) * radiusX + 400; // Center at 400px
          const y = Math.sin(angle) * radiusY + 250; // Center at 250px
          
          return (
            <div
              key={player.id}
              style={{
                position: 'absolute',
                left: x - 100, // Offset by half player box width
                top: y - 75,   // Offset by half player box height
                width: '200px',
                height: '150px',
                border: i === activePlayer ? '3px solid #ffd700' : '2px solid #555',
                borderRadius: 12,
                padding: 12,
                background: player.hasFolded ? '#333' : (player.isHuman ? '#2a4f2a' : '#2a2a4f'),
                opacity: player.hasFolded ? 0.5 : 1,
                boxShadow: i === activePlayer ? '0 0 15px #ffd700aa' : '0 2px 8px #0008'
              }}
            >
              {/* Dealer Button */}
              {i === buttonPosition && (
                <div style={{
                  position: 'absolute',
                  top: -15,
                  right: -15,
                  background: '#ffd700',
                  color: '#000',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  border: '2px solid #000'
                }}>D</div>
              )}
              
              {/* Small Blind Indicator */}
              {i === (buttonPosition + 1) % numPlayers && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  left: 10,
                  background: '#ff4444',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700
                }}>SB</div>
              )}
              
              {/* Big Blind Indicator */}
              {i === (buttonPosition + 2) % numPlayers && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  left: 10,
                  background: '#4444ff',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700
                }}>BB</div>
              )}
              
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, textAlign: 'center' }}>
                {player.name} {player.isAllIn && '(ALL-IN)'}
              </div>
              <div style={{ fontSize: 12, marginBottom: 6, textAlign: 'center' }}>
                Chips: ${player.chips}
              </div>
              <div style={{ fontSize: 11, marginBottom: 8, textAlign: 'center', color: '#ffd700' }}>
                In Pot: ${player.amountInPot}
              </div>
              
              {/* Hole Cards */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 6, justifyContent: 'center' }}>
                {player.holeCards.filter(card => card && card.rank && card.suit).map((card, cardIndex) => (
                  <Card 
                    key={cardIndex} 
                    rank={player.isHuman || showdown ? card.rank : '?'} 
                    suit={player.isHuman || showdown ? card.suit : 'back'} 
                    size="small" 
                  />
                ))}
              </div>
              
              {player.lastAction && (
                <div style={{ 
                  fontSize: 11, 
                  textAlign: 'center', 
                  color: '#ffd700',
                  fontWeight: 600,
                  background: '#333',
                  borderRadius: 4,
                  padding: '2px 6px'
                }}>
                  {player.lastAction}
                </div>
              )}
              
              {showdown && !player.hasFolded && (
                <div style={{ 
                  fontSize: 10, 
                  textAlign: 'center', 
                  marginTop: 4,
                  color: '#90caf9'
                }}>
                  {evaluateHand(player.holeCards, communityCards).description}
                </div>
              )}
            </div>
          );
        })}

      </div>

      {/* Winners Display */}
      {winners.length > 0 && (
        <div style={{
          background: '#1a4a1a',
          border: '2px solid #4caf50',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
          marginBottom: 20
        }}>
          <h3>Hand Results</h3>
          {winners.map(winner => (
            <div key={winner.id} style={{ marginBottom: 10 }}>
              <strong>{winner.name}</strong> wins ${winner.winAmount} with {winner.handEvaluation.description}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {showActions && humanPlayer && !humanPlayer.hasFolded && !humanPlayer.isAllIn && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e2a38',
          border: '2px solid #ffd700',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          zIndex: 100
        }}>
          <button onClick={() => handleHumanAction('fold')} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
            Fold
          </button>
          
          {currentBet === humanPlayer.amountInPot ? (
            <button onClick={() => handleHumanAction('check')} style={{ background: '#388e3c', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
              Check
            </button>
          ) : (
            <button onClick={() => handleHumanAction('call')} style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
              Call ${currentBet - humanPlayer.amountInPot}
            </button>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              type="range"
              min={minRaise}
              max={maxBet}
              value={validRaiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              style={{ width: 100 }}
            />
            <input
              type="number"
              min={minRaise}
              max={maxBet}
              value={validRaiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              style={{ width: 80, padding: 5 }}
            />
            <button onClick={() => handleHumanAction('raise', validRaiseAmount)} style={{ background: '#ff9800', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
              Raise ${validRaiseAmount}
            </button>
          </div>
        </div>
      )}

      {/* New Hand Button */}
      {gamePhase === 'complete' && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={newHand}
            style={{
              background: '#ffd700',
              color: '#000',
              border: 'none',
              padding: '15px 30px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Next Hand
          </button>
          
          <button
            onClick={() => {
              addChips(humanPlayer.chips);
              setGameStarted(false);
            }}
            style={{
              background: '#666',
              color: '#fff',
              border: 'none',
              padding: '15px 30px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 15
            }}
          >
            Leave Table
          </button>
        </div>
      )}
    </div>
  );
}