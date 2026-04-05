import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
    useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BubbleCanvas from "../components/BubbleCanvas";
import { runSimulation } from "../utils/simulation";
import {
    APPEARANCE_MODE_DARK,
    APPEARANCE_MODE_LABELS,
    APPEARANCE_MODE_LIGHT,
    APPEARANCE_MODE_SYSTEM,
    getThemeForScheme,
    isValidAppearanceMode,
} from "../utils/theme";
import NoteScreen from "./NoteScreen";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.5;
const HINT_DISMISSED_STORAGE_KEY = "bubble_notes_hint_dismissed_v1";
const NOTES_STORAGE_KEY = "bubble_notes_notes_v1";
const VIEW_MODE_STORAGE_KEY = "bubble_notes_view_mode_v1";
const LIST_SORT_STORAGE_KEY = "bubble_notes_list_sort_v1";
const CAMERA_STORAGE_KEY = "bubble_notes_camera_v1";
const THEME_MODE_STORAGE_KEY = "bubble_notes_theme_mode_v1";
const DEFAULT_TAG = "General";
const TAG_OPTIONS = ["General", "Ideas", "Work", "Study", "Personal"];
const TAG_THEMES = {
  general: {
    stroke: "#C9D7FF",
    fill: "rgba(117,145,255,0.2)",
  },
  ideas: {
    stroke: "#93F0D6",
    fill: "rgba(77,204,168,0.2)",
  },
  work: {
    stroke: "#FFD29D",
    fill: "rgba(235,168,83,0.22)",
  },
  study: {
    stroke: "#A5DDFF",
    fill: "rgba(95,183,235,0.21)",
  },
  personal: {
    stroke: "#E2B8FF",
    fill: "rgba(181,127,234,0.2)",
  },
};

