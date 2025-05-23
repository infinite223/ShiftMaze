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
const TOP_UI_HEIGHT = 0; // szacunkowa wysokość UI (licznik + margines)
const MAZE_OFFSET_Y = (windowHeight - MAZE_HEIGHT) / 2 + TOP_UI_HEIGHT / 2;

const PLAYER_SPEED = 7;

const GameScreen: React.FC = () => {
  const [countdown, setCountdown] = useState(4);
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
  const getGridSize = (level: number) => 21 + (level - 1) * 2;
  const [relocations, setRelocations] = useState(0);
  const [bestLevel, setBestLevel] = useState(1);

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
    const gridSize = getGridSize(level);
    const newMaze = generateMaze(gridSize);
    const { start, goal } = findStartAndGoal(newMaze);

    // Dynamiczne obliczenia
    const mazeWidth = TILE_SIZE * gridSize;
    const mazeHeight = TILE_SIZE * gridSize;
    const mazeOffsetX = (windowWidth - mazeWidth) / 2;
    const mazeOffsetY = (windowHeight - mazeHeight) / 2 + TOP_UI_HEIGHT / 2;

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
    setCountdown(15);
    setFlash(false);
  };

  useEffect(() => {
    initializeGame();
  }, []);

  const isCollidingWithWall = React.useCallback(
    (x: number, y: number) => {
      const corners = [
        { x: x, y: y },
        { x: x + PLAYER_SIZE, y: y },
        { x: x, y: y + PLAYER_SIZE },
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
    if (maze.length === 0 || showStartScreen) return;

    const animatePlayer = () => {
      setPlayerPos((prevPos) => {
        const dir = joystickDirectionRef.current;
        let newX = prevPos.x + dir.x * PLAYER_SPEED;
        let newY = prevPos.y + dir.y * PLAYER_SPEED;

        if (isCollidingWithWall(newX, prevPos.y)) {
          newX = prevPos.x;
        }
        if (isCollidingWithWall(prevPos.x, newY)) {
          newY = prevPos.y;
        }

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
  }, [maze, showStartScreen]);

  useEffect(() => {
    if (gameOver || maze.length === 0 || showStartScreen) return;

    const distance = Math.sqrt(
      (playerPos.x + PLAYER_SIZE / 2 - (targetPos.x + TARGET_SIZE / 2)) ** 2 +
        (playerPos.y + PLAYER_SIZE / 2 - (targetPos.y + TARGET_SIZE / 2)) ** 2
    );

    if (distance < PLAYER_SIZE / 2 + TARGET_SIZE / 2) {
      setGameOver(true);
      setJoystickDirection({ x: 0, y: 0 });
      setCountdown(15);
      setFlash(false);
      Vibration.vibrate(200);
      if (level + 1 > bestLevel) {
        setBestLevel(level + 1);
        saveBestLevel(level + 1);
      }
      setLevel((prev) => prev + 1);
      initializeGame();

      // Alert.alert("Gratulacje!", "Dotarłeś do celu!", [
      //   {
      //     text: "OK",
      //     onPress: () => {
      //       initializeGame();
      //     },
      //   },
      // ]);
    }
  }, [playerPos, targetPos, gameOver, maze, showStartScreen]);

  const playerPosRef = useRef(playerPos);

  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
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
                initializeGame();
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

            const distance = Math.sqrt(
              (cellX + TARGET_SIZE / 2 - playerCenter.x) ** 2 +
                (cellY + TARGET_SIZE / 2 - playerCenter.y) ** 2
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
      setCountdown(15);
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
  }, [countdown, maze, gameOver, showStartScreen]);

  if (maze.length === 0) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: flash ? "#ddd" : "white" }]}
    >
      {showStartScreen && (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill}>
          <View style={styles.startOverlay}>
            <Text style={styles.startTitle}>Witaj w grze!</Text>
            <Text style={styles.gameName}>ShiftMaze</Text>

            <Pressable
              style={styles.startButton}
              onPress={() => {
                initializeGame();
                setShowStartScreen(false);
              }}
            >
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>
          </View>
        </BlurView>
      )}
      {!showStartScreen && (
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
      )}
      {!showStartScreen && (
        <View style={styles.countdownContainer}>
          <Text
            style={[
              styles.countdownText,
              relocations === 2 && { color: "red" },
            ]}
          >
            Cel zmieni się za: {countdown} s
          </Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Poziom: {level}</Text>
            <Text style={styles.statusText}>Relokacje: {relocations}/3</Text>
          </View>
        </View>
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
    top: 40,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
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

  endButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    position: "absolute",
    top: 84,
    left: 10,
  },

  endButtonText: {
    fontSize: 40,
    fontWeight: "bold",
  },

  countdownContainer: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
  },

  countdownText: {
    fontSize: 24,
    fontWeight: "bold",
  },
});

export default GameScreen;
