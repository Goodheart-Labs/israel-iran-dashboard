import { useEffect, useState, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_FOOD = { x: 15, y: 15 };
const INITIAL_DIRECTION = { x: 0, y: -1 };

export function Snake() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(INITIAL_FOOD);
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood(INITIAL_FOOD);
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
    setIsPlaying(true);
  };

  const generateFood = useCallback((): Position => {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    return { x, y };
  }, []);

  const moveSnake = useCallback(() => {
    if (gameOver || !isPlaying) return;

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };
      
      head.x += direction.x;
      head.y += direction.y;

      // Check walls
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        setIsPlaying(false);
        return currentSnake;
      }

      // Check self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setIsPlaying(false);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood());
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, isPlaying, generateFood]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameInterval = setInterval(moveSnake, 150);
    return () => clearInterval(gameInterval);
  }, [moveSnake, isPlaying]);

  return (
    <div className="flex flex-col items-center p-4 bg-base-200 rounded-lg">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-bold mb-2">Snake Game</h3>
        <div className="flex gap-4 items-center justify-center mb-2">
          <span className="text-sm">Score: {score}</span>
          {!isPlaying && !gameOver && (
            <button className="btn btn-primary btn-sm" onClick={resetGame}>
              Start Game
            </button>
          )}
          {gameOver && (
            <button className="btn btn-secondary btn-sm" onClick={resetGame}>
              Play Again
            </button>
          )}
        </div>
        {isPlaying && (
          <p className="text-xs opacity-70">Use arrow keys to control</p>
        )}
        {gameOver && (
          <p className="text-sm text-error">Game Over!</p>
        )}
      </div>
      
      <div 
        className="relative bg-base-300 border-2 border-base-content/20"
        style={{
          width: `${GRID_SIZE * 16}px`,
          height: `${GRID_SIZE * 16}px`,
        }}
      >
        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute ${index === 0 ? 'bg-success' : 'bg-success/80'}`}
            style={{
              left: `${segment.x * 16}px`,
              top: `${segment.y * 16}px`,
              width: '14px',
              height: '14px',
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
        ))}
        
        {/* Food */}
        <div
          className="absolute bg-error rounded-full"
          style={{
            left: `${food.x * 16}px`,
            top: `${food.y * 16}px`,
            width: '14px',
            height: '14px',
          }}
        />
      </div>
    </div>
  );
}