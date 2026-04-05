import React from "react";
import Svg, { Circle, Text } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withSpring } from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function BubbleNode({ node, onPressBubble }) {
  const scale = useSharedValue(1);

  const animatedProps = useAnimatedProps(() => ({
    r: node.radius * scale.value,
  }));

  return (
    <React.Fragment>
      <AnimatedCircle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        stroke="white"
        strokeWidth={1.5}
        fill="rgba(255,255,255,0.05)"
        animatedProps={animatedProps}
        onPressIn={() => {
          scale.value = withSpring(0.92);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
          onPressBubble(node);
        }}
      />
      <Text
        x={node.x}
        y={node.y}
        fill="white"
        fontSize="14"
        fontWeight="500"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {node.title}
      </Text>
    </React.Fragment>
  );
}

export default function BubbleCanvas({ nodes, width, height, onPressBubble }) {
  return (
    <Svg width={width} height={height}>
      {nodes.map((node) => (
        <BubbleNode key={node.id} node={node} onPressBubble={onPressBubble} />
      ))}
    </Svg>
  );
}