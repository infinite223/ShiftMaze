export const generateMaze = (size: number): number[][] => {
  const maze = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 1)
  );

  // Start od (1,1)
  const carve = (x: number, y: number) => {
    const dirs = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (
        nx > 0 &&
        nx < size - 1 &&
        ny > 0 &&
        ny < size - 1 &&
        maze[ny][nx] === 1
      ) {
        maze[ny][nx] = 0;
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  };

  maze[1][1] = 0;
  carve(1, 1);

  return maze;
};

export const getFreeCells = (maze: number[][]) => {
  const free: { x: number; y: number }[] = [];
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      if (maze[y][x] === 0) free.push({ x, y });
    }
  }
  return free;
};

export const findStartAndGoal = (maze: number[][]) => {
  const freeCells = getFreeCells(maze);

  // Na start losowo, potem możesz dodać BFS do max dystansu
  const start = freeCells[Math.floor(Math.random() * freeCells.length)];
  let goal = freeCells[Math.floor(Math.random() * freeCells.length)];

  // Upewnij się że nie są zbyt blisko
  while (
    Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y) <
    maze.length / 2
  ) {
    goal = freeCells[Math.floor(Math.random() * freeCells.length)];
  }

  return { start, goal };
};