const normalizeTag = (tag) => {
  const raw = typeof tag === "string" ? tag.trim() : "";
  if (!raw) {
    return DEFAULT_TAG;
  }

  const match = TAG_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (match) {
    return match;
  }

  return `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
};

const normalizeTags = (rawTags) => {
  const values = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? rawTags.split(",")
      : [];

  const normalized = values
    .map(normalizeTag)
    .filter((value, index, source) => source.indexOf(value) === index);

  return normalized.length > 0 ? normalized : [DEFAULT_TAG];
};

const getTagTheme = (tag) => TAG_THEMES[(tag ?? DEFAULT_TAG).toLowerCase()] ?? TAG_THEMES.general;

const getRadiusFromText = (text) => {
  const len = text.trim().length;
  return Math.max(30, Math.min(80, 24 + Math.sqrt(Math.max(1, len)) * 6));
};

const cloneNotesSnapshot = (items) => items.map((item) => ({
  ...item,
  tags: Array.isArray(item.tags) ? [...item.tags] : [DEFAULT_TAG],
}));

const formatUpdatedAtLabel = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return `Updated ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const normalizeNoteModel = (entry, index = 0) => {
  const title = typeof entry?.title === "string" && entry.title.trim().length > 0
    ? entry.title.trim()
    : `Note ${index + 1}`;
  const content = typeof entry?.content === "string" ? entry.content : "";
  const tags = normalizeTags(entry?.tags ?? entry?.tag);
  const theme = getTagTheme(tags[0]);
  const createdAt = typeof entry?.createdAt === "string"
    ? entry.createdAt
    : new Date().toISOString();
  const updatedAt = typeof entry?.updatedAt === "string"
    ? entry.updatedAt
    : createdAt;
  const radiusValue = Number(entry?.radius);
  const radius = Number.isFinite(radiusValue)
    ? radiusValue
    : getRadiusFromText(`${title} ${content}`);
  const rawId = entry?.id;
  const id = (typeof rawId === "number" || typeof rawId === "string")
    ? rawId
    : `${Date.now()}-${index}`;

  return {
    id,
    title,
    content,
    tags,
    color: theme.stroke,
    fill: theme.fill,
    radius,
    createdAt,
    updatedAt,
  };
};

const INITIAL_NOTES = [
  { id: 1, title: "DSA", content: "", tags: ["Study"], radius: 50 },
  { id: 2, title: "React", content: "", tags: ["Work"], radius: 40 },
  { id: 3, title: "Physics", content: "", tags: ["Study"], radius: 45 },
  { id: 4, title: "Ideas", content: "", tags: ["Ideas"], radius: 35 },
];

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const getAxisBounds = (scaledContent, viewport) => {
  if (scaledContent <= viewport) {
    const centered = (viewport - scaledContent) / 2;
    return { min: centered, max: centered };
  }

  return {
    min: viewport - scaledContent,
    max: 0,
  };
};

const getTranslateBounds = (contentWidth, contentHeight, viewportWidth, viewportHeight, scale) => {
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;

  const xBounds = getAxisBounds(scaledWidth, viewportWidth);
  const yBounds = getAxisBounds(scaledHeight, viewportHeight);

  return {
    minX: xBounds.min,
    maxX: xBounds.max,
    minY: yBounds.min,
    maxY: yBounds.max,
  };
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [canvas, setCanvas] = useState({
    nodes: [],
    contentWidth: width,
    contentHeight: height,
  });
  const [showHint, setShowHint] = useState(false);
  const [isHintReady, setIsHintReady] = useState(false);
  const [isNotesHydrated, setIsNotesHydrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState(null);
  const [viewMode, setViewMode] = useState("map");
  const [sortMode, setSortMode] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [appearanceMode, setAppearanceMode] = useState(APPEARANCE_MODE_SYSTEM);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isPrefsHydrated, setIsPrefsHydrated] = useState(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [zoomPercent, setZoomPercent] = useState(100);
  const hasInitializedCamera = useRef(false);
  const restoredCameraRef = useRef(null);
  const historyPastRef = useRef([]);
  const historyFutureRef = useRef([]);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);

  const resolvedScheme = appearanceMode === APPEARANCE_MODE_SYSTEM
    ? systemColorScheme === APPEARANCE_MODE_LIGHT
      ? APPEARANCE_MODE_LIGHT
      : APPEARANCE_MODE_DARK
    : appearanceMode;
  const theme = useMemo(() => getThemeForScheme(resolvedScheme), [resolvedScheme]);
  const appearanceLabel = APPEARANCE_MODE_LABELS[appearanceMode] ?? APPEARANCE_MODE_LABELS[APPEARANCE_MODE_SYSTEM];

  useEffect(() => {
    let isMounted = true;

    const loadNotes = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
        if (!stored) {
          if (isMounted) {
            setNotes(INITIAL_NOTES.map((note, index) => normalizeNoteModel(note, index)));
          }
          return;
        }

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          if (isMounted) {
            setNotes(INITIAL_NOTES.map((note, index) => normalizeNoteModel(note, index)));
          }
          return;
        }

        const normalized = parsed.map((entry, index) => normalizeNoteModel(entry, index));

        if (isMounted) {
          setNotes(normalized);
        }
      } catch {
        if (isMounted) {
          setNotes(INITIAL_NOTES.map((note, index) => normalizeNoteModel(note, index)));
        }
      } finally {
        if (isMounted) {
          setIsNotesHydrated(true);
        }
      }
    };

    loadNotes();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUiPreferences = async () => {
      try {
        const [storedViewMode, storedSortMode, storedCamera, storedThemeMode] = await Promise.all([
          AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY),
          AsyncStorage.getItem(LIST_SORT_STORAGE_KEY),
          AsyncStorage.getItem(CAMERA_STORAGE_KEY),
          AsyncStorage.getItem(THEME_MODE_STORAGE_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        if (storedViewMode === "map" || storedViewMode === "list") {
          setViewMode(storedViewMode);
        }

        if (storedSortMode === "recent" || storedSortMode === "title" || storedSortMode === "size") {
          setSortMode(storedSortMode);
        }

        if (isValidAppearanceMode(storedThemeMode)) {
          setAppearanceMode(storedThemeMode);
        }

        if (storedCamera) {
          try {
            const parsed = JSON.parse(storedCamera);
            const parsedScale = Number(parsed?.scale);
            const parsedX = Number(parsed?.translateX);
            const parsedY = Number(parsed?.translateY);
            if (
              Number.isFinite(parsedScale)
              && Number.isFinite(parsedX)
              && Number.isFinite(parsedY)
            ) {
              restoredCameraRef.current = {
                scale: parsedScale,
                translateX: parsedX,
                translateY: parsedY,
              };
            }
          } catch {
            restoredCameraRef.current = null;
          }
        }
      } catch {
        // Keep defaults if preference loading fails.
      } finally {
        if (isMounted) {
          setIsPrefsHydrated(true);
        }
      }
    };

    loadUiPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNotesHydrated) {
      return;
    }

    AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes)).catch(() => {});
  }, [isNotesHydrated, notes]);

  const rerunSimulation = useCallback(() => {
    setNotes((prev) => [...prev]);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadHintState = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(HINT_DISMISSED_STORAGE_KEY);
        if (isMounted) {
          setShowHint(dismissed !== "1");
        }
      } catch {
        if (isMounted) {
          setShowHint(true);
        }
      } finally {
        if (isMounted) {
          setIsHintReady(true);
        }
      }
    };

    loadHintState();

    return () => {
      isMounted = false;
    };
  }, []);

  const triggerSelectionHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const triggerLightImpactHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }, []);

  const commitNotesUpdate = useCallback(
    (updater, options = {}) => {
      const trackHistory = options.trackHistory !== false;

      setNotes((previous) => {
        const previousSnapshot = cloneNotesSnapshot(previous).map((note, index) => normalizeNoteModel(note, index));
        const nextCandidate = updater(cloneNotesSnapshot(previousSnapshot));

        if (!Array.isArray(nextCandidate)) {
          return previous;
        }

        const normalizedNext = nextCandidate.map((note, index) => normalizeNoteModel(note, index));

        if (JSON.stringify(previousSnapshot) === JSON.stringify(normalizedNext)) {
          return previous;
        }

        if (trackHistory) {
          historyPastRef.current = [...historyPastRef.current, previousSnapshot];
          if (historyPastRef.current.length > 60) {
            historyPastRef.current = historyPastRef.current.slice(-60);
          }
          historyFutureRef.current = [];
          syncHistoryState();
        }

        return normalizedNext;
      });
    },
    [syncHistoryState]
  );

  const undoNotes = useCallback(() => {
    const previous = historyPastRef.current[historyPastRef.current.length - 1];
    if (!previous) {
      return;
    }

    historyPastRef.current = historyPastRef.current.slice(0, -1);

    setNotes((current) => {
      const currentSnapshot = cloneNotesSnapshot(current).map((note, index) => normalizeNoteModel(note, index));
      historyFutureRef.current = [...historyFutureRef.current, currentSnapshot];
      if (historyFutureRef.current.length > 60) {
        historyFutureRef.current = historyFutureRef.current.slice(-60);
      }
      return cloneNotesSnapshot(previous).map((note, index) => normalizeNoteModel(note, index));
    });

    setSelectionMode(false);
    setSelectedIds([]);
    syncHistoryState();
    triggerSelectionHaptic();
  }, [syncHistoryState, triggerSelectionHaptic]);

  const redoNotes = useCallback(() => {
    const next = historyFutureRef.current[historyFutureRef.current.length - 1];
    if (!next) {
      return;
    }

    historyFutureRef.current = historyFutureRef.current.slice(0, -1);

    setNotes((current) => {
      const currentSnapshot = cloneNotesSnapshot(current).map((note, index) => normalizeNoteModel(note, index));
      historyPastRef.current = [...historyPastRef.current, currentSnapshot];
      if (historyPastRef.current.length > 60) {
        historyPastRef.current = historyPastRef.current.slice(-60);
      }
      return cloneNotesSnapshot(next).map((note, index) => normalizeNoteModel(note, index));
    });

    setSelectionMode(false);
    setSelectedIds([]);
    syncHistoryState();
    triggerSelectionHaptic();
  }, [syncHistoryState, triggerSelectionHaptic]);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelectionForId = useCallback((noteId) => {
    setSelectionMode(true);
    setSelectedIds((previous) => (
      previous.includes(noteId)
        ? previous.filter((id) => id !== noteId)
        : [...previous, noteId]
    ));
  }, []);

  const persistCameraState = useCallback(
    (nextScale, nextTranslateX, nextTranslateY) => {
      if (!isPrefsHydrated) {
        return;
      }

      const scaleValue = Number(nextScale);
      const translateXValue = Number(nextTranslateX);
      const translateYValue = Number(nextTranslateY);

      const payload = {
        scale: Number.isFinite(scaleValue) ? scaleValue : 1,
        translateX: Number.isFinite(translateXValue) ? translateXValue : 0,
        translateY: Number.isFinite(translateYValue) ? translateYValue : 0,
      };

      AsyncStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
    },
    [isPrefsHydrated]
  );

  const persistCurrentCamera = useCallback(() => {
    persistCameraState(scale.value, translateX.value, translateY.value);
  }, [persistCameraState, scale, translateX, translateY]);

  useEffect(() => {
    if (!isPrefsHydrated) {
      return;
    }

    AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode).catch(() => {});
  }, [isPrefsHydrated, viewMode]);

  useEffect(() => {
    if (!isPrefsHydrated) {
      return;
    }

    AsyncStorage.setItem(LIST_SORT_STORAGE_KEY, sortMode).catch(() => {});
  }, [isPrefsHydrated, sortMode]);

  useEffect(() => {
    if (!isPrefsHydrated) {
      return;
    }

    AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, appearanceMode).catch(() => {});
  }, [appearanceMode, isPrefsHydrated]);

  useEffect(() => {
    if (!isPrefsHydrated) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        persistCurrentCamera();
      }
    });

    return () => {
      persistCurrentCamera();
      subscription.remove();
    };
  }, [isPrefsHydrated, persistCurrentCamera]);

  const toggleViewMode = useCallback(() => {
    triggerSelectionHaptic();
    setViewMode((prev) => (prev === "map" ? "list" : "map"));
  }, [triggerSelectionHaptic]);

  const openAppearancePicker = useCallback(() => {
    triggerSelectionHaptic();
    Alert.alert(
      "Appearance",
      "Choose your preferred app theme.",
      [
        {
          text: APPEARANCE_MODE_LABELS[APPEARANCE_MODE_SYSTEM],
          onPress: () => setAppearanceMode(APPEARANCE_MODE_SYSTEM),
        },
        {
          text: APPEARANCE_MODE_LABELS[APPEARANCE_MODE_LIGHT],
          onPress: () => setAppearanceMode(APPEARANCE_MODE_LIGHT),
        },
        {
          text: APPEARANCE_MODE_LABELS[APPEARANCE_MODE_DARK],
          onPress: () => setAppearanceMode(APPEARANCE_MODE_DARK),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }, [triggerSelectionHaptic]);

  const dismissHint = useCallback(() => {
    triggerSelectionHaptic();
    setShowHint(false);
    AsyncStorage.setItem(HINT_DISMISSED_STORAGE_KEY, "1").catch(() => {});
  }, [triggerSelectionHaptic]);

  const onZoomChange = useCallback((value) => {
    setZoomPercent(value);
  }, []);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const queryFiltered = normalizedQuery
      ? notes.filter((note) => {
        const title = (note.title ?? "").toLowerCase();
        const content = (note.content ?? "").toLowerCase();
        const tags = normalizeTags(note.tags).join(" ").toLowerCase();
        return (
          title.includes(normalizedQuery)
          || content.includes(normalizedQuery)
          || tags.includes(normalizedQuery)
        );
      })
      : notes;

    const sorted = [...queryFiltered];

    if (sortMode === "title") {
      sorted.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    } else if (sortMode === "size") {
      sorted.sort((a, b) => (b.radius ?? 0) - (a.radius ?? 0));
    } else {
      sorted.sort((a, b) => {
        const aTime = Date.parse(a.updatedAt ?? "") || 0;
        const bTime = Date.parse(b.updatedAt ?? "") || 0;
        return bTime - aTime;
      });
    }

    return sorted;
  }, [notes, searchQuery, sortMode]);

  useAnimatedReaction(
    () => Math.round(scale.value * 100),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(onZoomChange)(current);
      }
    }
  );

  const resetCamera = useCallback(
    (withFeedback = true) => {
      const bounds = getTranslateBounds(
        canvas.contentWidth,
        canvas.contentHeight,
        width,
        height,
        1
      );
      const targetX = (bounds.minX + bounds.maxX) / 2;
      const targetY = (bounds.minY + bounds.maxY) / 2;

      scale.value = withTiming(1, { duration: 220 });
      translateX.value = withTiming(targetX, { duration: 220 });
      translateY.value = withTiming(targetY, { duration: 220 });
      persistCameraState(1, targetX, targetY);

      if (withFeedback) {
        triggerSelectionHaptic();
      }
    },
    [
      canvas.contentHeight,
      canvas.contentWidth,
      height,
      scale,
      translateX,
      translateY,
      persistCameraState,
      triggerSelectionHaptic,
      width,
    ]
  );

  useEffect(() => {
    if (!isNotesHydrated) {
      return;
    }

    if (notes.length === 0) {
      setCanvas({
        nodes: [],
        contentWidth: width,
        contentHeight: height,
      });
      setIsSimulating(false);
      setSimulationError(null);
      return;
    }

    let isActive = true;
    setIsSimulating(true);
    setSimulationError(null);

    const timerId = setTimeout(() => {
      try {
        const result = runSimulation(
          notes.map((n) => ({ ...n })),
          width,
          height
        );
        if (isActive) {
          setCanvas(result);
          setIsSimulating(false);
        }
      } catch {
        if (isActive) {
          setSimulationError("Layout failed. Tap Retry to rebuild the bubble map.");
          setIsSimulating(false);
        }
      }
    }, 80);

    return () => {
      isActive = false;
      clearTimeout(timerId);
    };
  }, [height, isNotesHydrated, notes, width]);

  useEffect(() => {
    const bounds = getTranslateBounds(
      canvas.contentWidth,
      canvas.contentHeight,
      width,
      height,
      scale.value
    );

    if (!hasInitializedCamera.current && canvas.nodes.length === 0) {
      return;
    }

    if (!hasInitializedCamera.current) {
      const savedCamera = restoredCameraRef.current;

      if (savedCamera) {
        const restoredScale = clampValue(savedCamera.scale, MIN_SCALE, MAX_SCALE);
        const restoredBounds = getTranslateBounds(
          canvas.contentWidth,
          canvas.contentHeight,
          width,
          height,
          restoredScale
        );

        scale.value = restoredScale;
        translateX.value = clampValue(
          savedCamera.translateX,
          restoredBounds.minX,
          restoredBounds.maxX
        );
        translateY.value = clampValue(
          savedCamera.translateY,
          restoredBounds.minY,
          restoredBounds.maxY
        );
        restoredCameraRef.current = null;
      } else {
        translateX.value = (bounds.minX + bounds.maxX) / 2;
        translateY.value = (bounds.minY + bounds.maxY) / 2;
      }

      hasInitializedCamera.current = true;
      return;
    }

    translateX.value = clampValue(translateX.value, bounds.minX, bounds.maxX);
    translateY.value = clampValue(translateY.value, bounds.minY, bounds.maxY);
  }, [canvas.contentHeight, canvas.contentWidth, canvas.nodes.length, height, scale, translateX, translateY, width]);

  const openNote = useCallback((note) => {
    setSelectedNote(note);
  }, []);

  const handleCanvasTap = useCallback((tapX, tapY) => {
    const currentScale = scale.value;
    if (!Number.isFinite(currentScale) || currentScale <= 0) {
      return;
    }

    const worldX = (tapX - translateX.value) / currentScale;
    const worldY = (tapY - translateY.value) / currentScale;

    let tappedNode = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const node of canvas.nodes) {
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= node.radius && distance < minDistance) {
        tappedNode = node;
        minDistance = distance;
      }
    }

    if (!tappedNode) {
      return;
    }

    triggerSelectionHaptic();

    if (selectionMode) {
      toggleSelectionForId(tappedNode.id);
      return;
    }

    openNote(tappedNode);
  }, [canvas.nodes, openNote, scale, selectionMode, toggleSelectionForId, translateX, translateY, triggerSelectionHaptic]);

  const gestures = useMemo(() => {
    const getBounds = (nextScale) => {
      "worklet";

      const scaledWidth = canvas.contentWidth * nextScale;
      const scaledHeight = canvas.contentHeight * nextScale;

      let minX;
      let maxX;
      if (scaledWidth <= width) {
        const centeredX = (width - scaledWidth) / 2;
        minX = centeredX;
        maxX = centeredX;
      } else {
        minX = width - scaledWidth;
        maxX = 0;
      }

      let minY;
      let maxY;
      if (scaledHeight <= height) {
        const centeredY = (height - scaledHeight) / 2;
        minY = centeredY;
        maxY = centeredY;
      } else {
        minY = height - scaledHeight;
        maxY = 0;
      }

      return { minX, maxX, minY, maxY };
    };

    const pan = Gesture.Pan()
      .minDistance(8)
      .onBegin(() => {
        panStartX.value = translateX.value;
        panStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        const bounds = getBounds(scale.value);

        const nextX = panStartX.value + event.translationX;
        const nextY = panStartY.value + event.translationY;

        translateX.value = Math.min(bounds.maxX, Math.max(bounds.minX, nextX));
        translateY.value = Math.min(bounds.maxY, Math.max(bounds.minY, nextY));
      })
      .onEnd(() => {
        runOnJS(persistCameraState)(scale.value, translateX.value, translateY.value);
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        pinchStartScale.value = scale.value;
        pinchStartX.value = translateX.value;
        pinchStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchStartScale.value * event.scale)
        );

        const scaleRatio = nextScale / pinchStartScale.value;
        const candidateX = event.focalX - (event.focalX - pinchStartX.value) * scaleRatio;
        const candidateY = event.focalY - (event.focalY - pinchStartY.value) * scaleRatio;

        const bounds = getBounds(nextScale);

        scale.value = nextScale;
        translateX.value = Math.min(bounds.maxX, Math.max(bounds.minX, candidateX));
        translateY.value = Math.min(bounds.maxY, Math.max(bounds.minY, candidateY));
      })
      .onEnd(() => {
        runOnJS(persistCameraState)(scale.value, translateX.value, translateY.value);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(240)
      .onEnd((event, success) => {
        if (!success) {
          return;
        }

        const zoomingIn = scale.value < 1.25;
        const nextScale = zoomingIn ? 1.4 : 1;
        const bounds = getBounds(nextScale);

        let targetX = (bounds.minX + bounds.maxX) / 2;
        let targetY = (bounds.minY + bounds.maxY) / 2;

        if (zoomingIn) {
          const scaleRatio = nextScale / scale.value;
          const candidateX = event.x - (event.x - translateX.value) * scaleRatio;
          const candidateY = event.y - (event.y - translateY.value) * scaleRatio;

          targetX = Math.min(bounds.maxX, Math.max(bounds.minX, candidateX));
          targetY = Math.min(bounds.maxY, Math.max(bounds.minY, candidateY));
        }

        scale.value = withTiming(nextScale, { duration: 220 });
        translateX.value = withTiming(targetX, { duration: 220 });
        translateY.value = withTiming(targetY, { duration: 220 });
        runOnJS(triggerSelectionHaptic)();
        runOnJS(persistCameraState)(nextScale, targetX, targetY);
      });

    const singleTap = Gesture.Tap()
      .maxDuration(240)
      .maxDistance(8)
      .onEnd((event, success) => {
        if (!success) {
          return;
        }

        runOnJS(handleCanvasTap)(event.x, event.y);
      });

    const tapGestures = Gesture.Exclusive(doubleTap, singleTap);

    return Gesture.Simultaneous(pan, pinch, tapGestures);
  }, [
    canvas.contentHeight,
    canvas.contentWidth,
    height,
    panStartX,
    panStartY,
    pinchStartScale,
    pinchStartX,
    pinchStartY,
    scale,
    translateX,
    translateY,
    handleCanvasTap,
    persistCameraState,
    triggerSelectionHaptic,
    width,
  ]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    setSelectedIds((current) => current.filter((id) => notes.some((note) => note.id === id)));
  }, [notes, selectionMode]);

  useEffect(() => {
    if (selectionMode && selectedIds.length === 0) {
      setSelectionMode(false);
    }
  }, [selectedIds.length, selectionMode]);

  useEffect(() => {
    if (viewMode === "list" && selectionMode) {
      clearSelection();
    }
  }, [clearSelection, selectionMode, viewMode]);

  const handleBubbleLongPress = useCallback((note) => {
    triggerSelectionHaptic();
    toggleSelectionForId(note.id);
  }, [toggleSelectionForId, triggerSelectionHaptic]);

  const addNote = useCallback(() => {
    triggerLightImpactHaptic();
    const now = new Date().toISOString();

    commitNotesUpdate((current) => {
      const title = `Note ${current.length + 1}`;
      const newNote = {
        id: Date.now(),
        title,
        content: "",
        tags: [DEFAULT_TAG],
        radius: getRadiusFromText(title),
        createdAt: now,
        updatedAt: now,
      };
      return [...current, newNote];
    });
  }, [commitNotesUpdate, triggerLightImpactHaptic]);

  const saveNote = useCallback((updatedNote) => {
    if (!selectedNote) {
      return;
    }

    const nextTitleRaw = typeof updatedNote === "string"
      ? updatedNote
      : updatedNote?.title ?? "";
    const nextTitle = nextTitleRaw.trim() || "Untitled";
    const nextContent = typeof updatedNote === "string"
      ? ""
      : updatedNote?.content ?? "";
    const nextTags = normalizeTags(updatedNote?.tags);
    const nextRadius = getRadiusFromText(`${nextTitle} ${nextContent}`);
    const now = new Date().toISOString();

    commitNotesUpdate((current) => (
      current.map((note) => (
        note.id === selectedNote.id
          ? {
            ...note,
            title: nextTitle,
            content: nextContent,
            tags: nextTags,
            radius: nextRadius,
            updatedAt: now,
          }
          : note
      ))
    ));

    triggerSelectionHaptic();
    setSelectedNote(null);
  }, [commitNotesUpdate, selectedNote, triggerSelectionHaptic]);

  const deleteNote = useCallback((noteId) => {
    commitNotesUpdate((current) => current.filter((item) => item.id !== noteId));
    triggerSelectionHaptic();
    setSelectedNote(null);
  }, [commitNotesUpdate, triggerSelectionHaptic]);

  const deleteSelectedNotes = useCallback(() => {
    if (selectedIds.length === 0) {
      return;
    }

    Alert.alert(
      "Delete selected notes?",
      `This will remove ${selectedIds.length} note${selectedIds.length === 1 ? "" : "s"}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            commitNotesUpdate((current) => current.filter((item) => !selectedIds.includes(item.id)));
            clearSelection();
            triggerSelectionHaptic();
          },
        },
      ]
    );
  }, [clearSelection, commitNotesUpdate, selectedIds, triggerSelectionHaptic]);

  const applyTagToSelected = useCallback((tag) => {
    if (selectedIds.length === 0) {
      return;
    }

    const nextTag = normalizeTag(tag);
    const now = new Date().toISOString();

    commitNotesUpdate((current) => (
      current.map((note) => (
        selectedIds.includes(note.id)
          ? {
            ...note,
            tags: [nextTag],
            updatedAt: now,
          }
          : note
      ))
    ));
    triggerSelectionHaptic();
    clearSelection();
  }, [clearSelection, commitNotesUpdate, selectedIds, triggerSelectionHaptic]);

  if (selectedNote) {
    return (
      <NoteScreen
        note={selectedNote}
        onBack={() => setSelectedNote(null)}
        onSave={saveNote}
        onDelete={deleteNote}
        tagOptions={TAG_OPTIONS}
        theme={theme}
        appearanceMode={appearanceMode}
        onOpenAppearancePicker={openAppearancePicker}
      />
    );
  }

  const topInset = Math.max(insets.top + 8, 16);
  const fabBottom = Math.max(insets.bottom + 14, 30);
  const hintBottom = Math.max(insets.bottom + 84, 110);
  const contentTopInset = topInset + 58;
  const isListMode = viewMode === "list";
  const selectedCount = selectedIds.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          position: "absolute",
          top: topInset,
          left: 14,
          right: 14,
          zIndex: 40,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={toggleViewMode}
            accessibilityRole="button"
            accessibilityLabel={isListMode ? "Switch to canvas view" : "Switch to list view"}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 16,
              minWidth: 62,
              alignItems: "center",
              backgroundColor: theme.surfaceStrong,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>
              {isListMode ? "Map" : "List"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openAppearancePicker}
            accessibilityRole="button"
            accessibilityLabel="Change app appearance"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 16,
              minWidth: 70,
              alignItems: "center",
              backgroundColor: theme.surfaceStrong,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>
              {appearanceLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={undoNotes}
            disabled={!historyState.canUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo last change"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 16,
              minWidth: 62,
              alignItems: "center",
              opacity: historyState.canUndo ? 1 : 0.45,
              backgroundColor: theme.surfaceStrong,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={redoNotes}
            disabled={!historyState.canRedo}
            accessibilityRole="button"
            accessibilityLabel="Redo change"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 16,
              minWidth: 62,
              alignItems: "center",
              opacity: historyState.canRedo ? 1 : 0.45,
              backgroundColor: theme.surfaceStrong,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>Redo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={!isListMode ? () => resetCamera(true) : undefined}
        disabled={isListMode}
        accessibilityRole="button"
        accessibilityLabel={isListMode
          ? `Notes ${notes.length}. Zoom ${zoomPercent} percent.`
          : `Notes ${notes.length}. Zoom ${zoomPercent} percent. Tap to recenter canvas.`}
        accessibilityHint={isListMode ? undefined : "Resets zoom and moves bubbles back to center"}
        accessibilityState={{ disabled: isListMode }}
        style={{
          position: "absolute",
          left: 14,
          bottom: fabBottom,
          zIndex: 41,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 18,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.hintBorder,
          opacity: isListMode ? 0.78 : 1,
        }}
      >
        <Text style={{ color: theme.textPrimary, fontSize: 12 }}>Notes {notes.length}</Text>
        <Text style={{ color: theme.accentText, fontSize: 12 }}>{zoomPercent}%</Text>
      </TouchableOpacity>

      {isListMode ? (
        <View
          style={{
            flex: 1,
            paddingTop: contentTopInset,
            paddingHorizontal: 14,
            paddingBottom: fabBottom + 56,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
              marginBottom: 12,
            }}
          >
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search notes"
              placeholderTextColor={theme.placeholder}
              accessibilityLabel="Search notes"
              style={{
                flex: 1,
                color: theme.textPrimary,
                paddingVertical: 10,
              }}
            />
            {searchQuery.trim().length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={{ paddingHorizontal: 6, paddingVertical: 6 }}
              >
                <Text style={{ color: theme.textSecondary }}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {[
              { key: "recent", label: "Recent" },
              { key: "title", label: "Title" },
              { key: "size", label: "Size" },
            ].map((option) => {
              const selected = sortMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setSortMode(option.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort notes by ${option.label.toLowerCase()}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? theme.selectedBorder : theme.border,
                    backgroundColor: selected ? theme.selectedBackground : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? theme.selectedText : theme.textSecondary,
                      fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isNotesHydrated && filteredNotes.length === 0 ? (
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: "600", marginBottom: 4 }}>
                No matches
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                Try a different search query or add a new note.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 4 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredNotes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  onPress={() => openNote(note)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${note.title || "Untitled"}, tagged ${normalizeTags(note.tags)[0]}`}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: theme.textPrimary,
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 4,
                    }}
                    numberOfLines={1}
                  >
                    {note.title || "Untitled"}
                  </Text>
                  <Text
                    style={{ color: theme.textSecondary, lineHeight: 20 }}
                    numberOfLines={2}
                  >
                    {note.content?.trim() || "No content yet."}
                  </Text>

                  <View
                    style={{
                      marginTop: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: note.color,
                        backgroundColor: note.fill,
                      }}
                    >
                      <Text style={{ color: theme.textPrimary, fontSize: 11, fontWeight: "600" }}>
                        {normalizeTags(note.tags)[0]}
                      </Text>
                    </View>

                    <Text style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={1}>
                      {formatUpdatedAtLabel(note.updatedAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <GestureDetector gesture={gestures}>
          <View style={{ flex: 1, overflow: "hidden" }}>
            <Animated.View
              style={[
                {
                  width: canvas.contentWidth,
                  height: canvas.contentHeight,
                },
                cameraStyle,
              ]}
            >
              <BubbleCanvas
                nodes={canvas.nodes}
                width={canvas.contentWidth}
                height={canvas.contentHeight}
                onLongPressBubble={handleBubbleLongPress}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                labelColor={theme.bubbleLabel}
                selectedBubbleStroke={theme.selectedBubbleStroke}
                selectedBubbleFill={theme.selectedBubbleFill}
              />
            </Animated.View>
          </View>
        </GestureDetector>
      )}

      {!isNotesHydrated || (!isListMode && isSimulating && canvas.nodes.length === 0) ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.loadingBorder,
              backgroundColor: theme.loadingSurface,
              paddingHorizontal: 16,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={theme.loadingSpinner} />
            <Text style={{ color: theme.loadingText, marginTop: 8, fontSize: 12 }}>
              Loading your bubble map...
            </Text>
          </View>
        </View>
      ) : null}

      {isNotesHydrated && notes.length === 0 && !simulationError ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 43,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "600", marginBottom: 8 }}>
            No notes yet
          </Text>
          <Text style={{ color: theme.textSecondary, textAlign: "center", marginBottom: 14 }}>
            Start by creating your first bubble note.
          </Text>
          <TouchableOpacity
            onPress={addNote}
            accessibilityRole="button"
            accessibilityLabel="Create first note"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: theme.surfaceStrong,
              borderWidth: 1,
              borderColor: theme.borderStrong,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>Create first note</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!isListMode && simulationError ? (
        <View
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: hintBottom,
            zIndex: 46,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.errorBorder,
            backgroundColor: theme.errorSurface,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: theme.errorText, marginBottom: 10 }}>{simulationError}</Text>
          <TouchableOpacity
            onPress={rerunSimulation}
            accessibilityRole="button"
            accessibilityLabel="Retry bubble layout"
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: theme.surfaceStrong,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!isListMode && selectionMode ? (
        <View
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: fabBottom + 72,
            zIndex: 47,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surfaceElevated,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
              {selectedCount} selected
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={clearSelection}
                accessibilityRole="button"
                accessibilityLabel="Cancel selection mode"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: theme.surfaceStrong,
                }}
              >
                <Text style={{ color: theme.textPrimary, fontWeight: "600", fontSize: 12 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={deleteSelectedNotes}
                accessibilityRole="button"
                accessibilityLabel="Delete selected notes"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: theme.dangerSurface,
                  borderWidth: 1,
                  borderColor: theme.dangerBorder,
                }}
              >
                <Text style={{ color: theme.dangerText, fontWeight: "600", fontSize: 12 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TAG_OPTIONS.map((tag) => {
                const theme = getTagTheme(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => applyTagToSelected(tag)}
                    accessibilityRole="button"
                    accessibilityLabel={`Apply ${tag} tag to selected notes`}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.stroke,
                      backgroundColor: theme.fill,
                    }}
                  >
                    <Text style={{ color: "#eff6ff", fontWeight: "600", fontSize: 12 }}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {!isListMode && isHintReady && showHint ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: hintBottom,
            zIndex: 45,
          }}
        >
          <View
            style={{
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: theme.hintSurface,
              borderWidth: 1,
              borderColor: theme.hintBorder,
            }}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 13, marginBottom: 8 }}>
              Tap bubble to edit. Drag to explore. Pinch or double-tap to zoom.
            </Text>
            <TouchableOpacity
              onPress={dismissHint}
              accessibilityRole="button"
              accessibilityLabel="Dismiss guidance"
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: theme.surfaceStrong,
              }}
            >
              <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={addNote}
        disabled={!isNotesHydrated}
        accessibilityRole="button"
        accessibilityLabel="Add note"
        accessibilityHint="Creates a new bubble note"
        style={{
          position: "absolute",
          bottom: fabBottom,
          right: 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          opacity: isNotesHydrated ? 1 : 0.6,
          backgroundColor: theme.surfaceStrong,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.fabText, fontSize: 24 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}