
import { DARTBOARD_CONFIG, DARTBOARD_NUMBERS } from './dartboardConfig';
import { DartScore } from '../../types/game';

export const calculateScore = (x: number, y: number): DartScore => {
  const { CENTER, 
    INNER_BULL_RADIUS, 
    OUTER_BULL_RADIUS, 
    OUTER_BORDER_RADIUS, 
    DOUBLE_RING_INNER_RADIUS, 
    DOUBLE_RING_OUTER_RADIUS,
    TRIPLE_RING_INNER_RADIUS, 
    TRIPLE_RING_OUTER_RADIUS,
    ROTATION_OFFSET 
  } = DARTBOARD_CONFIG;

  const dx = x - CENTER.x;
  const dy = y - CENTER.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Bullseye checks
  if (distance <= INNER_BULL_RADIUS) {
    return { segment: 25, multiplier: 2, points: 50, isBull: true };
  }
  
  if (distance <= OUTER_BULL_RADIUS) {
    return { segment: 25, multiplier: 1, points: 25, isOuterBull: true };
  }
  
  // Segment and multiplier calculation
  let angle = (Math.atan2(dy, dx) * 180 / Math.PI + 99) % 360;
  if (angle < 0) angle += 360;
  
  const segmentIndex = Math.floor(angle / 18) % 20;
  const segmentNumber = DARTBOARD_NUMBERS[segmentIndex];
  
  let multiplier: 1 | 2 | 3 = 1;
  
  if (distance >= TRIPLE_RING_INNER_RADIUS && distance <= TRIPLE_RING_OUTER_RADIUS) {
    multiplier = 3;
  } else if (distance >= DOUBLE_RING_INNER_RADIUS && distance <= DOUBLE_RING_OUTER_RADIUS) {
    multiplier = 2;
  }
  
  // Outside dartboard
  if (distance > OUTER_BORDER_RADIUS) {
    return { segment: 0, multiplier: 1, points: 0 };
  }
  
  return {
    segment: segmentNumber,
    multiplier,
    points: segmentNumber * multiplier,
  };
};
