// ==========================================================================
// 📦 3×3 重ねられるボードゲーム 共通型定義
// ==========================================================================

export type Player = 'blue' | 'yellow';

// 各マスはプレイヤーの文字列が入る配列（最大3枚まで重ねられるスタック）
export type Cell = Player[];

// 盤面は Cell（配列）が 3×3 で並んだ2次元配列
export type Board = Cell[][];

// プレイヤーごとの手持ちの駒数
export type Hands = {
  blue: number;
  yellow: number;
};

// プレイヤーが選択できる手（配置、または移動）
export type Move = 
  | { type: 'place'; row: number; col: number }
  | { type: 'move'; fromRow: number; fromCol: number; count: number; toRow: number; toCol: number; player?: Player };

// Web Worker（AI）に送信するメッセージの構造
export type WorkerInputMessage = {
  board: Board;
  hands: Hands;
  aiColor: Player;
  difficulty: 'easy' | 'medium' | 'hard';
  lastMove: Move | null;
};

// 勝利判定の戻り値の構造
export type WinnerResult = {
  winner: Player;
  line: number[][];
} | null;
