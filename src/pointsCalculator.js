export const calculatePoints = (
  predictedHome,
  predictedAway,
  actualHome,
  actualAway
) => {
  // Exact score
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 6;
  }

  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;

  const predictedWinner =
    predictedDiff > 0 ? 'home' : predictedDiff < 0 ? 'away' : 'draw';
  const actualWinner =
    actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';

  // Wrong winner -> 0 points
  if (predictedWinner !== actualWinner) {
    return 0;
  }

  // Correct draw (but not exact) -> 4 points
  if (predictedWinner === 'draw') {
    return 4;
  }

  // Correct goal difference (but not exact) -> 4 points
  if (Math.abs(predictedDiff) === Math.abs(actualDiff)) {
    return 4;
  }

  // Correct winner only -> 2 points
  return 2;
};
