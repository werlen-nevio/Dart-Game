// Dart checkout calculator
// This file contains logic to calculate the optimal dart combination for any score

// Common checkout patterns (score -> array of dart combinations)
// Format: [dart1, dart2, dart3] where each dart is a string like "T20" (triple 20), "D20" (double 20), "20" (single 20)
export const CHECKOUTS = {
  2: [['D1']],
  3: [['1', 'D1']],
  4: [['D2']],
  5: [['1', 'D2']],
  6: [['D3']],
  7: [['1', 'D3']],
  8: [['D4']],
  9: [['1', 'D4']],
  10: [['D5']],
  11: [['1', 'D5']],
  12: [['D6']],
  13: [['1', 'D6']],
  14: [['D7']],
  15: [['3', 'D6']],
  16: [['D8']],
  17: [['1', 'D8']],
  18: [['D9']],
  19: [['7', 'D6']],
  20: [['D10']],
  21: [['1', 'D10']],
  22: [['D11']],
  23: [['3', 'D10']],
  24: [['D12']],
  25: [['1', 'D12']],
  26: [['D13']],
  27: [['11', 'D8']],
  28: [['D14']],
  29: [['5', 'D12']],
  30: [['D15']],
  31: [['7', 'D12']],
  32: [['D16']],
  33: [['1', 'D16']],
  34: [['D17']],
  35: [['11', 'D12']],
  36: [['D18']],
  37: [['5', 'D16']],
  38: [['D19']],
  39: [['15', 'D12']],
  40: [['D20']],
  41: [['1', 'D20']],
  42: [['10', 'D16']],
  43: [['3', 'D20']],
  44: [['12', 'D16']],
  45: [['5', 'D20']],
  46: [['6', 'D20']],
  47: [['7', 'D20']],
  48: [['16', 'D16']],
  49: [['9', 'D20']],
  50: [['Bull']],
  51: [['11', 'D20']],
  52: [['12', 'D20']],
  53: [['13', 'D20']],
  54: [['14', 'D20']],
  55: [['15', 'D20']],
  56: [['16', 'D20']],
  57: [['17', 'D20']],
  58: [['18', 'D20']],
  59: [['19', 'D20']],
  60: [['20', 'D20']],
  61: [['T15', 'D8']],
  62: [['T10', 'D16']],
  63: [['T13', 'D12']],
  64: [['T16', 'D8']],
  65: [['T11', 'D16']],
  66: [['T10', 'D18']],
  67: [['T17', 'D8']],
  68: [['T20', 'D4']],
  69: [['T19', 'D6']],
  70: [['T18', 'D8']],
  71: [['T13', 'D16']],
  72: [['T16', 'D12']],
  73: [['T19', 'D8']],
  74: [['T14', 'D16']],
  75: [['T17', 'D12']],
  76: [['T20', 'D8']],
  77: [['T19', 'D10']],
  78: [['T18', 'D12']],
  80: [['T20', 'D10']],
  81: [['T19', 'D12']],
  82: [['T14', 'D20']],
  84: [['T20', 'D12']],
  85: [['T15', 'D20']],
  86: [['T18', 'D16']],
  87: [['T17', 'D18']],
  88: [['T20', 'D14']],
  89: [['T19', 'D16']],
  90: [['T20', 'D15']],
  91: [['T17', 'D20']],
  92: [['T20', 'D16']],
  93: [['T19', 'D18']],
  94: [['T18', 'D20']],
  95: [['T19', 'D19']],
  96: [['T20', 'D18']],
  97: [['T19', 'D20']],
  98: [['T20', 'D19']],
  100: [['T20', 'D20']],
  101: [['T17', 'Bull']],
  104: [['T18', 'Bull']],
  107: [['T19', 'Bull']],
  110: [['T20', 'Bull']],
  117: [['T20', '17', 'D20']],
  132: [['Bull', 'Bull', 'D16']],
  135: [['Bull', 'T19', 'D14']],
  161: [['T20', 'T17', 'Bull']],
  164: [['T20', 'T18', 'Bull']],
  167: [['T20', 'T19', 'Bull']],
  170: [['T20', 'T20', 'Bull']],
};

// Format dart notation to display format
export function formatDart(dart) {
  if (dart === 'Bull') return 'Bull';

  const match = dart.match(/^([TDS]?)(\d+)$/);
  if (!match) return dart;

  const [, multiplier, number] = match;
  const mult = multiplier === 'T' ? 'T' : multiplier === 'D' ? 'D' : '';
  return `${mult}${number}`;
}

// Get the best checkout for a given score
export function getCheckout(score) {
  // No checkout possible
  if (score < 2 || score > 170) return null;

  // Score of 1 is impossible (can't finish on double)
  if (score === 1) return null;

  // Scores between 160-170 that aren't in our table
  const impossibleScores = [162, 163, 165, 166, 168, 169];
  if (impossibleScores.includes(score)) return null;

  // Get checkout from table
  const checkout = CHECKOUTS[score];
  if (!checkout || checkout.length === 0) return null;

  // Return the first (optimal) checkout
  return checkout[0];
}

// Get display text for a checkout
export function getCheckoutDisplay(score) {
  const checkout = getCheckout(score);
  if (!checkout) return null;

  return checkout.map(dart => formatDart(dart)).join(' → ');
}

// Check if a score has a possible checkout
export function hasCheckout(score) {
  return getCheckout(score) !== null;
}
