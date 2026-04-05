import { TextInput, TouchableOpacity, Text } from "react-native";
import { useState } from "react";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

export default function NoteScreen({ note, onBack, onSave }) {
  const [text, setText] = useState(note.title);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={{ flex: 1, backgroundColor: "#0b0b0b", padding: 20 }}
    >

      {/* Back Button */}
      <TouchableOpacity onPress={onBack}>
        <Text style={{ color: "white", marginBottom: 20 }}>← Back</Text>
      </TouchableOpacity>

      {/* Note Input */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write your note..."
        placeholderTextColor="#666"
        style={{
          color: "white",
          fontSize: 18,
          borderBottomWidth: 1,
          borderColor: "#333",
          paddingBottom: 10,
        }}
        multiline
      />

      {/* Save Button */}
      <TouchableOpacity
        onPress={() => onSave(text)}
        style={{
          marginTop: 20,
          borderWidth: 1,
          borderColor: "white",
          padding: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white" }}>Save</Text>
      </TouchableOpacity>

    </Animated.View>
  );
}