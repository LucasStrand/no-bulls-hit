
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { Users, User, X, Plus } from 'lucide-react';

const GameSetup = () => {
  const { 
    gameMode,
    players,
    legsToWin,
    setGameMode,
    setLegsToWin,
    addPlayer,
    removePlayer,
    resetPlayers,
    startGame
  } = useGameStore();
  
  const [newPlayerName, setNewPlayerName] = useState('');

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      addPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handlePlayerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPlayer();
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Bullseye Blitz Tracker</CardTitle>
          <CardDescription className="text-center">Configure your darts game</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Game Mode Selection */}
          <div className="space-y-2">
            <Label htmlFor="gameMode" className="text-lg font-medium">Game Mode</Label>
            <RadioGroup 
              id="gameMode" 
              value={gameMode.toString()}
              onValueChange={(value) => setGameMode(parseInt(value) as 301 | 501)}
              className="flex justify-center gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="301" id="r301" />
                <Label htmlFor="r301" className="cursor-pointer">301</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="501" id="r501" />
                <Label htmlFor="r501" className="cursor-pointer">501</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Legs to Win */}
          <div className="space-y-2">
            <Label htmlFor="legsToWin" className="text-lg font-medium">Legs to Win</Label>
            <RadioGroup 
              id="legsToWin" 
              value={legsToWin.toString()}
              onValueChange={(value) => setLegsToWin(parseInt(value))}
              className="flex justify-center flex-wrap gap-4"
            >
              {[1, 3, 5, 7].map(num => (
                <div key={num} className="flex items-center space-x-2">
                  <RadioGroupItem value={num.toString()} id={`l${num}`} />
                  <Label htmlFor={`l${num}`} className="cursor-pointer">{num}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Player Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-medium">Players</Label>
              <div className="flex items-center gap-2">
                <Users size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {players.length} player{players.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Player List */}
            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
              {players.map(player => (
                <div 
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>{player.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => removePlayer(player.id)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Player Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add player..."
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={handlePlayerKeyDown}
                className="flex-1"
              />
              <Button onClick={handleAddPlayer} size="icon">
                <Plus size={18} />
              </Button>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2">
          <Button 
            className="w-full" 
            disabled={players.length < 1}
            onClick={startGame}
          >
            Start Game
          </Button>
          
          {players.length > 0 && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={resetPlayers}
            >
              Reset Players
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default GameSetup;
