import { useGameStore } from "../store/gameStore";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ArrowLeftCircle, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { useToast } from "../hooks/use-toast";
// import PlayerScores from "./PlayerScores";
import CurrentTurn from "./CurrentTurn";
// import { ScoreHistory } from "./ScoreHistory";

const GameControls = () => {
  const { 
    endTurn, 
    undoLastDart,
    resetGame,
    gameFinished,
    getCurrentPlayer,
    dartsRemaining
  } = useGameStore();
  
  const { toast } = useToast();
  
  const currentPlayer = getCurrentPlayer();
  
  const handleEndTurn = () => {
    endTurn();
    toast({
      title: "Turn ended",
      description: "Next player's turn",
      duration: 2000,
    });
  };
  
  const handleUndoLastDart = () => {
    undoLastDart();
    toast({
      title: "Dart undone",
      description: "Last dart removed",
      duration: 2000,
    });
  };
  
  const handleNewGame = () => {
    if (!gameFinished) {
      const confirmReset = window.confirm("Are you sure you want to reset the game?");
      if (!confirmReset) return;
    }
    
    resetGame();
    toast({
      title: "Game reset",
      description: "Starting a new game",
      duration: 2000,
    });
  };
  
  return (
    <Card className="p-4 shadow-md">
      <div className="flex justify-between items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleUndoLastDart}
          disabled={!currentPlayer || dartsRemaining === 3}
          title="Undo Last Dart"
        >
          <ArrowLeftCircle size={20} />
        </Button>
        
        <Button 
          variant="default"
          onClick={handleEndTurn}
          disabled={!currentPlayer || dartsRemaining === 3 || gameFinished}
        >
          {dartsRemaining === 0 ? "Next Player" : "End Turn"}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleNewGame}
          title={gameFinished ? "New Game" : "Reset Game"}
        >
          <RotateCcw size={20} />
        </Button>
      </div>
      {/* <PlayerScores /> */}
      <CurrentTurn />
      {/* <ScoreHistory /> */}
    </Card>
  );
};

export default GameControls;
