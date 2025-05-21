import React from "react";
import { StyleSheet, View } from "react-native";

interface MazeProps {
  mazeData: number[][];
  tileSize: number;
}

const Maze: React.FC<MazeProps> = ({ mazeData, tileSize }) => {
  return (
    <View>
      {mazeData.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => (
            <View
              key={`${rowIndex}-${colIndex}`}
              style={[
                styles.tile,
                {
                  width: tileSize,
                  height: tileSize,
                  backgroundColor: cell === 1 ? "black" : "lightgray",
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  tile: {
    borderWidth: 0.5,
    borderColor: "gray",
  },
});

export default Maze;
