import {
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

export const runSimulation = (nodes, viewportWidth, viewportHeight) => {

  const sim = forceSimulation(nodes)
    .force("x", forceX(0).strength(0.08))
    .force("y", forceY(0).strength(0.08))
    .force("collide", forceCollide().radius(d => d.radius + 0.2).iterations(14).strength(1))
    .force("charge", forceManyBody().strength(3).distanceMin(1).distanceMax(80))
    .alpha(1)
    .alphaDecay(0.01)
    .velocityDecay(0.32)
    .stop();

  for (let i = 0; i < 600; i++) {
    sim.tick();
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    minX = Math.min(minX, n.x - n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  });

  const padding = 120;
  const clusterWidth = maxX - minX;
  const clusterHeight = maxY - minY;

  const contentWidth = Math.max(viewportWidth, clusterWidth + padding * 2);
  const contentHeight = Math.max(viewportHeight, clusterHeight + padding * 2);

  const leftInset = (contentWidth - clusterWidth) / 2;
  const topInset = (contentHeight - clusterHeight) / 2;
  const offsetX = leftInset - minX;
  const offsetY = topInset - minY;

  nodes.forEach((n) => {
    n.x += offsetX;
    n.y += offsetY;
  });

  return { nodes, contentWidth, contentHeight };
};