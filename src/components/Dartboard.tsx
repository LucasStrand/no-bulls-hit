
import { useState, useRef, useCallback, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { generateSegments } from "../utils/dartboard/segmentUtils";
import { calculateScore } from "../utils/dartboard/scoreCalculator";
import { generateHitMarks } from "../utils/dartboard/hitMarkUtils";
import { DARTBOARD_CONFIG } from "../utils/dartboard/dartboardConfig";

const Dartboard = () => {
  const { registerDart, currentTurn, dartsRemaining } = useGameStore();
  const boardRef = useRef<SVGSVGElement>(null);
  const [hitMarks, setHitMarks] = useState<{ x: number; y: number; dartIndex: number }[]>([]);

  // Clear hit marks when a new turn starts
  useEffect(() => {
    if (dartsRemaining === 3) {
      setHitMarks([]);
    }
  }, [dartsRemaining]);

  const handleBoardClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!boardRef.current || dartsRemaining === 0) return;
    
    const svgRect = boardRef.current.getBoundingClientRect();
    
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;
    
    const viewBoxWidth = DARTBOARD_CONFIG.SVG_SIZE;
    const viewBoxHeight = DARTBOARD_CONFIG.SVG_SIZE;
    const scaleX = viewBoxWidth / svgRect.width;
    const scaleY = viewBoxHeight / svgRect.height;
    
    const viewBoxX = clickX * scaleX;
    const viewBoxY = clickY * scaleY;
    
    const dx = viewBoxX - DARTBOARD_CONFIG.CENTER.x;
    const dy = viewBoxY - DARTBOARD_CONFIG.CENTER.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= DARTBOARD_CONFIG.OUTER_BORDER_RADIUS) {
      const dartIndex = 3 - dartsRemaining;
      
      setHitMarks(prev => [
        ...prev, 
        { x: viewBoxX, y: viewBoxY, dartIndex }
      ]);
      
      const dartScore = calculateScore(viewBoxX, viewBoxY);
      registerDart(dartScore);
    }
  }, [calculateScore, registerDart, dartsRemaining]);

  const segments = generateSegments();
  const marks = generateHitMarks(hitMarks);

  return (
    <div className="flex justify-center items-center my-4 relative">
      <svg
        ref={boardRef}
        viewBox={`0 0 ${DARTBOARD_CONFIG.SVG_SIZE} ${DARTBOARD_CONFIG.SVG_SIZE}`}
        className="max-w-full max-h-[80vh] cursor-crosshair touch-action-none"
        onClick={handleBoardClick}
      >
        {segments.map((segment, idx) => {
          switch (segment.type) {
            case 'circle':
              return <circle key={`segment-${idx}`} {...segment.props} />;
            case 'path':
              return <path key={`segment-${idx}`} {...segment.props} />;
            case 'line':
              return <line key={`segment-${idx}`} {...segment.props} />;
            default:
              return null;
          }
        })}
        
        {marks.map((mark, idx) => (
          <g key={`hit-mark-${idx}`}>
            <circle {...mark.circle} />
            <text
              x={mark.text.x}
              y={mark.text.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#000"
              fontSize="9"
              fontWeight="bold"
            >
              {mark.text.content}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default Dartboard;
