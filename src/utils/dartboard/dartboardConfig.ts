export const DARTBOARD_NUMBERS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

export const DARTBOARD_CONFIG = {
  OUTER_BORDER_RADIUS: 170,
  OUTER_BORDER_COLOR: '#000',
  DOUBLE_RING_OUTER_RADIUS: 170, // Moved to outermost
  DOUBLE_RING_INNER_RADIUS: 162,
  DOUBLE_RING_COLORS: ['#2bb33b', '#d10937'], // Green and Red alternating
  TRIPLE_RING_OUTER_RADIUS: 99,
  TRIPLE_RING_INNER_RADIUS: 91,
  OUTER_BULL_RADIUS: 16,
  INNER_BULL_RADIUS: 6.35,
  CENTER: { x: 170, y: 170 },
  SVG_SIZE: 340,
  WIRE_WIDTH: 0.8,
  ROTATION_OFFSET: 9, // Changed from -9 to 9 to rotate the board so 20 is at top
};
