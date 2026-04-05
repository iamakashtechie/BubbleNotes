import { View, Dimensions, TouchableOpacity, Text } from "react-native";
import { useEffect, useState } from "react";
import BubbleCanvas from "../components/BubbleCanvas";
import { runSimulation } from "../utils/simulation";
import NoteScreen from "./NoteScreen";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const [nodes, setNodes] = useState([]);
  const [notes, setNotes] = useState([
    { id: 1, title: "DSA", radius: 50 },
    { id: 2, title: "React", radius: 40 },
    { id: 3, title: "Physics", radius: 45 },
    { id: 4, title: "Ideas", radius: 35 },
  ]);
  const [selectedNote, setSelectedNote] = useState(null);

  const radiusFromText = (text) => {
    const len = text.trim().length;
    return Math.max(30, Math.min(80, 24 + Math.sqrt(Math.max(1, len)) * 6));
  };

  useEffect(() => {
    const simulated = runSimulation(
      notes.map((n) => ({ ...n })),
      width,
      height
    );
    setNodes(simulated);
  }, [notes]);

  const openNote = (note) => {
    setSelectedNote(note);
  };

  const addNote = () => {
    const title = `Note ${notes.length + 1}`;
    const newNote = {
      id: Date.now(),
      title,
      radius: radiusFromText(title),
    };

    setNotes((prev) => [...prev, newNote]);
  };

  const saveNote = (updatedText) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === selectedNote.id
          ? { ...n, title: updatedText, radius: radiusFromText(updatedText) }
          : n
      )
    );
    setSelectedNote(null);
  };

  if (selectedNote) {
    return (
      <NoteScreen
        note={selectedNote}
        onBack={() => setSelectedNote(null)}
        onSave={saveNote}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0b" }}>
      <BubbleCanvas
        nodes={nodes}
        width={width}
        height={height}
        onPressBubble={openNote}
      />

      <TouchableOpacity
        onPress={addNote}
        style={{
          position: "absolute",
          bottom: 30,
          right: 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 24 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}