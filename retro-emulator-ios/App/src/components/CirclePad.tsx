// CirclePad — the 3DS analog stick. Drag within the ring; axes go to
// the native side as -1..1 on touch transitions and movement (event
// rate, same rule as buttons — JS never sits on the frame loop).
// Y is inverted because screen-down is guest-negative.

import { useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import { EmuCore } from "../emu";

const SIZE = 108;
const KNOB = 44;
const RADIUS = (SIZE - KNOB) / 2;

export default function CirclePad() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const center = useRef({ x: SIZE / 2, y: SIZE / 2 });

  const send = (dx: number, dy: number) => {
    // Clamp to the ring, then normalize.
    const dist = Math.hypot(dx, dy);
    const scale = dist > RADIUS ? RADIUS / dist : 1;
    const cx = dx * scale;
    const cy = dy * scale;
    setKnob({ x: cx, y: cy });
    EmuCore.setAnalog(cx / RADIUS, -cy / RADIUS);
  };

  const move = (e: GestureResponderEvent) => {
    send(
      e.nativeEvent.locationX - center.current.x,
      e.nativeEvent.locationY - center.current.y,
    );
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    EmuCore.setAnalog(0, 0);
  };

  return (
    <View
      style={styles.pad}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={move}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={release}
    >
      <View
        style={[
          styles.knob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "#111827",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#4b5563",
  },
});
