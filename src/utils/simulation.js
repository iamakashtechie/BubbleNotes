import {
  forceSimulation,
  forceCollide,
  forceManyBody,
  forceX,
  forceY,
} from "d3-force";

export const runSimulation = (nodes, width, height) => {
  const cx = width / 2;
  const cy = height / 2;
  
  const sim = forceSimulation(nodes)
    .force("x", forceX(cx).strength(0.1))
    .force("y", forceY(cy).strength(0.1))
    .force("collide", forceCollide().radius(d => d.radius + 0.2).iterations(12).strength(1))
    .force("charge", forceManyBody().strength(4).distanceMin(1).distanceMax(70))
    .alpha(1)
    .alphaDecay(0.01)
    .velocityDecay(0.32)
    .stop();

  for (let i = 0; i < 500; i++) {
    sim.tick();
  }

  nodes.forEach(node => {
    node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
  });

  return nodes;
};