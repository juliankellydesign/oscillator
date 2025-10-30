// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 400, height: 450 });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = (msg: { type: string; params?: any }) => {
  if (msg.type === 'generate-wave') {
    const params = msg.params;
    
    // Validate parameters
    if (!params || 
        typeof params.waveLength !== 'number' || params.waveLength <= 0 ||
        typeof params.waveHeight !== 'number' || params.waveHeight <= 0 ||
        typeof params.waveRoundness !== 'number' ||
        typeof params.waveOffset !== 'number' ||
        typeof params.numWaves !== 'number' || params.numWaves <= 0 || !Number.isInteger(params.numWaves)) {
      console.error('Invalid wave parameters:', params);
      figma.closePlugin();
      return;
    }
    
    // Create a vector path
    const vectorPath = figma.createVector();
    
    // Generate the wave path data
    const pathData = generateWavePath(params);
    console.log('Generated path data:', pathData.data);
    vectorPath.vectorPaths = [pathData];
    
    // Set the position to center of viewport
    const viewportCenter = {
      x: figma.viewport.center.x,
      y: figma.viewport.center.y
    };
    
    // Calculate dimensions
    const totalWidth = params.waveLength * params.numWaves;
    const totalHeight = params.waveHeight * 2;
    
    // Position the vector at the center
    vectorPath.x = viewportCenter.x - totalWidth / 2;
    vectorPath.y = viewportCenter.y - totalHeight / 2;
    
    // Set stroke
    vectorPath.strokes = [{ type: 'SOLID', color: { r: 0.094, g: 0.627, b: 0.984 } }];
    vectorPath.strokeWeight = 2;
    
    // Add to the page
    figma.currentPage.appendChild(vectorPath);
    figma.currentPage.selection = [vectorPath];
    figma.viewport.scrollAndZoomIntoView([vectorPath]);
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};

function formatSVGNumber(num: number): string {
  return Math.round(num * 100) / 100 + '';
}

type Point = { x: number; y: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(p0: Point, p1: Point, t: number): Point {
  return { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function splitCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): [Point[], Point[]] {
  const p01 = lerpPt(p0, p1, t);
  const p12 = lerpPt(p1, p2, t);
  const p23 = lerpPt(p2, p3, t);
  const p012 = lerpPt(p01, p12, t);
  const p123 = lerpPt(p12, p23, t);
  const pm = lerpPt(p012, p123, t);
  return [
    [p0, p01, p012, pm],
    [pm, p123, p23, p3],
  ];
}

function solveTForY(p0: Point, p1: Point, p2: Point, p3: Point, targetY: number): number {
  // Validate that the curve actually crosses the target Y
  const yAtStart = cubicPoint(p0, p1, p2, p3, 0).y;
  const yAtEnd = cubicPoint(p0, p1, p2, p3, 1).y;
  
  // Ensure target is between start and end Y values
  if ((yAtStart > targetY && yAtEnd > targetY) || (yAtStart < targetY && yAtEnd < targetY)) {
    // Fallback: return midpoint if curve doesn't cross targetY
    // This should not happen with normal wave parameters
    return 0.5;
  }
  
  // Determine if curve is ascending (low to high Y) or descending (high to low Y)
  const isAscending = yAtStart < yAtEnd;
  
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const y = cubicPoint(p0, p1, p2, p3, mid).y;
    if (isAscending) {
      // Curve goes from low Y to high Y: if y < targetY, search higher t
      if (y < targetY) lo = mid; else hi = mid;
    } else {
      // Curve goes from high Y to low Y: if y > targetY, search higher t
      if (y > targetY) lo = mid; else hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function generateWavePath(params: { waveLength: number; waveHeight: number; waveRoundness: number; waveOffset: number; numWaves: number }) {
  const numWaves = params.numWaves;
  const waveLength = params.waveLength;
  const waveHeight = params.waveHeight;
  const roundness = params.waveRoundness / 100;
  const offset = params.waveOffset / 100;
  
  let pathData = '';
  
  // Start at bottom left
  const startY = waveHeight * 2;
  pathData += `M 0 ${formatSVGNumber(startY)}`;
  
  // Generate each wave segment
  for (let i = 0; i < numWaves; i++) {
    const waveStartX = i * waveLength;
    const waveEndX = waveStartX + waveLength;
    
    // Top point (shifted by offset)
    const waveMidX = waveStartX + waveLength / 2;
    const topXOffset = offset * waveLength;
    const topX = waveMidX + topXOffset;
    const topY = 0;
    
    // Bottom endpoint
    const bottomX = waveEndX;
    const bottomY = waveHeight * 2;
    
    // Calculate bezier handle positions
    const handleReach = roundness * (waveLength / 2);
    
    // Define control points as Points for both cubics
    const p0: Point = { x: waveStartX, y: bottomY };
    const p1: Point = { x: waveStartX + handleReach, y: bottomY };
    const p2: Point = { x: topX - handleReach, y: topY };
    const p3: Point = { x: topX, y: topY };

    const q0: Point = { x: topX, y: topY };
    const q1: Point = { x: topX + handleReach, y: topY };
    const q2: Point = { x: bottomX - handleReach, y: bottomY };
    const q3: Point = { x: bottomX, y: bottomY };

    // Middle Y coordinate where we want to insert a node
    const middleY = waveHeight;

    function emitC(a1: Point, a2: Point, a3: Point) {
      pathData += ` C ${formatSVGNumber(a1.x)} ${formatSVGNumber(a1.y)} ${formatSVGNumber(a2.x)} ${formatSVGNumber(a2.y)} ${formatSVGNumber(a3.x)} ${formatSVGNumber(a3.y)}`;
    }

    // First curve goes from bottom (y = waveHeight * 2) to top (y = 0)
    // Split it at middle Y (waveHeight) to add midpoint node
    const tMiddle = solveTForY(p0, p1, p2, p3, middleY);
    const [leftToMiddle, middleToTop] = splitCubic(p0, p1, p2, p3, tMiddle);
    // Emit first half: from bottom to middle Y
    emitC(leftToMiddle[1], leftToMiddle[2], leftToMiddle[3]);
    // Emit second half: from middle Y to top (y = 0) - explicit node at y=0 when going up
    emitC(middleToTop[1], middleToTop[2], middleToTop[3]);
    
    // Second curve goes from top (y = 0) to bottom (y = waveHeight * 2)
    // Split it at middle Y (waveHeight) to add midpoint node when going down
    const tMiddleDown = solveTForY(q0, q1, q2, q3, middleY);
    const [topToMiddle, middleToBottom] = splitCubic(q0, q1, q2, q3, tMiddleDown);
    // Emit first half: from top to middle Y (explicit node at y=waveHeight when going down)
    emitC(topToMiddle[1], topToMiddle[2], topToMiddle[3]);
    // Emit second half: from middle Y to bottom
    emitC(middleToBottom[1], middleToBottom[2], middleToBottom[3]);
  }
  
  return {
    data: pathData,
    windingRule: "NONZERO" as const
  };
}
