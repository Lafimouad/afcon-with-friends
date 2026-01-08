export const calculatePoints = (
  predictedHome,
  predictedAway,
  actualHome,
  actualAway
) => {
  // Correct score: 10 points
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 10;
  }

  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;

  const predictedWinner =
    predictedDiff > 0 ? "home" : predictedDiff < 0 ? "away" : "draw";
  const actualWinner =
    actualDiff > 0 ? "home" : actualDiff < 0 ? "away" : "draw";

  // Wrong winner: 0 points
  if (predictedWinner !== actualWinner) {
    return 0;
  }

  // Correct winner + correct goal difference: 6 points
  if (Math.abs(predictedDiff) === Math.abs(actualDiff)) {
    return 6;
  }

  // Correct winner only: 2 points
  return 2;
};
