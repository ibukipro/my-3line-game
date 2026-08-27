// DedicatedWorkerGlobalScope として正しくキャスト
const workerSelf: DedicatedWorkerGlobalScope = self as any;

// ==========================================================================
// 📦 型定義（外部ファイルに依存せず、この中で完結させます）
// ==========================================================================
type Player = 'blue' | 'yellow';
type Cell = Player[];
type Board = Cell[][];

type Hands = {
  blue: number;
  yellow: number;
};

type Move = 
  | { type: 'place'; row: number; col: number }
  | { type: 'move'; fromRow: number; fromCol: number; count: number; toRow: number; toCol: number; player?: Player };

type WorkerInputMessage = {
  board: Board;
  hands: Hands;
  aiColor: Player;
  difficulty: 'easy' | 'medium' | 'hard';
  lastMove: Move | null;
};

type WinnerResult = {
  winner: Player;
  line: number[][];
} | null;

// 勝利ライン定義
const LINES = [
  [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
  [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
  [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
];

// ==========================================================================
// 🏆 ③ 勝利判定関数
// ==========================================================================
function checkWinner(board: Board): WinnerResult {
  for (let i = 0; i < 8; i++) {
    const line = LINES[i];
    const s0 = board[line[0][0]][line[0][1]];
    if (s0.length === 0) continue;
    const color0 = s0[s0.length - 1];

    const s1 = board[line[1][0]][line[1][1]];
    if (s1.length === 0 || s1[s1.length - 1] !== color0) continue;

    const s2 = board[line[2][0]][line[2][1]];
    if (s2.length === 0 || s2[s2.length - 1] !== color0) continue;

    return { winner: color0, line: line };
  }
  return null;
}

// ==========================================================================
// 🚀 ⑥ すべての打てる手を列挙する関数（元の完璧な列判定を修復）
// ==========================================================================
function getAllMoves(board: Board, hands: Hands, player: Player, lastMove: Move | null): Move[] {
  const moves: Move[] = [];
  
  if (hands[player] > 0) {
    for (let r = 0; r < 3; r++) {
      const row = board[r];
      if (row[0].length < 3) moves.push({ type: 'place', row: r, col: 0 });
      if (row[1].length < 3) moves.push({ type: 'place', row: r, col: 1 });
      if (row[2].length < 3) moves.push({ type: 'place', row: r, col: 2 });
    }
  }
  
  const isOpponentMove = lastMove && lastMove.type === 'move' && lastMove.player !== player;
  const lmToRow = isOpponentMove ? (lastMove as any).toRow : -1;
  const lmToCol = isOpponentMove ? (lastMove as any).toCol : -1;
  const lmFromRow = isOpponentMove ? (lastMove as any).fromRow : -1;
  const lmFromCol = isOpponentMove ? (lastMove as any).fromCol : -1;
  const lmCount = isOpponentMove ? (lastMove as any).count : -1;

  for (let r = 0; r < 3; r++) {
    const row = board[r];
    for (let c = 0; c < 3; c++) {
      const stackLen = row[c].length;
      if (stackLen === 0) continue;

      const topPiece = row[c][stackLen - 1];
      if (topPiece !== player) continue;

      for (let n = 1; n <= stackLen; n++) {
        for (let tr = 0; tr < 3; tr++) {
          const targetRow = board[tr];
          
          // tc = 0 の判定
          if (!(tr === r && 0 === c) && (targetRow[0].length + n <= 3)) {
            if (!(isOpponentMove && r === lmToRow && c === lmToCol && tr === lmFromRow && 0 === lmFromCol && n === lmCount)) {
              moves.push({ type: 'move', fromRow: r, fromCol: c, count: n, toRow: tr, toCol: 0, player });
            }
          }
          // tc = 1 の判定
          if (!(tr === r && 1 === c) && (targetRow[1].length + n <= 3)) {
            if (!(isOpponentMove && r === lmToRow && c === lmToCol && tr === lmFromRow && 1 === lmFromCol && n === lmCount)) {
              moves.push({ type: 'move', fromRow: r, fromCol: c, count: n, toRow: tr, toCol: 1, player });
            }
          }
          // tc = 2 の判定
          if (!(tr === r && 2 === c) && (targetRow[2].length + n <= 3)) {
            if (!(isOpponentMove && r === lmToRow && c === lmToCol && tr === lmFromRow && 2 === lmFromCol && n === lmCount)) {
              moves.push({ type: 'move', fromRow: r, fromCol: c, count: n, toRow: tr, toCol: 2, player });
            }
          }
        }
      }
    }
  }
  return moves;
}
// ==========================================================================
// 💡 ① 着手・手戻し（配列の新規生成をゼロにし、GC負荷を全廃するプロ仕様）
// ==========================================================================

// 盤面を直接書き換える（破壊的だが超高速）
function applyMoveInPlace(board: Board, hands: Hands, player: Player, move: Move): void {
  if (move.type === 'place') {
    board[move.row][move.col].push(player);
    hands[player]--;
  } else {
    const fromCell = board[move.fromRow][move.fromCol];
    // 上から count 枚を切り取る
    const pieces = fromCell.splice(fromCell.length - move.count, move.count);
    // 移動先へ追加
    board[move.toRow][move.toCol].push(...pieces);
  }
}

// 打った手を元に戻す（Undo）関数
function undoMoveInPlace(board: Board, hands: Hands, player: Player, move: Move): void {
  if (move.type === 'place') {
    board[move.row][move.col].pop();
    hands[player]++;
  } else {
    const toCell = board[move.toRow][move.toCol];
    // 移動させた枚数分を元のタワーのトップから回収
    const pieces = toCell.splice(toCell.length - move.count, move.count);
    // 元のマスに戻す
    board[move.fromRow][move.fromCol].push(...pieces);
  }
}

// ==========================================================================
// 🏆 ② 静的局面評価関数（下層の支配度も加味）
// ==========================================================================
function evaluate(board: Board, aiColor: Player): number {
  const opColor: Player = aiColor === 'yellow' ? 'blue' : 'yellow';
  let score = 0;

  // 1. ライン評価（一番上の駒を最重視）
  for (let i = 0; i < 8; i++) {
    const line = LINES[i];
    let aiCount = 0;
    let opCount = 0;

    for (let j = 0; j < 3; j++) {
      const cell = board[line[j][0]][line[j][1]];
      if (cell.length > 0) {
        const topColor = cell[cell.length - 1];
        if (topColor === aiColor) aiCount++;
        else if (topColor === opColor) opCount++;
      }
    }

    if (aiCount === 3) return 10000;  // AIの勝利
    if (opCount === 3) return -10000; // 相手の勝利
    
    if (opCount === 0) {
      if (aiCount === 2) score += 30;
      else if (aiCount === 1) score += 3;
    }
    if (aiCount === 0) {
      if (opCount === 2) score -= 25;
      else if (opCount === 1) score -= 2;
    }
  }

  // 2. 中央マスの支配（一番上の駒）
  const centerStack = board[1][1];
  if (centerStack.length > 0) {
    const centerColor = centerStack[centerStack.length - 1];
    if (centerColor === aiColor) score += 8;
    else if (centerColor === opColor) score -= 8;
  }

  // 3. 【追加】盤面全体の「総駒数（下層に隠れたアドバンテージ）」の微小評価
  // これにより、AIが「手持ちをただ消費するだけでなく、盤面全体の支配数を増やす」動きになります
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = board[r][c];
      for (let k = 0; k < cell.length; k++) {
        // 下層の駒も、1枚あたり0.5点（または1点）として薄く評価
        if (cell[k] === aiColor) score += 0.5;
        else score -= 0.5;
      }
    }
  }

  return score;
}


// ==========================================================================
// 🚀 ③ ミニマックス（ Alpha-Beta 枝刈り・破壊的更新/Undo最適化版 ）
// ==========================================================================
function minimax(
  board: Board, 
  hands: Hands, 
  player: Player, 
  depth: number, 
  alpha: number, 
  beta: number, 
  aiColor: Player, 
  maximizing: boolean, 
  lastMove: Move | null
): number {
  const winInfo = checkWinner(board);
  if (winInfo) {
    // 勝利は depth が大きい（＝手数が短い）ほど価値を高く
    // 敗北は depth が小さい（＝粘った）ほどマイナスをマイルドに
    return winInfo.winner === aiColor ? (10000 + depth) : (-10000 - depth);
  }
  if (depth === 0) return evaluate(board, aiColor);

  const moves = getAllMoves(board, hands, player, lastMove);
  const movesLen = moves.length;
  if (movesLen === 0) return evaluate(board, aiColor);

  const nextPlayer: Player = player === 'blue' ? 'yellow' : 'blue';

  if (maximizing) {
    let best = -Infinity;
    for (let i = 0; i < movesLen; i++) {
      const move = moves[i];
      // 1. 盤面を進める（破壊的）
      applyMoveInPlace(board, hands, player, move);
      
      const val = minimax(board, hands, nextPlayer, depth - 1, alpha, beta, aiColor, false, move);
      
      // 2. 盤面を必ず元に戻す（Undo）
      undoMoveInPlace(board, hands, player, move);

      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break; // 枝刈り
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < movesLen; i++) {
      const move = moves[i];
      // 1. 盤面を進める（破壊的）
      applyMoveInPlace(board, hands, player, move);
      
      const val = minimax(board, hands, nextPlayer, depth - 1, alpha, beta, aiColor, true, move);
      
      // 2. 盤面を必ず元に戻す（Undo）
      undoMoveInPlace(board, hands, player, move);

      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break; // 枝刈り
    }
    return best;
  }
}

// ==========================================================================
// 🎯 4. AIの思考メインロジック（最適化版）
// ==========================================================================
function getAIMove(
  board: Board, 
  hands: Hands, 
  aiColor: Player, 
  difficulty: 'easy' | 'medium' | 'hard', 
  lastMove: Move | null
): Move | null {
  const moves = getAllMoves(board, hands, aiColor, lastMove);
  const movesLen = moves.length;
  if (movesLen === 0) return null;

  const depthMap = { easy: 1, medium: 2, hard: 4 };
  const randomRates = { easy: 0.60, medium: 0.40, hard: 0.00 };

  const currentRandom = Math.random() < (randomRates[difficulty] ?? 0.00);
  const depth = depthMap[difficulty] ?? 2;

  // 1. 自分が1手で勝てる手（1手詰み）があれば、最優先でそれを選択
  for (let i = 0; i < movesLen; i++) {
    const move = moves[i];
    applyMoveInPlace(board, hands, aiColor, move);
    const winInfo = checkWinner(board);
    undoMoveInPlace(board, hands, aiColor, move); // 必ず戻す
    
    if (winInfo && winInfo.winner === aiColor) {
      return move; 
    }
  }

  // 2. イージー・ミディアムでのランダム着手（接待・ミス表現）
  if (currentRandom) {
    return moves[Math.floor(Math.random() * movesLen)];
  }

  // 3. Minimax（Alpha-Beta）法による最善手の探索
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];
  const nextPlayer: Player = aiColor === 'blue' ? 'yellow' : 'blue';

  for (let i = 0; i < movesLen; i++) {
    const move = moves[i];
    
    // 盤面を進める
    applyMoveInPlace(board, hands, aiColor, move);
    
    // 探索実行
    const score = minimax(board, hands, nextPlayer, depth - 1, -Infinity, Infinity, aiColor, false, move);
    
    // 盤面を戻す
    undoMoveInPlace(board, hands, aiColor, move);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  // 同点の手がある場合はランダムに選んで人間味を出す
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ==========================================================================
// 📩 Workerメッセージ受信＆応答処理
// ==========================================================================
workerSelf.onmessage = (e: MessageEvent<WorkerInputMessage>) => {
  // メインスレッドから渡されたオブジェクトをそのまま使用（内部で破壊・復元するため安全）
  const { board, hands, aiColor, difficulty, lastMove } = e.data;
  const bestMove = getAIMove(board, hands, aiColor, difficulty, lastMove);
  workerSelf.postMessage(bestMove);
};

