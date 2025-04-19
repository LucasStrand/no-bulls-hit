
import { useGameStore } from "../store/gameStore";
import { Card, CardContent } from "./ui/card";

const CurrentTurn = () => {
  const { currentTurn, dartsRemaining, getCurrentPlayer, gameFinished } = useGameStore();
  
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer || gameFinished) return null;
  
  const dartSlots = [0, 1, 2]; // 3 darts per turn
  const dartThrown = 3 - dartsRemaining;
  
  // Calculate turn total
  const turnTotal = currentTurn.reduce((sum, dart) => sum + dart.points, 0);
  
  // Check for potential bust
  const potentialBust = currentPlayer.score - turnTotal < 2;
  
  return (
    <Card className={`mt-4 ${potentialBust && currentTurn.length > 0 ? "border-red-500" : ""}`}>
      <CardContent className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium">Current Turn</div>
          <div className="text-xs text-muted-foreground">
            {currentPlayer.name}'s throw
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {dartSlots.map((slot) => (
              <div 
                key={slot}
                className={`w-12 h-12 border rounded-md flex items-center justify-center font-mono ${
                  slot < dartThrown 
                    ? "bg-muted" 
                    : "border-dashed border-muted"
                }`}
              >
                {slot < dartThrown && (
                  <DartDisplay dart={currentTurn[slot]} />
                )}
              </div>
            ))}
          </div>
          
          <div className={`text-xl font-bold ${potentialBust && currentTurn.length > 0 ? "text-red-500" : ""}`}>
            {turnTotal}
            {potentialBust && currentTurn.length > 0 && (
              <div className="text-xs font-normal text-red-500 mt-1">Potential bust!</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Component to display a dart score
const DartDisplay = ({ dart }: { dart: { segment: number; multiplier: number; points: number } }) => {
  let display = "";
  
  if (dart.segment === 25) {
    display = dart.multiplier === 2 ? "BULL" : "25";
  } else {
    if (dart.multiplier === 3) {
      display = `T${dart.segment}`;
    } else if (dart.multiplier === 2) {
      display = `D${dart.segment}`;
    } else {
      display = `${dart.segment}`;
    }
  }
  
  return <span className="text-sm font-bold">{display}</span>;
};

export default CurrentTurn;
