import { findStartAndGoal, generateMaze } from "@/helpers/generate";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import Joystick from "./Joystick";
import Maze from "./Maze";
import Player from "./Player";
import Target from "./Target";

// --- Gameplay constants ----------------------------------------------------
// The whole game logic works in *tile units* (1 unit = 1 maze cell) so it is
// completely independent of screen size / pixel density. `tileSize` (computed
// from the available screen area) is only used to scale rendering. This is the
// key to stable behaviour across phones, folds, 21:9 and tablets.

const MAX_LEVEL = 7;
const GRID_SIZE = 21; // must stay odd for the maze generator

const PLAYER_TILES = 0.7; // player diameter, in tiles
const TARGET_TILES = 0.8; // target size, in tiles
const SPEED_TILES = 0.55; // player movement per animation frame, in tiles

// Space (in px) reserved on top/bottom for the HUD and the joystick so the
// maze is always centered in the remaining area.
const HUD_RESERVED = 96;
const JOYSTICK_RESERVED = 210;
const H_MARGIN = 8;

const getTimeForLevel = (level: number) => {
  return Math.max(5, 35 - (level - 1) * 5);
};

const GameScreen: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive layout: pick the largest tile size that fits the maze fully
  // within the usable area (after reserving room for HUD + joystick + safe
  // area), then center the square maze inside that area.
  const layout = useMemo(() => {
    const topReserved = insets.top + HUD_RESERVED;
    const bottomReserved = insets.bottom + JOYSTICK_RESERVED;
    const availW = width - H_MARGIN * 2;
    const availH = height - topReserved - bottomReserved;

    const tileSize = Math.max(
      4,
      Math.floor(Math.min(availW / GRID_SIZE, availH / GRID_SIZE)),
    );
    const mazeSize = tileSize * GRID_SIZE;
    const left = Math.round((width - mazeSize) / 2);
    const top = Math.round(topReserved + Math.max(0, availH - mazeSize) / 2);

    return { tileSize, mazeSize, left, top };
  }, [width, height, insets.top, insets.bottom]);

  const { tileSize, mazeSize, left: mazeLeft, top: mazeTop } = layout;

  const [countdown, setCountdown] = useState(getTimeForLevel(1));
  const [maxCountdown, setMaxCountdown] = useState(getTimeForLevel(1));
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [flash, setFlash] = useState(false);
  const [maze, setMaze] = useState<number[][]>([]);
  // playerPos / targetPos are the top-left corner of each entity, in TILE units.
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [joystickDirection, setJoystickDirection] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const joystickDirectionRef = useRef({ x: 0, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(1);
  const [relocations, setRelocations] = useState(0);
  const [bestLevel, setBestLevel] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [showWinScreen, setShowWinScreen] = useState(false);

  useEffect(() => {
    loadBestLevel();
  }, []);

  const saveBestLevel = async (level: number) => {
    try {
      await AsyncStorage.setItem("bestLevel", level.toString());
    } catch (e) {
      console.error("Błąd zapisu najlepszego poziomu:", e);
    }
  };

  const loadBestLevel = async () => {
    try {
      const storedLevel = await AsyncStorage.getItem("bestLevel");
      if (storedLevel !== null) {
        setBestLevel(parseInt(storedLevel, 10));
      }
    } catch (e) {
      console.error("Błąd odczytu najlepszego poziomu:", e);
    }
  };

  // Place an entity centered inside the given grid cell (tile units).
  const cellToPos = (cell: { x: number; y: number }, sizeTiles: number) => ({
    x: cell.x + (1 - sizeTiles) / 2,
    y: cell.y + (1 - sizeTiles) / 2,
  });

  const initializeGame = () => {
    const newMaze = generateMaze(GRID_SIZE);
    const { start, goal } = findStartAndGoal(newMaze);

    const time = getTimeForLevel(level);
    setCountdown(time);
    setMaxCountdown(time);

    setMaze(newMaze);
    setPlayerPos(cellToPos(start, PLAYER_TILES));
    setTargetPos(cellToPos(goal, TARGET_TILES));

    setJoystickDirection({ x: 0, y: 0 });
    joystickDirectionRef.current = { x: 0, y: 0 };
    setGameOver(false);
    setFlash(false);
  };

  useEffect(() => {
    initializeGame();
  }, [level]);

  // Collision test in tile units: any of the player's four corners landing on
  // a wall (or outside the grid) counts as a collision.
  const isCollidingWithWall = React.useCallback(
    (x: number, y: number) => {
      if (maze.length === 0) return true;
      const corners = [
        { x, y },
        { x: x + PLAYER_TILES, y },
        { x, y: y + PLAYER_TILES },
        { x: x + PLAYER_TILES, y: y + PLAYER_TILES },
      ];

      for (const corner of corners) {
        const gridX = Math.floor(corner.x);
        const gridY = Math.floor(corner.y);

        if (
          gridY < 0 ||
          gridY >= maze.length ||
          gridX < 0 ||
          gridX >= maze[0].length ||
          maze[gridY][gridX] === 1
        ) {
          return true;
        }
      }

      return false;
    },
    [maze],
  );

  useEffect(() => {
    joystickDirectionRef.current = joystickDirection;
  }, [joystickDirection]);

  // Movement loop. Reads joystick direction from a ref so we don't re-subscribe
  // every frame. X and Y are resolved independently so the player slides along
  // walls instead of sticking.
  useEffect(() => {
    if (maze.length === 0 || showStartScreen || isPaused || gameOver) return;

    const animatePlayer = () => {
      setPlayerPos((prevPos) => {
        const dir = joystickDirectionRef.current;
        let newX = prevPos.x + dir.x * SPEED_TILES;
        let newY = prevPos.y + dir.y * SPEED_TILES;

        if (isCollidingWithWall(newX, prevPos.y)) newX = prevPos.x;
        if (isCollidingWithWall(prevPos.x, newY)) newY = prevPos.y;

        return { x: newX, y: newY };
      });

      animationFrameRef.current = requestAnimationFrame(animatePlayer);
    };

    animationFrameRef.current = requestAnimationFrame(animatePlayer);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [maze, showStartScreen, isPaused, gameOver, isCollidingWithWall]);

  const playerPosRef = useRef(playerPos);
  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  // Win / next-level detection (tile units).
  useEffect(() => {
    if (gameOver || maze.length === 0 || showStartScreen) return;

    const distance = Math.hypot(
      playerPos.x + PLAYER_TILES / 2 - (targetPos.x + TARGET_TILES / 2),
      playerPos.y + PLAYER_TILES / 2 - (targetPos.y + TARGET_TILES / 2),
    );

    if (distance < (PLAYER_TILES + TARGET_TILES) / 2) {
      setJoystickDirection({ x: 0, y: 0 });
      Vibration.vibrate(200);

      if (level === MAX_LEVEL) {
        setGameOver(true);
        setShowWinScreen(true);
      } else {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        if (nextLevel > bestLevel) {
          setBestLevel(nextLevel);
          saveBestLevel(nextLevel);
        }
      }
    }
  }, [playerPos, targetPos, gameOver, maze, showStartScreen]);

  // Countdown + target relocation.
  useEffect(() => {
    if (isPaused) return;
    if (maze.length === 0 || gameOver || showStartScreen) return;

    if (countdown === 0) {
      setRelocations((prev) => prev + 1);
      if (relocations + 1 >= 3) {
        Alert.alert(
          "Koniec gry",
          "Przekroczono limit relokacji. Gra zostanie zresetowana.",
          [
            {
              text: "OK",
              onPress: () => {
                setLevel(1);
                setRelocations(0);
              },
            },
          ],
        );
        return;
      }

      // Move the target to the free cell farthest from the player (tile units).
      const playerCenterX = playerPosRef.current.x + PLAYER_TILES / 2;
      const playerCenterY = playerPosRef.current.y + PLAYER_TILES / 2;

      let maxDistance = -1;
      let farthestCell = { x: 0, y: 0 };

      for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
          if (maze[y][x] === 0) {
            const distance = Math.hypot(
              x + 0.5 - playerCenterX,
              y + 0.5 - playerCenterY,
            );
            if (distance > maxDistance) {
              maxDistance = distance;
              farthestCell = { x, y };
            }
          }
        }
      }

      Vibration.vibrate([100, 100, 100]);
      setTargetPos(cellToPos(farthestCell, TARGET_TILES));
      const time = getTimeForLevel(level);
      setCountdown(time);
      setMaxCountdown(time);
      setFlash(false);
    }

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    let flashInterval: ReturnType<typeof setInterval> | null = null;

    if (countdown <= 2 && countdown > 0) {
      flashInterval = setInterval(() => {
        setFlash((prev) => !prev);
      }, 250);
    }

    return () => {
      clearInterval(interval);
      if (flashInterval) clearInterval(flashInterval);
    };
  }, [countdown, maze, gameOver, showStartScreen, isPaused]);

  if (maze.length === 0) return null;

  // Pixel geometry derived from the responsive tileSize. Player/Target are
  // positioned relative to the maze container (top-left of the grid = origin).
  const playerSizePx = PLAYER_TILES * tileSize;
  const targetSizePx = TARGET_TILES * tileSize;
  const playerPx = { x: playerPos.x * tileSize, y: playerPos.y * tileSize };
  const targetPx = { x: targetPos.x * tileSize, y: targetPos.y * tileSize };

  return (
    <View
      style={[styles.container, { backgroundColor: flash ? "#ddd" : "white" }]}
    >
      {showStartScreen && (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill}>
          <View style={styles.startOverlay}>
            <Image
              source={require("../assets/images/icon.png")}
              style={{ width: 120, height: 120 }}
            />
            <Text style={styles.startTitle}>Witaj w grze!</Text>
            <Text style={styles.gameName}>ShiftMaze</Text>
            <Pressable
              style={styles.startButton}
              onPress={() => {
                setShowStartScreen(false);
                initializeGame();
              }}
            >
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>

            <Text style={styles.bestLevelText}>
              Najwyższy level: {bestLevel}
            </Text>
          </View>
        </BlurView>
      )}

      {isPaused && (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill}>
          <View style={styles.startOverlay}>
            <Pressable
              onPress={() => {
                setIsPaused((prev) => !prev);
              }}
            >
              <FontAwesome name={"play"} size={94} />
            </Pressable>
          </View>
        </BlurView>
      )}

      {showWinScreen && (
        <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill}>
          <View style={styles.startOverlay}>
            <FontAwesome
              name="trophy"
              size={100}
              color="#FFD700"
              style={{ marginBottom: 20 }}
            />

            <Text style={styles.winTitle}>Gratulacje!</Text>
            <Text style={styles.winSubtitle}>Ukończyłeś grę 🎉</Text>
            <Pressable
              style={styles.startButton}
              onPress={() => {
                setShowWinScreen(false);
                setLevel(1);
                setRelocations(0);
                initializeGame();
              }}
            >
              <Text style={styles.startButtonText}>Zagraj ponownie</Text>
            </Pressable>
          </View>
        </BlurView>
      )}

      {/* Centered, responsively-sized maze container. Player and target are its
          children, so they always share the maze's coordinate space. */}
      <View
        style={{
          position: "absolute",
          left: mazeLeft,
          top: mazeTop,
          width: mazeSize,
          height: mazeSize,
        }}
      >
        <Maze
          mazeData={maze}
          tileSize={tileSize}
          color={
            level === MAX_LEVEL - 1
              ? "blue"
              : level === MAX_LEVEL
                ? "green"
                : undefined
          }
        />
        <Player position={playerPx} size={playerSizePx} />
        <Target position={targetPx} size={targetSizePx} />
      </View>

      {!showStartScreen && (
        <View style={[styles.hud, { top: insets.top + 8 }]}>
          <Pressable
            style={styles.hudSideButton}
            onPress={() => {
              setShowStartScreen(true);
            }}
          >
            <Image
              source={require("../assets/close.png")}
              style={{ width: 20, height: 20 }}
            />
          </Pressable>

          <View style={styles.hudCenter}>
            <Text>Cel zmieni się za:</Text>
            <Text
              style={[
                styles.countdownText,
                relocations === 2 && { color: "red" },
              ]}
            >
              {countdown}s / {maxCountdown}s
            </Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>Poziom: {level}</Text>
              <View style={styles.heartsContainer}>
                {[...Array(3)].map((_, index) => (
                  <FontAwesome
                    key={index}
                    name={index < 3 - relocations ? "heart" : "heart-o"}
                    size={22}
                    color={index < 3 - relocations ? "black" : "gray"}
                    style={{ marginHorizontal: 2 }}
                  />
                ))}
              </View>
            </View>
          </View>

          <Pressable
            style={styles.hudSideButton}
            onPress={() => {
              setIsPaused((prev) => !prev);
            }}
          >
            <FontAwesome name={isPaused ? "play" : "pause"} size={24} />
          </Pressable>
        </View>
      )}

      <Joystick
        onMove={(direction) => {
          setJoystickDirection(direction);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  hudSideButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  hudCenter: {
    flex: 1,
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  heartsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  countdownText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  startOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    zIndex: 999,
  },
  startTitle: {
    fontSize: 36,
    fontWeight: "400",
    marginBottom: 30,
    color: "#333",
  },
  gameName: {
    fontSize: 50,
    fontWeight: "900",
    marginBottom: 30,
    color: "#333",
    textAlign: "center",
  },
  startButton: {
    backgroundColor: "gray",
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  startButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  bestLevelText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "bold",
    position: "absolute",
    bottom: 50,
  },
  winTitle: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#2e2e2e",
  },
  winSubtitle: {
    fontSize: 24,
    marginBottom: 30,
    color: "#444",
  },
});

export default GameScreen;
