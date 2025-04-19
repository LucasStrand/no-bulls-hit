
import { DARTBOARD_CONFIG, DARTBOARD_NUMBERS } from './dartboardConfig';

export const generateSegments = () => {
  const segments = [];
  const { 
    CENTER, 
    OUTER_BORDER_RADIUS, 
    DOUBLE_RING_INNER_RADIUS,
    DOUBLE_RING_OUTER_RADIUS,
    TRIPLE_RING_INNER_RADIUS, 
    TRIPLE_RING_OUTER_RADIUS,
    OUTER_BULL_RADIUS,
    INNER_BULL_RADIUS,
    WIRE_WIDTH,
    ROTATION_OFFSET 
  } = DARTBOARD_CONFIG;

  // Background circle
  segments.push({
    type: 'circle',
    props: {
      cx: CENTER.x,
      cy: CENTER.y,
      r: OUTER_BORDER_RADIUS - WIRE_WIDTH/2,
      fill: "#222",
      stroke: "#111",
      strokeWidth: WIRE_WIDTH * 2
    }
  });

  for (let i = 0; i < 20; i++) {
    const startAngle = ((i * 18) + ROTATION_OFFSET) * Math.PI / 180;
    const endAngle = (((i + 1) * 18) + ROTATION_OFFSET) * Math.PI / 180;
    
    const number = DARTBOARD_NUMBERS[i];
    const isEven = i % 2 === 0;

    // Segment generation logic
    const generateArcPath = (innerRadius: number, outerRadius: number) => {
      const innerStartX = CENTER.x + innerRadius * Math.sin(startAngle);
      const innerStartY = CENTER.y - innerRadius * Math.cos(startAngle);
      const outerStartX = CENTER.x + outerRadius * Math.sin(startAngle);
      const outerStartY = CENTER.y - outerRadius * Math.cos(startAngle);
      
      const innerEndX = CENTER.x + innerRadius * Math.sin(endAngle);
      const innerEndY = CENTER.y - innerRadius * Math.cos(endAngle);
      const outerEndX = CENTER.x + outerRadius * Math.sin(endAngle);
      const outerEndY = CENTER.y - outerRadius * Math.cos(endAngle);
      
      return `
        M ${innerStartX} ${innerStartY}
        L ${outerStartX} ${outerStartY}
        A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY}
        L ${innerEndX} ${innerEndY}
        A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY}
      `;
    };

    // Main segment
    segments.push({
      type: 'path',
      props: {
        d: generateArcPath(OUTER_BULL_RADIUS, OUTER_BORDER_RADIUS),
        fill: isEven ? "#f2f2e4" : "#222",
        stroke: "none",
        dataSegment: number
      }
    });

    // Triple ring
    segments.push({
      type: 'path',
      props: {
        d: generateArcPath(TRIPLE_RING_INNER_RADIUS, TRIPLE_RING_OUTER_RADIUS),
        fill: i % 2 === 0 ? "#2bb33b" : "#d10937", // Green and Red
        stroke: "#000",
        strokeWidth: WIRE_WIDTH * 0.5,
        dataSegment: number,
        dataMultiplier: 3
      }
    });

    // Double ring (outermost)
    segments.push({
      type: 'path',
      props: {
        d: generateArcPath(DOUBLE_RING_INNER_RADIUS, DOUBLE_RING_OUTER_RADIUS),
        fill: i % 2 === 0 ? "#2bb33b" : "#d10937", // Green and Red
        stroke: "#000",
        strokeWidth: WIRE_WIDTH * 0.5,
        dataSegment: number,
        dataMultiplier: 2
      }
    });

    // Divider lines
    segments.push({
      type: 'line',
      props: {
        x1: CENTER.x,
        y1: CENTER.y,
        x2: CENTER.x + OUTER_BORDER_RADIUS * Math.sin(startAngle),
        y2: CENTER.y - OUTER_BORDER_RADIUS * Math.cos(startAngle),
        stroke: "#000",
        strokeWidth: WIRE_WIDTH
      }
    });
  }

  // Bulls
  segments.push({
    type: 'circle',
    props: {
      cx: CENTER.x,
      cy: CENTER.y,
      r: OUTER_BULL_RADIUS,
      fill: "#2bb33b", // Green outer bull
      stroke: "#000",
      strokeWidth: WIRE_WIDTH,
      dataSegment: 25,
      dataMultiplier: 1
    }
  });

  segments.push({
    type: 'circle',
    props: {
      cx: CENTER.x,
      cy: CENTER.y,
      r: INNER_BULL_RADIUS,
      fill: "#d10937", // Red bullseye
      stroke: "#000",
      strokeWidth: WIRE_WIDTH,
      dataSegment: 25,
      dataMultiplier: 2
    }
  });

  return segments;
};
