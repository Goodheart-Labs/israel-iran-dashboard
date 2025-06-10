import { useEffect, useState } from "react";

export function RunningCat() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState({ x: 2, y: 1 });
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    // Update container size based on window
    const updateSize = () => {
      setContainerSize({
        width: Math.max(1000, window.innerWidth - 100),
        height: Math.max(600, window.innerHeight - 200)
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(prev => {
        let newX = prev.x + direction.x;
        let newY = prev.y + direction.y;
        let newDirX = direction.x;
        let newDirY = direction.y;

        // Bounce off walls
        if (newX <= 0 || newX >= containerSize.width - 60) {
          newDirX = -direction.x;
          newX = Math.max(0, Math.min(containerSize.width - 60, newX));
        }
        if (newY <= 0 || newY >= containerSize.height - 60) {
          newDirY = -direction.y;
          newY = Math.max(0, Math.min(containerSize.height - 60, newY));
        }

        // Update direction if bounced
        if (newDirX !== direction.x || newDirY !== direction.y) {
          setDirection({ x: newDirX, y: newDirY });
        }

        return { x: newX, y: newY };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [direction, containerSize]);

  const isMovingRight = direction.x > 0;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: containerSize.width, height: containerSize.height }}
    >
      <div
        className="absolute transition-transform duration-75 text-4xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: isMovingRight ? 'scaleX(1)' : 'scaleX(-1)',
        }}
      >
        🐱
      </div>
    </div>
  );
}