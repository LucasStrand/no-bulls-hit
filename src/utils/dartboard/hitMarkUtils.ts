
export const generateHitMarks = (hitMarks: { x: number; y: number; dartIndex: number }[]) => {
  const colors = ['#ffeb3b', '#ff9800', '#03a9f4'];
  
  return hitMarks.map((mark, idx) => {
    const dartNumber = mark.dartIndex + 1;
    const color = colors[mark.dartIndex % colors.length];
    
    return {
      circle: {
        cx: mark.x,
        cy: mark.y,
        r: 5,
        fill: color,
        stroke: "#000",
        strokeWidth: 1
      },
      text: {
        x: mark.x,
        y: mark.y,
        content: dartNumber.toString()
      }
    };
  });
};
