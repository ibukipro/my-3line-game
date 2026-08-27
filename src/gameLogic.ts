import type { Player, Board, Hands, Move, WinnerResult } from './types';

// メモリ量産を防ぐための勝利ライン定義（変数生成コスト完全ゼロ）
export const LINES = [
  [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]], // 横
  [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]], // 縦
  [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]                      // 斜め
];

// ==========================================================================
// 🏆 ③ 勝利判定関数
// ==========================================================================
export function checkWinner(board: Board): WinnerResult {
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
// 💡 ① 着手、反映（安全な非破壊・パフォーマンス最適化版）
// ==========================================================================
export function applyMove(board: Board, hands: Hands, player: Player, move: Move): { board: Board; hands: Hands } {
  // 3本の行配列を新しく生成
  const b: Board = [board[0].slice(), board[1].slice(), board[2].slice()] as Board;
  const h: Hands = { blue: hands.blue, yellow: hands.yellow };
  
  if (move.type === 'place') {
    const r = move.row;
    const c = move.col;
    // concatで新しい配列を生成するため、元の盤面の参照を汚さない
    b[r][c] = b[r][c].concat([player]);
    h[player]--;
  } else {
    const fr = move.fromRow;
    const fc = move.fromCol;
    const tr = move.toRow;
    const tc = move.toCol;
    const mc = move.count;
    
    // 移動元のマスを新しくコピーして、上の駒を削る
    const fromCell = b[fr][fc].slice();
    const pieces = fromCell.splice(fromCell.length - mc, mc);
    b[fr][fc] = fromCell;
    
    // 移動先のマスも、元の盤面を破壊しないよう concat で新しい配列として結合する
    b[tr][tc] = b[tr][tc].concat(pieces);
  }
  return { board: b, hands: h };
}

// ==========================================================================
// 🚀 ⑥ すべての打てる手を列挙する関数（元のルールを完全維持＋バグ修復）
// ==========================================================================
export function getAllMoves(board: Board, hands: Hands, player: Player, lastMove: Move | null): Move[] {
  const moves: Move[] = [];
  
  // 1. 配置手（place）の列挙
  if (hands[player] > 0) {
    for (let r = 0; r < 3; r++) {
      const row = board[r];
      if (row[0].length < 3) moves.push({ type: 'place', row: r, col: 0 });
      if (row[1].length < 3) moves.push({ type: 'place', row: r, col: 1 });
      if (row[2].length < 3) moves.push({ type: 'place', row: r, col: 2 });
    }
  }
  
  // 2. 移動手（move）の列挙（直前の相手の移動を安全にチェック）
  const isOpponentMove = lastMove && lastMove.type === 'move';
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

      // 一番上の駒が自分の持ち駒である場合のみ、そのタワーから移動可能
      const topPiece = row[c][stackLen - 1];
      if (topPiece !== player) continue;

      // 1枚でも2枚でも3枚でも（タワーにある枚数分だけ）まとめて動かせる仕様を完全維持
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
