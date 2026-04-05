import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import Animated, { useAnimatedProps, useSharedValue, withSpring } from "react-native-reanimated";
import Svg, { Circle, Text } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LONG_PRESS_DELAY_MS = 420;

function BubbleNode({
  node,
  onLongPressBubble,
  isSelected,
  selectionMode,
  labelColor,
  selectedBubbleStroke,
  selectedBubbleFill,
}) {
  const scale = useSharedValue(1);
  const rawTitle = (node.title ?? "Untitled").trim() || "Untitled";
  const displayTitle = rawTitle.length > 12 ? `${rawTitle.slice(0, 11)}...` : rawTitle;
  const labelSize = Math.max(11, Math.min(18, node.radius * 0.35));
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  useEffect(() => () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onLongPressBubble?.(node);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  };

  const stopLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const animatedProps = useAnimatedProps(() => ({
    r: node.radius * scale.value,
  }));

  const strokeColor = isSelected ? selectedBubbleStroke ?? "#FFFFFF" : node.color ?? "white";
  const fillColor = isSelected
    ? selectedBubbleFill ?? "rgba(255,255,255,0.26)"
    : node.fill ?? "rgba(255,255,255,0.05)";

  return (
    <React.Fragment>
      <AnimatedCircle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        accessible
        accessibilityRole="button"
        accessibilityLabel={selectionMode ? `Select note ${rawTitle}` : `Open note ${rawTitle}`}
        accessibilityHint={selectionMode ? "Toggles note selection" : "Opens this note for editing"}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2.6 : 1.5}
        fill={fillColor}
        animatedProps={animatedProps}
        onPressIn={() => {
          startLongPressTimer();
          scale.value = withSpring(0.92);
        }}
        onPressOut={() => {
          stopLongPressTimer();
          scale.value = withSpring(1);
          didLongPressRef.current = false;
        }}
      />
      <Text
        x={node.x}
        y={node.y}
        fill={labelColor ?? "white"}
        fontSize={String(labelSize)}
        fontWeight="500"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {displayTitle}
      </Text>
    </React.Fragment>
  );
}

export default function BubbleCanvas({
  nodes,
  width,
  height,
  onLongPressBubble,
  selectionMode,
  selectedIds,
  labelColor,
  selectedBubbleStroke,
  selectedBubbleFill,
}) {
  const selected = Array.isArray(selectedIds) ? selectedIds : [];

  return (
    <Svg width={width} height={height}>
      {nodes.map((node) => (
        <BubbleNode
          key={node.id}
          node={node}
          onLongPressBubble={onLongPressBubble}
          isSelected={selected.includes(node.id)}
          selectionMode={selectionMode}
          labelColor={labelColor}
          selectedBubbleStroke={selectedBubbleStroke}
          selectedBubbleFill={selectedBubbleFill}
        />
      ))}
    </Svg>
  );
}