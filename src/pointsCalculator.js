export const calculatePoints = (
  predictedHome,
  predictedAway,
  actualHome,
  actualAway
) => {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 5;
  }

  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;

  const predictedWinner =
    predictedDiff > 0 ? 'home' : predictedDiff < 0 ? 'away' : 'draw';
  const actualWinner =
    actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';

  if (predictedWinner !== actualWinner) {
    return 0;
  }

  if (predictedWinner === 'draw') {
    return 3;
  }

  if (Math.abs(predictedDiff) === Math.abs(actualDiff)) {
    return 3;
  }

  return 1;
};
