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
    const numWaves = 4;
    const totalWidth = params.waveLength * numWaves;
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

function generateWavePath(params: { waveLength: number; waveHeight: number; waveRoundness: number; waveOffset: number }) {
  const numWaves = 4;
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
    const waveMidX = waveStartX + waveLength / 2;
    const waveEndX = waveStartX + waveLength;
    
    // Top point (shifted by offset)
    const topXOffset = offset * waveLength;
    const topX = waveMidX + topXOffset;
    const topY = 0;
    
    // Bottom endpoint
    const bottomX = waveEndX;
    const bottomY = waveHeight * 2;
    
    // Calculate bezier handle positions with constraints
    const handleReach = roundness * (waveLength / 2);
    
    // First curve: from wave start to top point
    // Control points should stay within [waveStartX, topX]
    const cp1x = Math.min(Math.max(waveStartX, waveStartX + handleReach), topX);
    const cp1y = waveHeight * 2;
    const cp2x = Math.max(Math.min(topX - handleReach, topX), waveStartX);
    const cp2y = 0;
    
    pathData += ` C ${formatSVGNumber(cp1x)} ${formatSVGNumber(cp1y)}, ${formatSVGNumber(cp2x)} ${formatSVGNumber(cp2y)}, ${formatSVGNumber(topX)} ${formatSVGNumber(topY)}`;
    
    // Second curve: from top point to wave end
    // Control points should stay within [topX, bottomX]
    const cp3x = Math.max(Math.min(topX + handleReach, bottomX), topX);
    const cp3y = 0;
    const cp4x = Math.min(Math.max(bottomX - handleReach, topX), bottomX);
    const cp4y = waveHeight * 2;
    
    pathData += ` C ${formatSVGNumber(cp3x)} ${formatSVGNumber(cp3y)}, ${formatSVGNumber(cp4x)} ${formatSVGNumber(cp4y)}, ${formatSVGNumber(bottomX)} ${formatSVGNumber(bottomY)}`;
  }
  
  return {
    data: pathData,
    windingRule: "NONZERO" as const
  };
}
