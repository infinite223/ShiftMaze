import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface TileProps {
  owner: number;
  onPress: (row: number, col: number) => void;
  row: number;
  col: number;
}

const Tile: React.FC<TileProps> = ({ owner, onPress, row, col }) => {
  const backgroundColor =
    owner === 1 ? "lightblue" : owner === 2 ? "lightcoral" : "lightgray";
  const unitCount = owner ? 1 : 0;

  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor }]}
      onPress={() => onPress(row, col)}
    >
      {owner !== 0 && <Text style={styles.unitCount}>{unitCount}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: "gray",
    justifyContent: "center",
    alignItems: "center",
  },
  unitCount: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Tile;
