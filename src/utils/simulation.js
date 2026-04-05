import {
  forceSimulation,
  forceCenter,
  forceCollide,
  forceManyBody,
} from "d3-force";

export const runSimulation = (nodes, width, height) => {
  const sim = forceSimulation(nodes)
    .force("center", forceCenter(width / 2, height / 2).strength(0.1))
    .force("collide", forceCollide().radius(d => d.radius + 12))
    .force("charge", forceManyBody().strength(-35))
    .alpha(1)
    .alphaDecay(0.03)
    .stop();

  for (let i = 0; i < 250; i++) {
    sim.tick();
  }

  nodes.forEach(node => {
    node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
  });

  return nodes;
};