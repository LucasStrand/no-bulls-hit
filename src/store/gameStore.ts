import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  GameState, 
  GameMode, 
  PlayerState, 
  DartScore, 
  Turn,
  CHECKOUT_SUGGESTIONS 
} from '../types/game';

const DEFAULT_DARTS_PER_TURN = 3;

interface GameStore extends GameState {
  // Setup actions
  setGameMode: (mode: GameMode) => void;
  setLegsToWin: (legs: number) => void;
  addPlayer: (name: string) => void;
  removePlayer: (id: number) => void;
  resetPlayers: () => void;
  
  // Game actions
  startGame: () => void;
  resetGame: () => void;
  registerDart: (dart: DartScore) => void;
  endTurn: () => void;
  undoLastDart: () => void;
  
  // Getters
  getCurrentPlayer: () => PlayerState | undefined;
  getCheckoutSuggestion: (score: number) => string | undefined;
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      gameMode: 501,
      players: [],
      legsToWin: 3,
      currentPlayerIndex: 0,
      dartsRemaining: DEFAULT_DARTS_PER_TURN,
      gameStarted: false,
      gameFinished: false,
      currentTurn: [],

      // Setup actions
      setGameMode: (mode: GameMode) => set({ gameMode: mode }),
      
      setLegsToWin: (legs: number) => set({ legsToWin: legs }),
      
      addPlayer: (name: string) => {
        const { players, gameMode } = get();
        const newPlayer: PlayerState = {
          id: players.length + 1,
          name,
          score: gameMode,
          initialScore: gameMode,
          dartsThrown: 0,
          legsWon: 0,
          currentTurn: false,
          history: [],
        };
        
        set({ players: [...players, newPlayer] });
      },
      
      removePlayer: (id: number) => {
        set(state => ({
          players: state.players.filter(player => player.id !== id)
        }));
      },
      
      resetPlayers: () => set({ players: [] }),
      
      // Game actions
      startGame: () => {
        const { gameMode, players } = get();
        if (players.length === 0) return;
        
        const updatedPlayers = players.map((player, index) => ({
          ...player,
          score: gameMode,
          initialScore: gameMode,
          dartsThrown: 0,
          currentTurn: index === 0,
          history: [],
        }));
        
        set({
          players: updatedPlayers,
          currentPlayerIndex: 0,
          dartsRemaining: DEFAULT_DARTS_PER_TURN,
          gameStarted: true,
          gameFinished: false,
          currentTurn: [],
        });
      },
      
      resetGame: () => {
        const { players, gameMode } = get();
        
        const resetPlayers = players.map(player => ({
          ...player,
          score: gameMode,
          initialScore: gameMode,
          dartsThrown: 0,
          legsWon: 0,
          currentTurn: false,
          history: [],
        }));
        
        resetPlayers[0].currentTurn = true;
        
        set({
          players: resetPlayers,
          currentPlayerIndex: 0,
          dartsRemaining: DEFAULT_DARTS_PER_TURN,
          gameStarted: false,
          gameFinished: false,
          currentTurn: [],
        });
      },
      
      registerDart: (dart: DartScore) => {
        const { 
          players, 
          currentPlayerIndex, 
          dartsRemaining, 
          currentTurn 
        } = get();
        
        if (dartsRemaining <= 0 || !players.length) return;
        
        const currentPlayer = players[currentPlayerIndex];
        const newScore = currentPlayer.score - dart.points;
        
        // Check if bust (score < 0 or score = 1 or unable to finish on double)
        const isBust = newScore < 0 || newScore === 1 || (newScore === 0 && dart.multiplier !== 2);
        
        const updatedCurrentTurn = [...currentTurn, dart];
        
        if (isBust) {
          // Bust - register the dart but don't change score
          set({
            currentTurn: updatedCurrentTurn,
            dartsRemaining: dartsRemaining - 1,
          });
          
          // If it was the last dart of the turn, end turn
          // if (dartsRemaining === 1) { // Removed auto end turn
          //   get().endTurn();
          // }
          return;
        }
        
        // Valid dart - update player score
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayerIndex] = {
          ...currentPlayer,
          score: newScore,
          dartsThrown: currentPlayer.dartsThrown + 1,
        };
        
