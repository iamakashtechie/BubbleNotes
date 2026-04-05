import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APPEARANCE_MODE_LABELS,
  APPEARANCE_MODE_SYSTEM,
  getThemeForScheme,
} from "../utils/theme";

export default function NoteScreen({
  note,
  onBack,
  onSave,
  onDelete,
  tagOptions = [],
  theme,
  appearanceMode = APPEARANCE_MODE_SYSTEM,
  onOpenAppearancePicker,
}) {
  const insets = useSafeAreaInsets();
  const appliedTheme = theme ?? getThemeForScheme("dark");
  const appearanceLabel = APPEARANCE_MODE_LABELS[appearanceMode] ?? APPEARANCE_MODE_LABELS[APPEARANCE_MODE_SYSTEM];
  const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const [tags, setTags] = useState(Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : ["General"]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setTitle(note.title ?? "");
    setContent(note.content ?? "");
    setTags(Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : ["General"]);
    setIsDirty(false);
  }, [note.content, note.id, note.tags, note.title]);

  const availableTags = useMemo(
    () => (Array.isArray(tagOptions) && tagOptions.length > 0 ? tagOptions : ["General", "Ideas", "Work", "Study", "Personal"]),
    [tagOptions]
  );

  const updatedLabel = useMemo(() => {
    const raw = note.updatedAt ?? note.createdAt;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return "Updated recently";
    }

    return `Updated ${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [note.createdAt, note.updatedAt]);

  const notePayload = useMemo(
    () => ({
      title: title.trim() || "Untitled",
      content,
      tags,
    }),
    [content, tags, title]
  );

  const onChangeTitle = (value) => {
    setTitle(value);
    setIsDirty(true);
  };

  const onChangeContent = (value) => {
    setContent(value);
    setIsDirty(true);
  };

  const onSelectTag = (tag) => {
    setTags([tag]);
    setIsDirty(true);
  };

  const handleSave = () => {
    Haptics.selectionAsync().catch(() => {});
    onSave(notePayload);
  };

  const handleBack = () => {
    if (isDirty) {
      Haptics.selectionAsync().catch(() => {});
      onSave(notePayload);
      return;
    }

    onBack();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete this note?",
      "This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onDelete?.(note.id);
          },
        },
      ]
    );
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={{
        flex: 1,
        backgroundColor: appliedTheme.background,
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top, 12) + 8,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            marginTop: 12,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back to bubble canvas"
            accessibilityHint="Returns to the canvas and auto-saves if you changed this note"
          >
            <Text style={{ color: appliedTheme.textPrimary, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: isDirty ? "#b47b00" : "#2b8e64", fontSize: 12 }}>
              {isDirty ? "Editing" : "Saved"}
            </Text>

            {onOpenAppearancePicker ? (
              <TouchableOpacity
                onPress={onOpenAppearancePicker}
                accessibilityRole="button"
                accessibilityLabel="Change app appearance"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: appliedTheme.border,
                  backgroundColor: appliedTheme.surface,
                }}
              >
                <Text style={{ color: appliedTheme.textPrimary, fontSize: 12, fontWeight: "600" }}>
                  {appearanceLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save note"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: appliedTheme.borderStrong,
                backgroundColor: appliedTheme.surfaceStrong,
              }}
            >
              <Text style={{ color: appliedTheme.textPrimary, fontSize: 13, fontWeight: "600" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ color: appliedTheme.textMuted, fontSize: 11, marginBottom: 12 }}>
          {updatedLabel}
        </Text>

        <Text style={{ color: appliedTheme.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Title
        </Text>
        <TextInput
          value={title}
          onChangeText={onChangeTitle}
          accessibilityLabel="Note title"
          placeholder="Untitled note"
          placeholderTextColor={appliedTheme.placeholder}
          style={{
            color: appliedTheme.textPrimary,
            fontSize: 24,
            fontWeight: "600",
            borderBottomWidth: 1,
            borderColor: appliedTheme.separator,
            paddingBottom: 10,
            marginBottom: 18,
          }}
          returnKeyType="done"
        />

        <Text style={{ color: appliedTheme.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Tag
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {availableTags.map((tag) => {
              const selected = tags[0] === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => onSelectTag(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set tag ${tag}`}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? appliedTheme.selectedBorder : appliedTheme.border,
                    backgroundColor: selected ? appliedTheme.selectedBackground : appliedTheme.surface,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? appliedTheme.selectedText : appliedTheme.textPrimary,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={{ color: appliedTheme.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Content
        </Text>
        <TextInput
          value={content}
          onChangeText={onChangeContent}
          accessibilityLabel="Note content"
          placeholder="Start writing your thoughts..."
          placeholderTextColor={appliedTheme.placeholder}
          style={{
            flex: 1,
            color: appliedTheme.textPrimary,
            fontSize: 17,
            lineHeight: 24,
            borderWidth: 1,
            borderColor: appliedTheme.inputBorder,
            borderRadius: 14,
            padding: 14,
            textAlignVertical: "top",
            backgroundColor: appliedTheme.inputSurface,
          }}
          multiline
        />

        <TouchableOpacity
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete note"
          style={{
            marginTop: 12,
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: appliedTheme.subtleDangerBorder,
            backgroundColor: appliedTheme.subtleDangerSurface,
          }}
        >
          <Text style={{ color: appliedTheme.subtleDangerText, fontWeight: "600" }}>Delete note</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}