
import { useGameStore } from "../store/gameStore";
import GameSetup from "../components/GameSetup";
import Dartboard from "../components/Dartboard";
import GameControls from "../components/GameControls";
import PlayerScores from "../components/PlayerScores";
import CurrentTurn from "../components/CurrentTurn";
import GameFinished from "../components/GameFinished";

const GameScreen = () => {
  const { gameFinished, getCurrentPlayer } = useGameStore();
  const currentPlayer = getCurrentPlayer();
  
  return (
    <div className="container px-4 py-6 max-w-5xl mx-auto">
      {/* Game header */}
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Bullseye Blitz Tracker</h1>
        {!gameFinished && currentPlayer && (
          <div className="mt-2 text-muted-foreground">
            <span className="font-medium text-primary">{currentPlayer.name}'s</span> turn
          </div>
        )}
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Player scores */}
        <div className="md:order-1">
          <PlayerScores />
        </div>
        
        {/* Center column - Dartboard */}
        <div className="md:order-2 md:col-span-2">
          <Dartboard />
          
          {/* Game controls */}
          <div className="mt-4">
            <GameControls />
          </div>
          
          {/* Current turn display */}
          <CurrentTurn />
          
          {/* Game finished overlay */}
          {gameFinished && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4">
              <GameFinished />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const { gameStarted } = useGameStore();
  
  return gameStarted ? <GameScreen /> : <GameSetup />;
};

export default Index;
