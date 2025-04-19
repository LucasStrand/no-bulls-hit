
import { useGameStore } from "../store/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Trophy, RotateCcw, FileBarChart } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "./ui/dialog";

const GameFinished = () => {
  const { players, gameFinished, resetGame, legsToWin } = useGameStore();
  const [showStats, setShowStats] = useState(false);
  
  if (!gameFinished) return null;
  
  // Find the winner
  const winner = players.reduce((max, p) => p.legsWon > max.legsWon ? p : max, players[0]);
  
  return (
    <>
      <Card className="animate-fade-in border-primary/50 bg-card/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Trophy className="text-yellow-500" size={24} />
            Game Finished
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="pt-2 pb-6">
            <h3 className="text-2xl font-bold text-primary mb-1">{winner.name} wins!</h3>
            <p className="text-muted-foreground text-sm">
              Won {winner.legsWon} of {legsToWin} legs
            </p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setShowStats(true)}>
              <FileBarChart size={18} className="mr-2" />
              Game Stats
            </Button>
            <Button onClick={resetGame}>
              <RotateCcw size={18} className="mr-2" />
              New Game
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <GameStatsDialog open={showStats} onOpenChange={setShowStats} />
    </>
  );
};

const GameStatsDialog = ({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) => {
  const { players, gameMode } = useGameStore();
  
  // Calculate stats
  const playerStats = players.map(player => {
    // Calculate average score per turn
    const totalScore = player.history.reduce((sum, turn) => sum + turn.score, 0);
    const avgScore = player.history.length > 0 
      ? Math.round(totalScore / player.history.length) 
      : 0;
    
    // Calculate highest score in one turn
    const highestScore = player.history.length > 0 
      ? Math.max(...player.history.map(turn => turn.score))
      : 0;
    
    // Calculate bust percentage
    const bustCount = player.history.filter(turn => turn.bust).length;
    const bustPercentage = player.history.length > 0
      ? Math.round((bustCount / player.history.length) * 100)
      : 0;
    
    return {
      name: player.name,
      legsWon: player.legsWon,
      avgScore,
      highestScore,
      bustPercentage,
      dartsThrown: player.dartsThrown
    };
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Game Statistics - {gameMode}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          {playerStats.map((stats, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-muted py-2 px-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{stats.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {stats.legsWon} {stats.legsWon === 1 ? 'leg' : 'legs'} won
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Avg. Score:</div>
                  <div className="font-medium text-right">{stats.avgScore}</div>
                  
                  <div className="text-muted-foreground">Best Score:</div>
                  <div className="font-medium text-right">{stats.highestScore}</div>
                  
                  <div className="text-muted-foreground">Bust %:</div>
                  <div className="font-medium text-right">{stats.bustPercentage}%</div>
                  
                  <div className="text-muted-foreground">Darts Thrown:</div>
                  <div className="font-medium text-right">{stats.dartsThrown}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GameFinished;
