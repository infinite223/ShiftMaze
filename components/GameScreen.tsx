import { findStartAndGoal, generateMaze } from "@/helpers/generate";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import Joystick from "../components/Joystick";
import Maze from "../components/Maze";
import Player from "../components/Player";
import Target from "../components/Target";

const GRID_SIZE = 21;
const TILE_SIZE = Dimensions.get("window").width / (GRID_SIZE + 2);
const PLAYER_SIZE = TILE_SIZE * 0.7;
const TARGET_SIZE = TILE_SIZE * 0.8;

const MAZE_WIDTH = TILE_SIZE * GRID_SIZE;
const MAZE_HEIGHT = TILE_SIZE * GRID_SIZE;

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const MAZE_OFFSET_X = (windowWidth - MAZE_WIDTH) / 2;
const TOP_UI_HEIGHT = 0;
const MAZE_OFFSET_Y = (windowHeight - MAZE_HEIGHT) / 2 + TOP_UI_HEIGHT / 2;

const PLAYER_SPEED = 7;

// NOWOŚĆ: funkcja wyliczająca czas na poziom
const getTimeForLevel = (level: number) => {
  return Math.max(5, 35 - (level - 1) * 5);
};

const GameScreen: React.FC = () => {
  const [countdown, setCountdown] = useState(getTimeForLevel(1));
  const [maxCountdown, setMaxCountdown] = useState(getTimeForLevel(1));
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [flash, setFlash] = useState(false);
  const [maze, setMaze] = useState<number[][]>([]);
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

  const initializeGame = () => {
    const gridSize = GRID_SIZE;
    const newMaze = generateMaze(gridSize);
    const { start, goal } = findStartAndGoal(newMaze);

    const mazeWidth = TILE_SIZE * gridSize;
    const mazeHeight = TILE_SIZE * gridSize;
    const mazeOffsetX = (windowWidth - mazeWidth) / 2;
    const mazeOffsetY = (windowHeight - mazeHeight) / 2 + TOP_UI_HEIGHT / 2;

    const time = getTimeForLevel(level);
    setCountdown(time);
    setMaxCountdown(time);

    setMaze(newMaze);

    setPlayerPos({
      x: mazeOffsetX + TILE_SIZE * start.x + (TILE_SIZE - PLAYER_SIZE) / 2,
      y: mazeOffsetY + TILE_SIZE * start.y + (TILE_SIZE - PLAYER_SIZE) / 2,
    });

    setTargetPos({
      x: mazeOffsetX + TILE_SIZE * goal.x + (TILE_SIZE - TARGET_SIZE) / 2,
      y: mazeOffsetY + TILE_SIZE * goal.y + (TILE_SIZE - TARGET_SIZE) / 2,
    });

    setJoystickDirection({ x: 0, y: 0 });
    setGameOver(false);
    setFlash(false);
  };

  useEffect(() => {
    initializeGame();
  }, [level]);

  const isCollidingWithWall = React.useCallback(
    (x: number, y: number) => {
      const corners = [
        { x, y },
        { x: x + PLAYER_SIZE, y },
        { x, y: y + PLAYER_SIZE },
        { x: x + PLAYER_SIZE, y: y + PLAYER_SIZE },
      ];

      for (let corner of corners) {
        const gridX = Math.floor((corner.x - MAZE_OFFSET_X) / TILE_SIZE);
        const gridY = Math.floor((corner.y - MAZE_OFFSET_Y) / TILE_SIZE);

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
    [maze]
  );

  useEffect(() => {
    joystickDirectionRef.current = joystickDirection;
  }, [joystickDirection]);

  useEffect(() => {
    if (maze.length === 0 || showStartScreen || isPaused) return;

    const animatePlayer = () => {
      setPlayerPos((prevPos) => {
        const dir = joystickDirectionRef.current;
        let newX = prevPos.x + dir.x * PLAYER_SPEED;
        let newY = prevPos.y + dir.y * PLAYER_SPEED;

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
  }, [maze, showStartScreen, isPaused]);

  const playerPosRef = useRef(playerPos);
  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    if (gameOver || maze.length === 0 || showStartScreen) return;

    const distance = Math.hypot(
      playerPos.x + PLAYER_SIZE / 2 - (targetPos.x + TARGET_SIZE / 2),
      playerPos.y + PLAYER_SIZE / 2 - (targetPos.y + TARGET_SIZE / 2)
    );

    if (distance < PLAYER_SIZE / 2 + TARGET_SIZE / 2) {
      setGameOver(true);
      setJoystickDirection({ x: 0, y: 0 });

      Vibration.vibrate(200);
      const nextLevel = level + 1;
      setLevel(nextLevel);
      if (nextLevel > bestLevel) {
        setBestLevel(nextLevel);
        saveBestLevel(nextLevel);
      }
    }
  }, [playerPos, targetPos, gameOver, maze, showStartScreen]);

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
          ]
        );
        return;
      }

      const playerCenter = {
        x: playerPosRef.current.x + PLAYER_SIZE / 2,
        y: playerPosRef.current.y + PLAYER_SIZE / 2,
      };

      let maxDistance = -1;
      let farthestCell = { x: 0, y: 0 };

      for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
          if (maze[y][x] === 0) {
            const cellX =
              MAZE_OFFSET_X + TILE_SIZE * x + (TILE_SIZE - TARGET_SIZE) / 2;
            const cellY =
              MAZE_OFFSET_Y + TILE_SIZE * y + (TILE_SIZE - TARGET_SIZE) / 2;

            const distance = Math.hypot(
              cellX + TARGET_SIZE / 2 - playerCenter.x,
              cellY + TARGET_SIZE / 2 - playerCenter.y
            );

            if (distance > maxDistance) {
              maxDistance = distance;
              farthestCell = { x: cellX, y: cellY };
            }
          }
        }
      }

      Vibration.vibrate([100, 100, 100]);
      setTargetPos(farthestCell);
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
              style={styles.startButton2}
              onPress={() => {
                setIsPaused((prev) => !prev);
              }}
            >
              <FontAwesome name={"play"} size={94} />
            </Pressable>
          </View>
        </BlurView>
      )}

      {!showStartScreen && (
        <>
          <Pressable
            style={styles.endButton}
            onPress={() => {
              setShowStartScreen(true);
            }}
          >
            <Image
              source={require("../assets/close.png")}
              style={{ width: 20, height: 20 }}
            />
          </Pressable>

          <Pressable
            style={styles.pauseButton}
            onPress={() => {
              setIsPaused((prev) => !prev);
            }}
          >
            <FontAwesome name={isPaused ? "play" : "pause"} size={24} />
          </Pressable>

          <View style={styles.countdownContainer}>
            <View style={styles.countdownTextContainer}>
              <Text>Cel zmieni się za:</Text>
              <Text
                style={[
                  styles.countdownText,
                  relocations === 2 && { color: "red" },
                ]}
              >
                {countdown}s / {maxCountdown}s
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Poziom: {level}</Text>
              <View style={styles.heartsContainer}>
                {[...Array(3)].map((_, index) => (
                  <FontAwesome
                    key={index}
                    name={index < 3 - relocations ? "heart" : "heart-o"}
                    size={24}
                    color={index < 3 - relocations ? "black" : ""}
                    style={{ marginHorizontal: 2 }}
                  />
                ))}
              </View>
            </View>
          </View>
        </>
      )}

      <Maze mazeData={maze} tileSize={TILE_SIZE} />
      <Player position={playerPos} size={PLAYER_SIZE} />
      <Target position={targetPos} size={TARGET_SIZE} />
      <Joystick
        onMove={(direction) => {
          setJoystickDirection(direction);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    position: "absolute",
    top: 55,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 50,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: TILE_SIZE,
    backgroundColor: "white",
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
  endButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    position: "absolute",
    top: 84,
    left: 10,
  },
  heartsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  countdownContainer: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
  },
  countdownTextContainer: {
    alignItems: "center",
  },
  countdownText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  pauseButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 82,
    right: 10,
  },
  startButton2: {},
});

export default GameScreen;
