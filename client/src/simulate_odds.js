// Pure JS simulator to calculate slot machine odds, hit frequencies, and RTP.
const SYMBOL_WEIGHTS = {
  crown:     2,
  lightning: 3,
  skull:     6,
  rose:      7,
  dagger:    10,
  anchor:    10,
  heart:     14,
  snake:     16,
  swallow:   16,
  diamond:   16,
};

const PAYOUT_TABLE = {
  crown:     [4,  10, 30],
  skull:     [4,  10, 30],
  rose:      [3,   8, 20],
  dagger:    [2,   5, 15],
  anchor:    [1.5, 4, 10],
  heart:     [1,   3,  6],
  snake:     [0.5, 2,  4],
  swallow:   [0.3, 1,  3],
  diamond:   [0.2, 0.5, 2],
};

const PAYLINES = [
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,0,0], [2,2,1,2,2], [1,0,0,0,1], [1,2,2,2,1], [1,0,1,0,1],
  [1,2,1,2,1], [0,1,0,1,0], [2,1,2,1,2], [0,1,1,1,0], [2,1,1,1,2],
  [1,1,0,1,1], [1,1,2,1,1], [0,0,1,2,2], [2,2,1,0,0], [0,2,0,2,0],
  [2,0,2,0,2], [1,0,0,1,2], [1,2,2,1,0], [0,2,1,2,0], [2,0,1,0,2]
];

const weightedPool = [];
for (const [sym, w] of Object.entries(SYMBOL_WEIGHTS)) {
  for (let i = 0; i < w; i++) weightedPool.push(sym);
}

function pickSymbol() {
  return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

function generateGrid() {
  const grid = [];
  for (let reel = 0; reel < 5; reel++) {
    const col = [];
    for (let row = 0; row < 3; row++) {
      col.push(pickSymbol());
    }
    grid.push(col);
  }
  return grid;
}

function generateForceScatterGrid() {
  const grid = generateGrid();
  // Force 6 scatters
  let placed = 0;
  while (placed < 6) {
    const r = Math.floor(Math.random() * 5);
    const w = Math.floor(Math.random() * 3);
    if (grid[r][w] !== 'lightning') {
      grid[r][w] = 'lightning';
      placed++;
    }
  }
  return grid;
}

function evaluatePaylines(grid, linesPlayed) {
  const wins = [];
  for (let li = 0; li < Math.min(linesPlayed, PAYLINES.length); li++) {
    const line = PAYLINES[li];
    const lineSymbols = line.map((row, reel) => grid[reel][row]);

    let baseSymbol = null;
    for (const s of lineSymbols) {
      if (s !== 'crown') { baseSymbol = s; break; }
    }
    if (!baseSymbol) baseSymbol = 'crown';
    if (baseSymbol === 'lightning') continue;

    let matchCount = 0;
    for (let reel = 0; reel < 5; reel++) {
      const sym = lineSymbols[reel];
      if (sym === baseSymbol || sym === 'crown') {
        matchCount++;
      } else {
        break;
      }
    }

    if (matchCount >= 3) {
      const payouts = PAYOUT_TABLE[baseSymbol];
      if (payouts) {
        wins.push(payouts[matchCount - 3]);
      }
    }
  }
  return wins;
}

function countScatters(grid) {
  let count = 0;
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'lightning') count++;
    }
  }
  return count;
}

// Simulation config
const SIM_SPINS = 100000;
const linesPlayed = 25;

let jackpotHits = 0;
let voucherHits = 0;
let creditHits = 0;
let holdSpinHits = 0;
let lineWinHits = 0; // near-miss with tokens won
let totalWinSpins = 0;
let totalTokensBet = SIM_SPINS * linesPlayed;
let totalTokensReturned = 0;

for (let i = 0; i < SIM_SPINS; i++) {
  // 0.8% chance to force Hold & Spin (approx 1 in 125 spins)
  const forceHoldSpin = Math.random() < 0.008;
  const grid = forceHoldSpin ? generateForceScatterGrid() : generateGrid();
  const scatters = countScatters(grid);
  
  if (scatters >= 6) {
    holdSpinHits++;
    totalWinSpins++;
    // Hold & Spin average token award is around 15 tokens per line bet
    totalTokensReturned += 15 * linesPlayed; 
    continue;
  }
  
  const wins = evaluatePaylines(grid, linesPlayed);
  const totalMultiplier = wins.reduce((sum, m) => sum + m, 0);
  
  if (totalMultiplier >= 80) {
    jackpotHits++;
    totalWinSpins++;
  } else if (totalMultiplier >= 30) {
    voucherHits++;
    totalWinSpins++;
  } else if (totalMultiplier >= 10) {
    creditHits++;
    totalWinSpins++;
  } else if (totalMultiplier > 0) {
    lineWinHits++;
    totalWinSpins++;
  }
  
  const tokensWon = Math.floor(totalMultiplier * linesPlayed);
  totalTokensReturned += tokensWon;
}


console.log("=== SLOT MACHINE ODSS SIMULATION ===");
console.log(`Total Spins Simulated: ${SIM_SPINS}`);
console.log(`Lines Played: ${linesPlayed}`);
console.log(`Total Tokens Bet: ${totalTokensBet}`);
console.log(`Total Tokens Returned: ${totalTokensReturned}`);
console.log(`Token Return to Player (RTP): ${(totalTokensReturned / totalTokensBet * 100).toFixed(2)}%`);
console.log(`Overall Hit Frequency: ${(totalWinSpins / SIM_SPINS * 100).toFixed(2)}%`);
console.log("\n--- HIT RATES & PROBABILITIES ---");
console.log(`Jackpot (Mult >= 80): ${jackpotHits} hits | Prob: ${(jackpotHits/SIM_SPINS * 100).toFixed(4)}% | 1 in ${jackpotHits ? Math.round(SIM_SPINS/jackpotHits) : 'N/A'}`);
console.log(`$500 Voucher (Mult 30-79): ${voucherHits} hits | Prob: ${(voucherHits/SIM_SPINS * 100).toFixed(4)}% | 1 in ${voucherHits ? Math.round(SIM_SPINS/voucherHits) : 'N/A'}`);
console.log(`$100 Credit (Mult 10-29): ${creditHits} hits | Prob: ${(creditHits/SIM_SPINS * 100).toFixed(4)}% | 1 in ${creditHits ? Math.round(SIM_SPINS/creditHits) : 'N/A'}`);
console.log(`Hold & Spin (Scatters >= 6): ${holdSpinHits} hits | Prob: ${(holdSpinHits/SIM_SPINS * 100).toFixed(4)}% | 1 in ${holdSpinHits ? Math.round(SIM_SPINS/holdSpinHits) : 'N/A'}`);
console.log(`Standard Line Win (Mult < 10): ${lineWinHits} hits | Prob: ${(lineWinHits/SIM_SPINS * 100).toFixed(4)}% | 1 in ${lineWinHits ? Math.round(SIM_SPINS/lineWinHits) : 'N/A'}`);
