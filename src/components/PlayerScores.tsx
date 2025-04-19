
import { useMemo } from "react";
import { useGameStore } from "../store/gameStore";
import { Card, CardContent } from "./ui/card";
import { CHECKOUT_SUGGESTIONS } from "../types/game";
import { Target } from "lucide-react";

const PlayerScores = () => {
  const { players, gameMode, legsToWin, currentPlayerIndex, gameFinished } = useGameStore();
  
  // Get checkout suggestions for current player
  const checkoutSuggestion = useMemo(() => {
    if (!players.length || gameFinished) return null;
    
    const currentPlayer = players[currentPlayerIndex];
    const score = currentPlayer.score;
    
    // Only show suggestion if score is in checkout range (≤170)
    if (score > 170 || score <= 1) return null;
    
    return CHECKOUT_SUGGESTIONS[score]?.[0];
  }, [players, currentPlayerIndex, gameFinished]);
  
  if (!players.length) return null;
  
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <div className="text-sm text-muted-foreground">
          Leg {players.reduce((sum, p) => sum + p.legsWon, 0) + 1} / {legsToWin * players.length}
        </div>
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Target size={20} className="text-primary" />
          <span>{gameMode === 301 ? "301" : "501"}</span>
        </h2>
      </div>
      
      {/* Display checkout suggestion if available */}
      {checkoutSuggestion && (
        <Card className="bg-green-900 border-green-700 mb-4 animate-scale">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-green-300 uppercase font-bold mb-1">Checkout Suggestion</div>
            <div className="font-mono text-sm md:text-base font-bold text-white">
              {checkoutSuggestion.darts.join(' → ')}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Player scorecards */}
      <div className="grid gap-3">
        {players.map((player, index) => {
          const isCurrentPlayer = index === currentPlayerIndex;
          
          return (
            <Card 
              key={player.id}
              className={`transition-all duration-300 ${
                isCurrentPlayer 
                  ? "border-primary bg-primary/10 shadow-md" 
                  : "border-border bg-card"
              }`}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        isCurrentPlayer ? "bg-primary animate-pulse" : "bg-muted"
                      }`}
                    />
                    <span className="font-medium">{player.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      Legs: {player.legsWon}/{legsToWin}
                    </div>
                    <div className={`text-lg md:text-xl font-bold ${
                      player.score <= 100 ? "text-primary" : ""
                    }`}>
                      {player.score}
                    </div>
                  </div>
                </div>
                
                {/* Additional stats */}
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <div>Darts: {player.dartsThrown}</div>
                  
                  {/* Last 3 scores */}
                  {player.history.length > 0 && (
                    <div className="flex gap-1">
                      <span>Last:</span>
                      {player.history.slice(-3).map((turn, i) => (
                        <span 
                          key={i}
                          className={`${turn.bust ? "line-through text-red-500" : ""} ${
                            turn.score > 100 ? "text-primary" : ""
                          }`}
                        >
                          {turn.score}
                        </span>
                      )).reverse()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerScores;