        // Check for leg win
        if (newScore === 0) {
          updatedPlayers[currentPlayerIndex].legsWon += 1;
          
          // Check for game win
          if (updatedPlayers[currentPlayerIndex].legsWon >= get().legsToWin) {
            set({
              players: updatedPlayers,
              currentTurn: updatedCurrentTurn,
              gameFinished: true,
              dartsRemaining: 0,
            });
            return;
          }
          
          // Leg completed - setup for next leg
          const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
          
          const playersForNextLeg = updatedPlayers.map((player, index) => ({
            ...player,
            score: get().gameMode,
            currentTurn: index === nextPlayerIndex,
            history: [],
          }));
          
          set({
            players: playersForNextLeg,
            currentPlayerIndex: nextPlayerIndex,
            dartsRemaining: DEFAULT_DARTS_PER_TURN,
            currentTurn: [],
          });
          
          return;
        }
        
        // Continue the turn
        set({
          players: updatedPlayers,
          currentTurn: updatedCurrentTurn, 
          dartsRemaining: dartsRemaining - 1,
        });
        
        // If it was the last dart of the turn, end turn
        // if (dartsRemaining === 1) { // Removed auto end turn
        //   get().endTurn();
        // }
      },
      
      endTurn: () => {
        const { 
          players, 
          currentPlayerIndex, 
          currentTurn
        } = get();
        
        if (!players.length) return;
        
        // Calculate total score for the turn
        const turnScore = currentTurn.reduce((sum, dart) => sum + dart.points, 0);
        
        // Check if bust
        const currentPlayer = players[currentPlayerIndex];
        const finalScore = currentPlayer.score;
        const isBust = finalScore !== currentPlayer.initialScore - turnScore;
        
        // Create turn history entry
        const turnHistory: Turn = {
          darts: [...currentTurn],
          score: turnScore,
          remainingScore: isBust ? currentPlayer.initialScore : finalScore,
          bust: isBust
        };
        
        // Update player history
        const updatedPlayers = [...players];
        
        const playerWithHistory = {
          ...currentPlayer,
          history: [...currentPlayer.history, turnHistory],
          currentTurn: false,
          initialScore: isBust ? currentPlayer.initialScore : finalScore
        };
        
        updatedPlayers[currentPlayerIndex] = playerWithHistory;
        
        // Move to next player
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        updatedPlayers[nextPlayerIndex].currentTurn = true;
        
        set({
          players: updatedPlayers,
          currentPlayerIndex: nextPlayerIndex,
          dartsRemaining: DEFAULT_DARTS_PER_TURN,
          currentTurn: [],
        });
        
        // If it was the last dart of the turn, end turn
        // if (dartsRemaining === 1) { // Removed auto end turn
        //   get().endTurn();
        // }
      },
      
      undoLastDart: () => {
        const { currentTurn, dartsRemaining, players, currentPlayerIndex } = get();
        
        if (!currentTurn.length || !players.length) return;
        
        // Remove the last dart
        const updatedCurrentTurn = [...currentTurn];
        const removedDart = updatedCurrentTurn.pop();
        
        if (!removedDart) return;
        
        // Revert player score
        const currentPlayer = players[currentPlayerIndex];
        const updatedScore = currentPlayer.score + removedDart.points;
        
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayerIndex] = {
          ...currentPlayer,
          score: updatedScore,
          dartsThrown: Math.max(0, currentPlayer.dartsThrown - 1),
        };
        
        set({
          players: updatedPlayers,
          currentTurn: updatedCurrentTurn,
          dartsRemaining: dartsRemaining + 1,
        });
      },
      
      // Getters
      getCurrentPlayer: () => {
        const { players, currentPlayerIndex } = get();
        return players[currentPlayerIndex];
      },
      
      getCheckoutSuggestion: (score: number) => {
        if (score > 170) return undefined;
        
        const suggestions = CHECKOUT_SUGGESTIONS[score];
        if (!suggestions || !suggestions.length) return undefined;
        
        // Return first suggestion formatted as a string
        return suggestions[0].darts.join(' → ');
      },
    }),
    { name: 'game-store' }
  )
);
