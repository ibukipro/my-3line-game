import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AchievementCollection, { checkAndShowReward } from './Achievement';

// gameLogic.ts から基本関数をインポート
import { 
  checkWinner, 
  getAllMoves,
  applyMove 
} from './gameLogic';

// 初期のゲームデータ定義
const INITIAL_HANDS = { blue: 5, yellow: 5 };
const EMPTY_BOARD = () => [[[], [], []], [[], [], []], [[], [], []]];
const createEmptyBoard = () => [[[], [], []], [[], [], []], [[], [], []]];

// 🚨 App内部用の配置・移動可能マス計算関数（既存のロジックを完全維持）
function getPlaceTargets(board: any) {
  const t: number[][] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c].length < 3) t.push([r, c]);
    }
  }
  return t;
}

function getValidTargets(board: any, fromRow: number, fromCol: number, count: number, lastMove: any, currentPlayer: string) {
  const t: number[][] = [];
  const isOpponentMove = lastMove && lastMove.type === 'move' && lastMove.player !== currentPlayer;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === fromRow && c === fromCol) continue;
      if (board[r][c].length + count > 3) continue;

      if (isOpponentMove && fromRow === lastMove.toRow && fromCol === lastMove.toCol && r === lastMove.fromRow && c === lastMove.fromCol) {
        if (count > 0 && count === lastMove.count) continue;
        if (count === 0 && board[fromRow][fromCol].length === lastMove.count) continue;
      }
      t.push([r, c]);
    }
  }
  return t;
}

// 📦 共通型定義
type Player = 'blue' | 'yellow';
type Cell = Player[];
type Board = Cell[][];
type Move = 
  | { type: 'place'; row: number; col: number }
  | { type: 'move'; fromRow: number; fromCol: number; count: number; toRow: number; toCol: number; player?: Player };

type WorkerInputMessage = {
  board: Board;
  hands: { blue: number; yellow: number };
  aiColor: Player;
  difficulty: 'easy' | 'medium' | 'hard';
  lastMove: Move | null;
};

// ==========================================================================
// 🚀 Vite専用 Web Worker バックグラウンド通信用（白飛び・多重起動完全防止版）
// ==========================================================================
function useAIWorker(onAIMoveReceived: (move: Move | null) => void) {
  const workerRef = useRef<Worker | null>(null);
  const onMoveRef = useRef(onAIMoveReceived);

  // コールバック関数を常に最新のRefに保存することで、依存配列による再生成を防ぐ
  useEffect(() => {
    onMoveRef.current = onAIMoveReceived;
  }, [onAIMoveReceived]);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('./aiWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current.onmessage = (e: MessageEvent<Move | null>) => {
        onMoveRef.current(e.data); // Ref経由で呼び出すため絶対にズレない
      };
    } catch (err) {
      console.error("AIWorkerの起動に失敗しました:", err);
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []); // 💡 依存配列を完全に空に！これでアプリ起動時の1回しかWorkerを作らず超軽量。

  const requestAIMove = useCallback((board: Board, hands: { blue: number; yellow: number }, aiColor: Player, difficulty: 'easy' | 'medium' | 'hard', lastMove: Move | null) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ board, hands, aiColor, difficulty, lastMove });
    } else {
      onMoveRef.current(null);
    }
  }, []);

  return { requestAIMove };
}

// ==========================================================================
// 🌟 盤面のコマ (Puck)
// ==========================================================================
const Puck = React.memo(function Puck({ color, index, isGlowing = false }: any) {
  const liftY = index * -14; 
  const microZ = 4 + (index * 0.2);
  const isBlue = color === 'blue';
  const topGradId = 'puckTopGrad-' + color;
  const sideGradId = 'puckSideGrad-' + color;
  const defaultStroke = isBlue ? '#93c5fd' : '#fef08a';
  const transformStyle = 'translateX(-10%) rotateZ(6deg) rotateX(-34deg) translateZ(' + microZ + 'px) translateY(' + liftY + 'px)';
  const glowClass = isGlowing ? 'is-glowing' : '';

  return (
    <div className={'puck-svg-container ' + glowClass} style={{ transform: transformStyle, zIndex: 10 + index }}>
      <svg viewBox="0 0 64 80" xmlns="http://w3.org">
        <path className="puck-side" d="M 7,34 A 25,15 0 0,0 57,34 L 57,50 A 25,15 0 0,1 7,50 Z" fill={'url(#' + sideGradId + ')'} />
        <ellipse cx="32" cy="34" rx="25" ry="15" fill={'url(#' + topGradId + ')'} />
        <ellipse className="puck-stroke" cx="32" cy="34" rx="23" ry="13" fill="none" stroke={defaultStroke} strokeWidth={1.8} strokeOpacity={0.9} />
      </svg>
    </div>
  );
});


// ==========================================================================
// 🌟 手札のコイン (HandPuck)
// ==========================================================================
const HandPuck = React.memo(function HandPuck({ color }: any) {
  const hTopGradId = 'hTopGrad-' + color;
  const hSideGradId = 'hSideGrad-' + color;
  return (
    <div className="w-full h-full">
      <svg width="100%" height="100%" viewBox="0 0 60 76" xmlns="http://w3.org">
        <path d="M 5,30 A 25,15 0 0,0 55,30 L 55,48 A 25,15 0 0,1 5,48 Z" fill={'url(#' + hSideGradId + ')'} />
        <ellipse cx="30" cy="30" rx="25" ry="15" fill={'url(#' + hTopGradId + ')'} stroke="#ffffff" strokeWidth="2.5" />
        <ellipse cx="30" cy="30" rx="19" ry="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeDasharray="4,2" />
      </svg>
    </div>
  );
});

// ==========================================================================
// 🌟 コインのグラデーション中央基地 (GameSvgDefs)
// ==========================================================================
const GameSvgDefs = React.memo(function GameSvgDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} xmlns="http://w3.org">
      <defs>
        <radialGradient id="hTopGrad-blue" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60a5fa" /><stop offset="40%" stopColor="#2563eb" /><stop offset="85%" stopColor="#1e3a8a" /><stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <linearGradient id="hSideGrad-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id="hTopGrad-yellow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="40%" stopColor="#d97706" /><stop offset="85%" stopColor="#78350f" /><stop offset="100%" stopColor="#451a03" />
        </radialGradient>
        <linearGradient id="hSideGrad-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id="puckTopGrad-blue" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#93c5fd" /><stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
        <linearGradient id="puckSideGrad-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id="puckTopGrad-yellow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <linearGradient id="puckSideGrad-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="40%" stopColor="#b45309" /><stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
    </svg>
  );
});

// ==========================================================================
// 🌟 ファンセルストック (CellStack)
// ==========================================================================
const CellStack = React.memo(function CellStack({ 
  stack, isSelected, isValidTarget, onClick, winHighlight, disabled,
  rowIdx, colIdx, lastMove, winResult, phase
}: any) {
  let winClass = '';
  if (winHighlight && winResult) {
    winClass = winResult.winner === 'blue' ? 'cell-win-blue ' : 'cell-win-amber ';
  }
  const isGameOverClass = phase === 'gameOver' ? 'is-game-over ' : '';
  const selectedClass = isSelected ? 'cell-selected ' : '';
  const validClass = isValidTarget ? 'cell-valid ' : '';
  const disabledClass = disabled ? 'cell-disabled' : 'cell-interactive';
  const cls = 'cell-3d ' + selectedClass + validClass + winClass + isGameOverClass + disabledClass;
  
  const handleItemClick = function() {
    if (!disabled && onClick) { onClick(rowIdx, colIdx); }
  };

  return (
    <div className={cls} onClick={handleItemClick}>
      <div className="cell-top" />
      <div className="cell-top" />
      {stack.map((color: any, i: number) => {
        let isGlowing = false;
        if (lastMove) {
          if (lastMove.type === 'place' && lastMove.row === rowIdx && lastMove.col === colIdx) {
            isGlowing = (i === stack.length - 1);
          } else if (lastMove.type === 'move' && lastMove.toRow === rowIdx && lastMove.toCol === colIdx) {
            const moveCount = lastMove.count || 1;
            isGlowing = (i >= stack.length - moveCount);
          }
        }
        return <Puck key={rowIdx + '-' + colIdx + '-' + i} color={color} index={i} rowIdx={rowIdx} colIdx={colIdx} isGlowing={isGlowing} />;
      })}
      {stack.length > 0 && <div className="stack-count-badge">{stack.length}</div>}
    </div>
  );
}, function areEqual(prevProps: any, nextProps: any) {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isValidTarget === nextProps.isValidTarget &&
    prevProps.winHighlight === nextProps.winHighlight &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.phase === nextProps.phase &&
    prevProps.lastMove === nextProps.lastMove &&
    prevProps.winResult === nextProps.winResult &&
    prevProps.stack.length === nextProps.stack.length &&
    prevProps.stack.every((color: any, idx: number) => color === nextProps.stack[idx])
  );
});

// ==========================================================================
// 🌟 ムーブカウントセレクター
// ==========================================================================
const MoveCountSelector = React.memo(function MoveCountSelector({ maxCount, onSelect, onCancel }: any) {
  const handleButtonClick = function(e: any) {
    const num = Number(e.currentTarget.dataset.num);
    if (onSelect) onSelect(num);
  };
  return (
    <div className="move-count-selector">
      <span className="move-count-label">取る数:</span>
      {maxCount >= 1 && <button key="move-btn-1" data-num="1" onClick={handleButtonClick} className="selector-btn btn-primary">1</button>}
      {maxCount >= 2 && <button key="move-btn-2" data-num="2" onClick={handleButtonClick} className="selector-btn btn-primary">2</button>}
      {maxCount >= 3 && <button key="move-btn-3" data-num="3" onClick={handleButtonClick} className="selector-btn btn-primary">3</button>}
      <button onClick={onCancel} className="selector-btn btn-secondary">戻る</button>
    </div>
  );
});
// ==========================================================================
// 🌟 決着時演出オーバーレイ (WinOverlay)
// ==========================================================================
const DIFFICULTY_LABELS: any = { easy: 'よわい', medium: 'ふつう', hard: 'つよい' };
const STAR_COLORS: any = { easy: 'bronze', medium: 'silver', hard: 'gold' };

const WinOverlay = React.memo(function WinOverlay({ winner, onReset, gameMode, backToMenu, difficulty, winStreak }: any) {
  const isBlue = winner === 'blue';
  const hasTriggeredReward = useRef(false);

  React.useEffect(() => {
    if (isBlue && gameMode === 'ai' && !hasTriggeredReward.current) {
      if (typeof (window as any).checkAndShowReward === 'function') {
        hasTriggeredReward.current = true; // 2重発火を即ロック
        (window as any).checkAndShowReward(winStreak, difficulty);
      }
    }
  }, [isBlue, gameMode, winStreak, difficulty]);

  const name = isBlue ? 'プレイヤー1(青)' : (gameMode === '2p' ? 'プレイヤー2(黄)' : 'CPU(黄)');
  const colorClass = isBlue ? 'text-blue-400' : 'text-amber-400';
  const isCpuWin = gameMode !== '2p' && !isBlue;
  const starColor = (gameMode === 'ai' && STAR_COLORS[difficulty]) || 'gold';

  return (
    <div className="overlay-backdrop">
      <div className="overlay-card overlay-enter flex flex-col items-center">
        <div className="victory-icon-container">
          {isCpuWin ? <span className="icon-robot">🤖</span> : <div className={'star-medal ' + starColor}></div>}
        </div>
        <p className={'text-[18px] font-black mb-2 whitespace-nowrap text-center ' + colorClass}>
          {name + ' の勝利！'}
        </p>
        {gameMode !== '2p' && difficulty && (
          <p className="text-sm font-bold text-gray-300 mb-3">
            {'【難易度： ' + (DIFFICULTY_LABELS[difficulty] || difficulty) + ' 】'}
          </p>
        )}
        {winStreak > 0 && !isCpuWin && <p className="streak-count-text">{'TOTAL: ' + winStreak + '勝達成！'}</p>}
        <h2 className="text-base font-bold text-gray-400 mt-2 mb-8 tracking-widest">— ゲーム終了 —</h2>
        <div className="flex flex-col gap-3 w-full items-center">
          <button onClick={onReset} className="overlay-btn w-full">もう一度遊ぶ</button>
          <button onClick={backToMenu} className="overlay-btn w-full secondary">メニューに戻る</button>
        </div>
      </div>
    </div>
  );
});
// ==========================================================================
// 📜 公式ゲーム説明書 (InstructionScreen)
// ==========================================================================
const RuleImg = ({ src, alt }: any) => (
  <div className="w-full text-center my-0">
    <img
      src={src}
      alt={alt}
      className="w-full max-w-[250px] mx-auto rounded-xl border border-gray-600 shadow-md block"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
        console.warn(`${src} が見つかりません。`);
      }}
    />
  </div>
);

function InstructionScreen({ onBack, hasActiveGame, onResumeGame }: any) {
  const handleResetStreak = () => {
    if (window.confirm('これまでの通算勝利記録をすべてリセットしますか？\n（この操作は取り消せません）')) {
      localStorage.removeItem('game_streaks');
      alert('通算勝利記録をリセットしました。');
      window.location.reload();
    }
  };

  return (
    <div className="instruction-container">
      <h2 className="text-xl font-black text-white mb-5 text-center border-b-2 border-gray-700 pb-3">📜 公式ゲーム説明書</h2>
      <div className="space-y-6 text-[14px] leading-relaxed">
        <div className="instruction-section">
          <h3 className="instruction-title">🏆 基本ルール（勝利条件）</h3>
          <p className="mb-2">上から見て、自分の持ち駒を縦、横、斜めのいずれかに、<strong>先に3つ並べた方が勝ち</strong>となります。</p>
          <div className="text-[12px] text-amber-400/90 font-bold p-3 mt-2 space-y-1">
            <p className="flex items-center gap-1 text-[13px] text-amber-300 mb-1">⏱️ 思考時間（時間を過ぎると負け）</p>
            <p className="pl-1">🟢 難易度：よわい ── <strong className="text-white">1分（ 60秒 ）</strong></p>
            <p className="pl-1">🟠 難易度：ふつう ── <strong className="text-white">3分（ 180秒 ）</strong></p>
            <p className="pl-1">🔴 難易度：つよい ── <strong className="text-white">5分（ 300秒 ）</strong></p>
          </div>
        </div>
        <div className="instruction-section">
          <h3 className="instruction-title">🛠 3つのルールポイント</h3>
          <p className="mb-3">プレイヤーは順番ごとに<strong>【1回1動作】</strong>を行うことができます。</p>
          <div className="instruction-list">
            <p className="text-[20px] font-black text-amber-500 mt-2 mb-0 tracking-wide">① 相手の駒も動かせます！</p>
            <RuleImg src="./d1.jpg" alt="相手の駒も動かせます！" />
            <p>「持ち駒を置く」か、「自分の駒を移動させる」か、あるいはマス上にある<strong>「相手の駒を移動させる」</strong>ことができます。</p>
            <p className="text-xs text-gray-400">※ マス上に置いた駒を自分の手元に引き取る事は出来ません。また、相手の手元にある持ち駒を動かせるのは相手のみです。</p>
            <p className="text-[20px] font-black text-amber-500 mt-2 mb-0 tracking-wide">② 3個まで上に重ねられます！</p>
            <RuleImg src="./d2.jpg" alt="3個まで上に重ねられます！" />
            <p>すでに駒があるマスにも重ねられます。ただし、1マスに重ねられるのは<strong>最大3個まで</strong>です。</p>
            <p className="text-[20px] font-black text-amber-500 mt-2 mb-0 tracking-wide">③ まとめて持って移動できます！</p>
            <RuleImg src="./d3.jpg" alt="まとめて持って移動できます！" />
            <p><strong>「1個〜3個重なったまま」</strong>一塊として移動させることができます。</p>
          </div>
        </div>
        <div className="instruction-section">
          <h3 className="text-amber-500 font-black mb-1.5 text-[16px]">🚫 禁止事項・ルール</h3>
          <div className="space-y-2.5">
            <p><strong>・同手戻しの禁止:</strong><br />相手が移動させた駒をそのまま逆に戻す行為は禁止です。</p>
            <p><strong>・下からの並び出しに注意:</strong><br />駒を移動させて退かした際に、<strong>下にあった相手の駒が3つ並んでしまう</strong>と、動かした側の負けとなります。</p>
            <p><strong>・ドロー（引き分け）判定:</strong><br />お互いに同じ手の繰り返しでループ状態になった時は、別の手で進むかリセットボタンでやり直してください。</p>
          </div>
        </div>
        <div className="instruction-section mt-6 border-t border-gray-800 pt-5">
          <h3 className="text-indigo-400 font-black mb-2 text-[16px]">🧠 こんな「脳力」が身に付きます</h3>
          <p className="text-[11px] text-gray-400 mb-4 font-bold">※「脳力」とは、様々に考える力という意味の造語です。</p>
          <div className="space-y-5 text-sm text-gray-300 leading-relaxed font-bold">
            <p>これからの現代人に必要な考える力を、大人から子供まで楽しめるゲームにしました。</p>
            <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-900/60 text-xs">
              <span className="text-indigo-300 font-black text-sm">👨‍⚕️ 考案者プロフィール</span>
              <p className="mt-1 text-gray-300">
                健康療法の専門家<strong>＜息吹友也・東洋医学名誉博士＞</strong>が考案。誰もが面白く、簡単に脳力を鍛えられるゲームです。
                <span className="text-amber-400 font-bold ml-1">＜特許出願中＞</span>
              </p>
            </div>
            <div className="space-y-5 pt-2">
              <div className="flex items-start gap-2.5">
                <span className="text-indigo-400 mt-0.5 text-lg">🔹</span>
                <div className="flex-1">
                  <h4 className="text-white font-black text-base mb-1">空間認知能力の発動</h4>
                  <p className="text-gray-300 leading-relaxed font-normal">駒を立体に積む事で、立体的に物事を考える空間認知能力を発動できます。</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-indigo-400 mt-0.5 text-lg">🔹</span>
                <div className="flex-1">
                  <h4 className="text-white font-black text-base mb-1">様々な能力アップに</h4>
                  <p className="text-gray-300 leading-relaxed font-normal">空間認知能力、集中力、観察力、判断力など、総合的な洞察が身に付きます。</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-yellow-400 mt-0.5 text-lg">🏆</span>
                <div className="flex-1">
                  <h4 className="text-white font-black text-base mb-1">勝利を重ねて昇級＆マスター称号を獲得！</h4>
                  <p className="text-gray-300 leading-relaxed text-xs font-normal">
                    ＣＰＵとの対戦で勝利を重ねる毎に、昇級やマスターの称号が授与されます。詳細はゲーム内実績をご確認ください。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 mt-0.5 text-lg">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-white font-black text-base mb-1">通算記録の保存とリセット</h4>
                  <p className="text-gray-300 leading-relaxed text-sm font-normal">通算勝利記録は自動保存されます。最下部のボタンでリセット可能ですが戻せません。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="instruction-section mt-5 bg-amber-950/20 p-4 rounded-xl border border-amber-900/40">
          <h3 className="text-amber-500 font-black mb-2.5 text-[16px]">🔍 面白さのポイントは「洞察力」</h3>
          <div className="text-sm text-gray-300 leading-relaxed space-y-2 font-normal">
            <p>このゲームは、誰もが簡単に遊べるゲームでありながら、<strong>洞察力</strong>を養う事ができます。</p>
            <p className="text-gray-400">自分の駒ばかり見ていると、駒を動かした時に下にあった相手の駒が3つ並んでしまう事に気付きません。</p>
            <p className="text-rose-400 font-bold">🚨 うっかり駒を動かした時点で、即座に対戦者に勝ちをあげる（自爆負けする）ことになります！</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 mt-8">
          {hasActiveGame && <button onClick={onResumeGame} className="overlay-btn">🎮 ゲームに戻る (続きから)</button>}
          <button onClick={onBack} className="btn-menu-back active:scale-95">メインメニューに戻る</button>
          <div className="mt-6 pt-4 border-t border-gray-800 text-center">
            <button type="button" onClick={handleResetStreak} className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">通算勝利記録をリセットする</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 🌟 メニュースクリーン (MenuScreen)
// ==========================================================================
function MenuScreen({ streaks = {}, setStreaks, onStart, onOpenInstructions, hasHistory }: any) {
  const IS_DEBUG = true; 

  const [mode, setMode] = useState<string | null>(null);               
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null); 
  const [debugTapCount, setDebugTapCount] = useState(0);  
  const [showDebug, setShowDebug] = useState(false);      

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleDiffSelect = function(diff: string) {
    setSelectedDiff(diff);
    setMode('turn');
  };

    // 💡 4. タイトルタップ処理（2重State呼び出しのバグを完全修正）
  const handleTitleTap = function() {
    if (!IS_DEBUG) return;

    // カウントを1進める
    const nextCount = debugTapCount + 1;

    if (nextCount >= 5) {
      // 5回に達したらパネルをトグル（表示/非表示）して、カウントを0にリセット
      setShowDebug(!showDebug);
      setDebugTapCount(0);
    } else {
      // 5回未満ならカウントをそのまま保存
      setDebugTapCount(nextCount);
    }
  };


  const updateStreaksData = function(newStreaks: any) {
    localStorage.setItem('game_streaks', JSON.stringify(newStreaks));
    if (typeof setStreaks === 'function') { setStreaks(newStreaks); }
  };

  const toggleStreak = function(diff: string, count: number) {
    const current = streaks[diff] || 0;
    const nextCount = current === count ? 0 : count;
    const updated = Object.assign({}, streaks, { [diff]: nextCount });
    updateStreaksData(updated);

    if (nextCount > 0 && typeof (window as any).checkAndShowReward === 'function') {
      (window as any).checkAndShowReward(nextCount, diff);
    }
  };

  const resetAllStreaks = function() { updateStreaksData({ easy: 0, medium: 0, hard: 0 }); };

  const unlockAll = function() {
    updateStreaksData({ easy: 20, medium: 20, hard: 20 });
    if (typeof (window as any).checkAndShowReward === 'function') {
      (window as any).checkAndShowReward(20, 'hard');
    }
  };

  const handleMenuButtonClick = function(e: any) {
    const action = e.currentTarget.dataset.action;
    const val1 = e.currentTarget.dataset.val1;
    const val2 = e.currentTarget.dataset.val2;

    if (action === 'start') {
      onStart(val1, val2 || null);
    } else if (action === 'start-ai') {
      onStart('ai', selectedDiff, val1);
    } else if (action === 'set-mode') {
      setMode(val1 || null);
    } else if (action === 'diff-select') {
      handleDiffSelect(val1);
    } else if (action === 'open-instructions') {
      onOpenInstructions();
    }
  };

  return (
    <div className="menu-container">
      {/* ① メインメニュー */}
      {mode === null && (
        <React.Fragment>
          <div className="menu-main-content">
            <h1 onClick={handleTitleTap} className="text-[42px] font-black text-white mb-[5px] tracking-tight cursor-pointer select-none">
              3<span className="text-indigo-400">ライン</span><span className="text-amber-500">！</span> 
            </h1>
            <p className="text-gray-400 text-[15px] mb-2 tracking-widest">脳力活性ゲーム！</p>
            <p className="text-gray-200 text-[13px] mb-7 tracking-widest font-bold">洞察力が身に付く立体３目並べ</p>

            <div className="flex flex-col gap-5 w-64">
              {hasHistory && (
                <button data-action="start" data-val1="resume" onClick={handleMenuButtonClick} className="menu-btn btn-resume animate-pulse">途中から再開</button>
              )}
              <button data-action="start" data-val1="2p" onClick={handleMenuButtonClick} className="menu-btn btn-2p">2人対戦</button>
              <button data-action="set-mode" data-val1="ai" onClick={handleMenuButtonClick} className="menu-btn btn-ai">CPU対戦</button>
              <button onClick={handleMenuButtonClick} data-action="open-instructions" className="menu-btn btn-sub mt-2">📄 遊び方を見る</button>
            </div>
          </div>
  
{AchievementCollection && (
  <AchievementCollection 
    streaks={streaks} 
    setStreaks={setStreaks}
  />
)}
       </React.Fragment>
      )}

      {/* ② 難易度選択 */}
      {mode === 'ai' && (
        <div className="menu-main-content">
          <h1 className="text-[42px] font-black text-white mb-[5px] tracking-tight cursor-pointer select-none">
            3<span className="text-indigo-400">ライン</span><span className="text-amber-500">！</span> 
          </h1>
          <p className="text-gray-400 text-[15px] mb-6 tracking-widest">脳力活性ゲーム！</p>
          <div className="flex flex-col gap-4 w-64">
            <p className="text-gray-400 text-[14px] mb-1 font-bold">難易度を選択</p>
            <button data-action="diff-select" data-val1="easy" onClick={handleMenuButtonClick} className="menu-btn bg-green-600 text-white">よわい</button>
            <button id="btn-medium" data-action="diff-select" data-val1="medium" onClick={handleMenuButtonClick} className="menu-btn bg-orange-600 text-white">ふつう</button>
            <button id="btn-hard" data-action="diff-select" data-val1="hard" onClick={handleMenuButtonClick} className="menu-btn bg-red-600 text-white">つよい</button>
            <button data-action="set-mode" data-val1="" onClick={handleMenuButtonClick} className="menu-btn btn-sub mt-1">戻る</button>
          </div>
        </div>
      )}

      {/* ③ 先攻・後攻選択 */}
      {mode === 'turn' && (
        <div className="menu-main-content">
          <h1 className="text-[42px] font-black text-white mb-[5px] tracking-tight cursor-pointer select-none">
            3<span className="text-indigo-400">ライン</span><span className="text-amber-500">！</span> 
          </h1>
          <p className="text-gray-400 text-[15px] mb-6 tracking-widest">脳力活性ゲーム！</p>
          <div className="flex flex-col gap-4 w-64">
            <p className="text-gray-400 text-[14px] mb-1 font-bold">順番を選択</p>
            <button data-action="start-ai" data-val1="blue" onClick={handleMenuButtonClick} className="menu-btn bg-indigo-600 text-white">先攻</button>
            <button data-action="start-ai" data-val1="yellow" onClick={handleMenuButtonClick} className="menu-btn bg-amber-600 text-white">後攻</button>
            <button data-action="set-mode" data-val1="ai" onClick={handleMenuButtonClick} className="menu-btn btn-sub mt-1">戻る</button>
          </div>
        </div>
      )}

      {/* 🛠️ デバッグパネル */}
      {IS_DEBUG && showDebug && (
        <div className="mt-6 p-4 bg-gray-900/95 border border-amber-500/50 rounded-xl w-full max-w-sm text-center z-50 shadow-2xl">
          <p className="text-amber-400 text-xs font-bold mb-3">🛠️ 実績・ポップアップテストパネル</p>
          {(() => {
            const handleDebugClick = function(e: any) {
              const act = e.currentTarget.dataset.act;
              const diff = e.currentTarget.dataset.diff;
              // ⭕ undefined エラーを防ぐため、フォールバック値を追加
              const count = Number(e.currentTarget.dataset.count || '0');

              if (act === 'toggle') { toggleStreak(diff, count); } 
              else if (act === 'unlock') { unlockAll(); } 
              else if (act === 'reset') { resetAllStreaks(); } 
              else if (act === 'close') { setShowDebug(false); }
            };

            return (
              <React.Fragment>
                <div className="space-y-2 text-xs mb-3">
                  <div className="bg-gray-800/60 p-2 rounded-lg">
                    <p className="text-green-400 font-bold mb-1 text-left text-[11px]">🟢 よわい（Easy）</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button data-act="toggle" data-diff="easy" data-count="5" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.easy >= 5 && streaks.easy < 10 ? 'bg-amber-700 text-white ring-2 ring-amber-400' : 'bg-gray-700 text-gray-300')}>🥉 5勝</button>
                      <button data-act="toggle" data-diff="easy" data-count="10" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.easy >= 10 && streaks.easy < 20 ? 'bg-slate-400 text-gray-900 ring-2 ring-slate-200' : 'bg-gray-700 text-gray-300')}>🥈 10勝</button>
                      <button data-act="toggle" data-diff="easy" data-count="20" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.easy >= 20 ? 'bg-yellow-500 text-gray-900 ring-2 ring-yellow-200' : 'bg-gray-700 text-gray-300')}>🥇 20勝</button>
                    </div>
                  </div>
                  <div className="bg-gray-800/60 p-2 rounded-lg">
                    <p className="text-orange-400 font-bold mb-1 text-left text-[11px]">🟠 ふつう（Medium）</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button data-act="toggle" data-diff="medium" data-count="5" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.medium >= 5 && streaks.medium < 10 ? 'bg-amber-700 text-white ring-2 ring-amber-400' : 'bg-gray-700 text-gray-300')}>🥉 5勝</button>
                      <button data-act="toggle" data-diff="medium" data-count="10" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.medium >= 10 && streaks.medium < 20 ? 'bg-slate-400 text-gray-900 ring-2 ring-slate-200' : 'bg-gray-700 text-gray-300')}>🥈 10勝</button>
                      <button data-act="toggle" data-diff="medium" data-count="20" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.medium >= 20 ? 'bg-yellow-500 text-gray-900 ring-2 ring-yellow-200' : 'bg-gray-700 text-gray-300')}>🥇 20勝</button>
                    </div>
                  </div>
                  <div className="bg-gray-800/60 p-2 rounded-lg">
                    <p className="text-red-400 font-bold mb-1 text-left text-[11px]">🔴 つよい（Hard）</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button data-act="toggle" data-diff="hard" data-count="5" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.hard >= 5 && streaks.hard < 10 ? 'bg-amber-700 text-white ring-2 ring-amber-400' : 'bg-gray-700 text-gray-300')}>🥉 5勝</button>
                      <button data-act="toggle" data-diff="hard" data-count="10" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.hard >= 10 && streaks.hard < 20 ? 'bg-slate-400 text-gray-900 ring-2 ring-slate-200' : 'bg-gray-700 text-gray-300')}>🥈 10勝</button>
                      <button data-act="toggle" data-diff="hard" data-count="20" onClick={handleDebugClick} className={'p-1.5 rounded font-bold transition-all active:scale-95 ' + (streaks.hard >= 20 ? 'bg-yellow-500 text-gray-900 ring-2 ring-yellow-200' : 'bg-gray-700 text-gray-300')}>🥇 20勝</button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button data-act="unlock" onClick={handleDebugClick} className="p-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-extrabold rounded text-xs transition-transform active:scale-95">🏆 全9種を一括解禁</button>
                  <button data-act="reset" onClick={handleDebugClick} className="p-2 bg-gray-700 hover:bg-gray-600 text-red-300 font-bold rounded text-xs transition-transform active:scale-95">🔄 全リセット</button>
                </div>
                <button data-act="close" onClick={handleDebugClick} className="text-[11px] text-gray-400 underline hover:text-white">パネルをたたむ</button>
              </React.Fragment>
            );
          })()}
        </div>
      )}
    </div>
  );
}
// ==========================================================================
// 🌟 ハンドエリア (HandArea)
// ==========================================================================
const HandArea = React.memo(function HandArea({ color, count, isCurrentPlayer, isSelected, onSelect, playerLabel, disabled }: any) {
  const isBlue = color === 'blue';
  const activeStatusClass = isCurrentPlayer ? (isBlue ? 'is-blue' : 'is-amber') : 'is-inactive';
  const cardActiveBg = isCurrentPlayer ? (isBlue ? 'bg-blue-950/70 border-blue-400' : 'bg-amber-950/70 border-amber-400') : 'bg-gray-900/90 border-gray-700';

  const handleSelect = function() {
    if (!disabled && isCurrentPlayer && onSelect) { onSelect(); }
  };

  const renderHandPieces = function() {
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const isSelectedTarget = isSelected && (i === count - 1);
      const slotClass = 'hand-piece-slot ' + (isSelectedTarget ? 'is-selected' : '');
      pieces.push(
        <div key={color + '-hand-' + i} onClick={handleSelect} className={slotClass}>
          <Puck color={color} index={0} isGlowing={false} />
        </div>
      );
    }
    return pieces;
  };

  const headerPulseClass = isCurrentPlayer ? 'animate-syncPulse' : '';

  return (
    <div className={'hand-card ' + cardActiveBg + ' ' + activeStatusClass}>
      <div className={'hand-player-header ' + headerPulseClass}>
        <span className="hand-player-name">{playerLabel}</span>
        {isCurrentPlayer && <span className="hand-player-arrow">◀</span>}
      </div>
      <div className="hand-area-row">
        <div className="hand-area-inner">
          {count > 0 ? (
            <React.Fragment>
              <div className="hand-piece-list">{renderHandPieces()}</div>
              <div className="hand-count-text">{'x' + count}</div>
            </React.Fragment>
          ) : (
            <span className="hand-empty-text">なし</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ==========================================================================
// ⏱️ ゲームタイマー (GameTimer)
// ==========================================================================
const GameTimer = React.memo(function GameTimer({ screen, winResult, interactionDisabled, currentPlayer, onTimeOut, difficulty }: any) {
  const LIMIT_SECONDS: any = { easy: 60, medium: 180, hard: 300 };
  const activeLimit = LIMIT_SECONDS[difficulty] || 60;
  const [timeLeft, setTimeLeft] = useState(activeLimit);

  useEffect(() => { setTimeLeft(activeLimit); }, [currentPlayer, activeLimit]);

  const timeoutRef = useRef(onTimeOut);
  useEffect(() => { timeoutRef.current = onTimeOut; }, [onTimeOut]);

  useEffect(() => {
    if (screen !== 'game' || winResult || interactionDisabled) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (timeoutRef.current) timeoutRef.current(); 
          return activeLimit;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, winResult, interactionDisabled, activeLimit]); 

  const warningClass = timeLeft <= 10 ? 'warning' : '';
  return (
    <div className={'timer-display ' + warningClass}>
      <span className="timer-icon">⏱️</span>残り時間: {timeLeft}秒
    </div>
  );
});

// ==========================================================================
// 🖲️ 盤面描画コンポーネント (GameBoard)
// ==========================================================================
function GameBoard({ board, selectedCell, isValidTarget, lastMove, winLineSet, winResult, handleCellClick, interactionDisabled, phase }: any) {
  return (
    <div className="board-space-block">
      <div className="board-scaler">
        <div className="board-iso-grid">
          {board.map((row: any, r: number) => row.map((cell: any, c: number) => (
            <CellStack 
              key={`${r}-${c}`} 
              stack={cell} 
              isSelected={selectedCell?.row === r && selectedCell?.col === c} 
              isValidTarget={isValidTarget(r, c)} 
              rowIdx={r} 
              colIdx={c} 
              lastMove={lastMove} 
              winHighlight={winLineSet.has(`${r},${c}`)} 
              winResult={winResult} 
              phase={phase} 
              onClick={handleCellClick} 
              disabled={interactionDisabled} 
            />
          )))}
        </div>
      </div>
    </div>
  );
}
// ==========================================================================
// 🌟 App コンポーネント本体（状態管理・Ref・AI制御パーツ）
// ==========================================================================
const PHASE_MESSAGES_BASE: any = {
  placeSelect: '配置するマスを選択してください',
  moveCountSelect: '移動させる枚数を選択してください',
  moveTargetSelect: '移動先のマスを選択してください',
};

export default function App() {
  // --- 🚪 画面遷移とゲームモード ---
  const [screen, setScreen] = useState('menu');
  const [gameMode, setGameMode] = useState('2p');
  const [difficulty, setDifficulty] = useState('easy');
  const [hasActiveGame, setHasActiveGame] = useState(false);
  const [timerKey, setTimerKey] = useState(0); 
  const [firstPlayer, setFirstPlayer] = useState('blue');
  const [aiThinking, setAiThinking] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // --- 🎮 ゲームの進行状態を1つのオブジェクトに集約 ---
  const [gameState, setGameState] = useState<any>(() => ({
    board: [[[], [], []], [[], [], []], [[], [], []]], 
    hands: { blue: 5, yellow: 5 },
    currentPlayer: 'blue',
    phase: 'selectAction',
    selectedCell: null,
    moveCount: 0,
    winResult: null,
    lastMove: null,
  }));

  // --- 🏆 データの永続化 ---
  const [streaks, setStreaks] = useState<any>(() => {
    const saved = localStorage.getItem('game_streaks');
    return saved ? JSON.parse(saved) : { '2p_blue': 0, '2p_yellow': 0, easy: 0, medium: 0, hard: 0 };
  });

  const aiTimerRef = useRef<any>(null);
  const delayTimerRef = useRef<any>(null);
  const aiColor = 'yellow';
  
  const { board, hands, currentPlayer, phase, selectedCell, moveCount, winResult, lastMove } = gameState;
  const isAITurn = gameMode === 'ai' && currentPlayer === aiColor && !winResult;

  // --- 🛡️ 常に最新の状態を保持するRef ---
  const latestRef = useRef({ gameState, gameMode, difficulty, screen, aiThinking, isAITurn });
  useEffect(() => {
    latestRef.current = { gameState, gameMode, difficulty, screen, aiThinking, isAITurn };
  });

  // ==========================================================================
  // 🤖 🌟 AIの自動着手コントロール（Web Worker非同期制御・完全復元版）
  // ==========================================================================
  const onAIMoveReceived = useCallback((move: Move | null) => {
    const { gameState: currentGameState } = latestRef.current;
    setAiThinking(false);

    if (!move) {
      console.log('⚠️ AIが有効な手を見つけられませんでした');
      return;
    }

    console.log('★3: AIの手が決定しました（Workerより受信）', move);

    // 計算された手を、盤面を壊さない安全なapplyMoveで反映
    const { board: nb, hands: nh } = applyMove(currentGameState.board, currentGameState.hands, aiColor, move);
    
    // 次のターンへ進む処理（※次のパーツGで定義する doNextTurn を呼び出します）
    (window as any).doNextTurnFallback ? (window as any).doNextTurnFallback(nb, nh, move) : null;
  }, []);

  const { requestAIMove } = useAIWorker(onAIMoveReceived);

  useEffect(() => {
    if (screen !== 'game' || phase !== 'selectAction' || !isAITurn) return;

    setAiThinking(true);
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    aiTimerRef.current = setTimeout(() => {
      const { gameState: currentGameState, difficulty: currentDiff } = latestRef.current;
      if (currentGameState.phase !== 'selectAction') {
        setAiThinking(false);
        return;
      }

      console.log('★2: AIの計算をWorkerで開始します');
      requestAIMove(currentGameState.board, currentGameState.hands, aiColor, currentDiff as any, currentGameState.lastMove);
    }, 500); 

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [isAITurn, phase, screen, requestAIMove]);
  // ==========================================================================
  // 🔄 🌟 ターン進行 ＆ 勝敗・実績同期ロジック
  // ==========================================================================
  const doNextTurn = useCallback((newBoard: any, newHands: any, move = null) => {
    const { gameMode: currentMode, difficulty: currentDiff } = latestRef.current;
    const moveWithPlayer = move ? { ...move, player: currentPlayer } : null;
    const result = checkWinner(newBoard);

    if (result) {
      setGameState((prev: any) => ({
        ...prev,
        board: newBoard,
        hands: newHands,
        lastMove: moveWithPlayer,
        selectedCell: null,
        moveCount: 0,
        winResult: result,
        phase: 'winDelay'
      }));
      setHasActiveGame(false);

      if (currentMode === 'ai' && result.winner === 'blue') {
        setStreaks((prev: any) => {
          const nextStreaks = { ...prev, [currentDiff]: (prev[currentDiff] || 0) + 1 };
          localStorage.setItem('game_streaks', JSON.stringify(nextStreaks));
          return nextStreaks;
        });
      }

      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      delayTimerRef.current = setTimeout(() => { 
        setGameState((prev: any) => ({ ...prev, phase: 'gameOver' }));
        setShowOverlay(true); 
      }, 2500); 

    } else {
      setGameState((prev: any) => ({
        ...prev,
        board: newBoard,
        hands: newHands,
        lastMove: moveWithPlayer,
        selectedCell: null,
        moveCount: 0,
        currentPlayer: prev.currentPlayer === 'blue' ? 'yellow' : 'blue',
        phase: 'selectAction'
      }));
    }
  }, [currentPlayer]);

  // AIワーカーからの非同期受信時に、いつでもこの関数を呼び出せるようにRefで住所をバインド
  useEffect(() => {
    (window as any).doNextTurnFallback = doNextTurn;
    return () => { delete (window as any).doNextTurnFallback; };
  }, [doNextTurn]);

  // ==========================================================================
  // ⏱️ 🌟 時間切れ用の処理
  // ==========================================================================
  const handleTimeOut = useCallback(() => {
    const { gameMode: currentMode, difficulty: currentDiff } = latestRef.current;
    const winnerColor = currentPlayer === 'blue' ? 'yellow' : 'blue';
    
    setGameState((prev: any) => ({
      ...prev,
      winResult: { winner: winnerColor, line: [] },
      phase: 'gameOver'
    }));
    setShowOverlay(true);
    setHasActiveGame(false);

    if (currentMode === 'ai' && winnerColor === 'blue') {
      setStreaks((prev: any) => {
        const nextStreaks = { ...prev, [currentDiff]: (prev[currentDiff] || 0) + 1 };
        localStorage.setItem('game_streaks', JSON.stringify(nextStreaks));
        return nextStreaks;
      });
    }
  }, [currentPlayer]);

  // ==========================================================================
  // 🎮 🌟 ゲーム開始処理 (startGame)
  // ==========================================================================
  const startGame = useCallback((mode: string, diff: string, startColor = 'blue') => {
    if (mode === 'resume') { setScreen('game'); return; }

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);

    setGameMode(mode); 
    setDifficulty(diff); 
    const initialColor = mode === 'ai' ? startColor : 'blue';
    setFirstPlayer(initialColor);

    setGameState({
      board: [[[], [], []], [[], [], []], [[], [], []]],
      hands: { blue: 5, yellow: 5 },
      currentPlayer: initialColor,
      phase: 'selectAction',
      selectedCell: null,
      moveCount: 0,
      winResult: null,
      lastMove: null,
    });

    setShowOverlay(false); 
    setAiThinking(false); 
    setTimerKey(prev => prev + 1); 
    setScreen('game');
    setHasActiveGame(true);
  }, []);

  // ==========================================================================
  // 👆 🌟 各種クリック・キャンセル処理
  // ==========================================================================
  const cancelAction = useCallback(() => {
    setGameState((prev: any) => ({ ...prev, phase: 'selectAction', selectedCell: null, moveCount: 0 }));
  }, []);

  const handleHandClick = useCallback(() => {
    const { gameState: current, aiThinking: at, isAITurn: ait } = latestRef.current;
    if (at || ait || current.phase === 'winDelay' || current.phase === 'gameOver') return;
    
    if (current.phase === 'selectAction' && current.hands[current.currentPlayer] > 0) { 
      setGameState((prev: any) => ({ ...prev, phase: 'placeSelect', selectedCell: null }));
    } else if (current.phase === 'placeSelect') { 
      setGameState((prev: any) => ({ ...prev, phase: 'selectAction', selectedCell: null }));
    }
  }, []); 

  const handleMoveCountSelect = useCallback((count: number) => {
    setGameState((prev: any) => ({ ...prev, moveCount: count, phase: 'moveTargetSelect' }));
  }, []);
  // ==========================================================================
  // 🎯 🌟 ハイライト・ターゲットマスの計算（Set高速ルックアップ）
  // ==========================================================================
  const validTargetsSet = useMemo(() => {
    if (winResult || aiThinking || (gameMode === 'ai' && currentPlayer === 'yellow')) return new Set();
    
    let targets: number[][] = [];
    if (phase === 'placeSelect') targets = getPlaceTargets(board);
    if ((phase === 'moveTargetSelect' || phase === 'moveCountSelect') && selectedCell) {
      targets = getValidTargets(board, selectedCell.row, selectedCell.col, moveCount, lastMove, currentPlayer);
    }
    return new Set(targets.map(([r, c]) => r + ',' + c));
  }, [phase, board, selectedCell, moveCount, lastMove, currentPlayer, winResult, aiThinking, gameMode]);

  const isValidTarget = useCallback((r: number, c: number) => {
    return validTargetsSet.has(r + ',' + c);
  }, [validTargetsSet]);

  const winLineSet = useMemo(() => { 
    if (!winResult || !winResult.line) return new Set(); 
    return new Set(winResult.line.map(([r, c]: any) => r + ',' + c)); 
  }, [winResult]);

  // ==========================================================================
  // 🎯 🌟 盤面マスのクリック処理（3層コピーバグ完全修正・プロ安全版）
  // ==========================================================================
  const handleCellClick = useCallback((row: number, col: number) => {
    const { gameState: current, aiThinking: at, isAITurn: ait } = latestRef.current;
    if (at || ait || current.phase === 'winDelay' || current.phase === 'gameOver' || current.winResult) return;
    
    if (current.phase === 'selectAction') {
      const stackHeight = current.board[row][col].length;
      if (stackHeight === 0) return;

      setGameState((prev: any) => ({
        ...prev,
        selectedCell: { row, col },
        moveCount: stackHeight === 1 ? 1 : 0,
        phase: stackHeight === 1 ? 'moveTargetSelect' : 'moveCountSelect'
      }));
    } 
    // 🔵 コマを配置する処理
    else if (current.phase === 'placeSelect') {
      if (!validTargetsSet.has(row + ',' + col)) return;

      const actionMove: Move = { type: 'place', row, col };
      
      // 💡 gameLogic.ts の超高速・非破壊applyMoveを使って、3層配列のコピーバグを完全根滅！
      const { board: newBoard, hands: newHands } = applyMove(
        current.board, 
        current.hands, 
        current.currentPlayer, 
        actionMove
      );

      doNextTurn(newBoard, newHands, actionMove);
    } 
    else if (current.phase === 'moveCountSelect') {
      if (row === current.selectedCell.row && col === current.selectedCell.col) { cancelAction(); return; }
      if (current.board[row][col].length > 0) {
        setGameState((prev: any) => ({ ...prev, selectedCell: { row, col } }));
      }
    } 
    // 🟡 コマをまとめて移動させる処理
    else if (current.phase === 'moveTargetSelect') {
      if (row === current.selectedCell.row && col === current.selectedCell.col) { cancelAction(); return; }
      if (!validTargetsSet.has(row + ',' + col)) return;

      const actionMove: Move = { 
        type: 'move', 
        fromRow: current.selectedCell.row, 
        fromCol: current.selectedCell.col, 
        toRow: row, 
        toCol: col, 
        count: current.moveCount 
      };

      // 💡 移動の際も同様に、安全なルール計算（applyMove）に丸投げして盤面の完全独立を保証！
      const { board: newBoard, hands: newHands } = applyMove(
        current.board, 
        current.hands, 
        current.currentPlayer, 
        actionMove
      );
      
      doNextTurn(newBoard, newHands, actionMove);
    }
  }, [validTargetsSet, doNextTurn, cancelAction]);

  // ==========================================================================
  // 🚪 画面遷移 ＆ リセット
  // ==========================================================================
   const backToMenu = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    
    // ⭕ 【大復活】裏で回り続けているクラッカーの無限ループを完全に息の根を止めます！
    if ((window as any).confettiLoop) {
      clearInterval((window as any).confettiLoop);
      (window as any).confettiLoop = null;
    }

    setScreen('menu'); 
    setAiThinking(false);
  }, []);


  const openInstructionsFromGame = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setScreen('instructions');
  }, []);

    const resetGame = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    
    // ⭕ 【大復活】新しい試合が始まる手前で、前の試合のクラッカータイマーを完全に消去！
    if ((window as any).confettiLoop) {
      clearInterval((window as any).confettiLoop);
      (window as any).confettiLoop = null;
    }

    setGameState({
      board: [[[], [], []], [[], [], []], [[], [], []]],
      hands: { blue: 5, yellow: 5 },
      currentPlayer: firstPlayer,
      phase: 'selectAction',
      selectedCell: null,
      moveCount: 0,
      winResult: null,
      lastMove: null,
    });
    setShowOverlay(false); 
    setAiThinking(false); 
    setHasActiveGame(true);
    setTimerKey(prev => prev + 1);
  }, [firstPlayer]);


  const openInstructions = useCallback(() => setScreen('instructions'), []);
  const resumeGame = useCallback(() => setScreen('game'), []);

  // ==========================================================================
  // 📊 高速事前計算
  // ==========================================================================
  const maxMovable = selectedCell ? board[selectedCell.row][selectedCell.col].length : 0;
  const isBlue = currentPlayer === 'blue';
  const turnLabel = isBlue ? 'プレイヤー1(青)' : (gameMode === '2p' ? 'プレイヤー2(黄)' : 'CPU(黄)');
  const turnColor = isBlue ? 'text-blue-400' : 'text-amber-500';
  const diffLabel = ({ easy: 'よわい', medium: 'ふつう', hard: 'つよい' } as any)[difficulty] || '';

  const phaseMessages = useMemo(() => {
    return {
      ...PHASE_MESSAGES_BASE,
      selectAction: aiThinking ? 'CPU思考中...' : '駒をタップして配置、または移動'
    };
  }, [aiThinking]);

  const currentWinStreak = winResult 
    ? (gameMode === '2p' ? (streaks[winResult.winner === 'blue' ? '2p_blue' : '2p_yellow'] || 0) : (streaks[difficulty] || 0))
    : 0;

  const interactionDisabled = aiThinking || isAITurn || phase === 'winDelay' || phase === 'gameOver';
  // ==========================================================================
  // 🛠️ デバッグ環境用グローバル関数（型エラー完全根絶版）
  // ==========================================================================
  useEffect(() => {
    (window as any).setWins = (count = 10, targetDiff = null) => {
      const activeDiff = targetDiff || difficulty || 'easy';
      setStreaks((prev: any) => ({ ...prev, [activeDiff]: count }));
    };

    (window as any).testWin = (count = 10, targetDiff = null) => {
      const activeDiff = targetDiff || difficulty || 'easy';
      setDifficulty(activeDiff);
      setGameMode('ai');
      setScreen('game');
      setStreaks((prev: any) => ({ ...prev, [activeDiff]: count }));
      setGameState((prev: any) => ({
        ...prev,
        winResult: { winner: 'blue', line: [] },
        phase: 'gameOver'
      }));
      setShowOverlay(true);
    };

    (window as any).resetWins = () => {
      localStorage.removeItem('game_streaks');
      setStreaks({ '2p_blue': 0, '2p_yellow': 0, easy: 0, medium: 0, hard: 0 });
      window.location.reload(); 
    };

    return () => {
      delete (window as any).setWins;
      delete (window as any).testWin;
      delete (window as any).resetWins;
    };
  }, [difficulty]);

  // ==========================================================================
  // 🎨 レンダリング（ノーカット修復版・Babel最適化）
  // ==========================================================================
  return (
    <div className="app-screen">
      <GameSvgDefs />

      {screen === 'menu' && (
        <MenuScreen streaks={streaks} setStreaks={setStreaks} onStart={startGame} onOpenInstructions={openInstructions} hasHistory={hasActiveGame} />
      )}

      {screen === 'instructions' && (
        <InstructionScreen onBack={backToMenu} hasActiveGame={hasActiveGame} onResumeGame={resumeGame} />
      )}

      {screen === 'game' && (
        <React.Fragment>
          <div className="text-center w-full">
            <h1 className="text-base font-black text-white mb-2 tracking-tight">
              3<span className="text-indigo-400">ライン</span>！
            </h1>
            <div className={'text-[16px] h-5 mt-0.5 mb-1 transition-all duration-300 ' + (!winResult ? (currentPlayer === 'blue' ? 'animate-syncTextBlue' : 'animate-syncTextAmber') : '')}>
              {!winResult ? (
                <React.Fragment>
                  <span className={'font-black ' + turnColor}>{turnLabel}</span>
                  <span className="text-gray-400 ml-1 font-bold">の番</span>
                </React.Fragment>
              ) : (
                <span className={'font-black animate-pulse ' + (winResult.winner === 'blue' ? 'text-blue-400' : 'text-amber-500')}>
                  ★ WINNER ★
                </span>
              )}
            </div>
          </div>

          <HandArea color="blue" count={hands.blue} isCurrentPlayer={currentPlayer === 'blue' && !winResult} isSelected={phase === 'placeSelect' && currentPlayer === 'blue'} onSelect={handleHandClick} playerLabel="P1 青" disabled={interactionDisabled} />

          <div className="game-message-container">
            <div className={'game-message-text ' + (!winResult ? (currentPlayer === 'blue' ? 'text-blue-200 animate-syncTextBlue' : 'text-amber-200 animate-syncTextAmber') : 'text-gray-200')}>
              {(phaseMessages as any)[phase] || ''}
            </div>
            <div className="game-action-row">
              {phase === 'moveCountSelect' && selectedCell && !interactionDisabled && (
                <MoveCountSelector maxCount={maxMovable} onSelect={handleMoveCountSelect} onCancel={cancelAction} />
              )}
              {(phase === 'placeSelect' || phase === 'moveTargetSelect') && !interactionDisabled && (
                <button onClick={cancelAction} className="btn-cancel">キャンセル</button>
              )}
            </div>
          </div>

          <GameTimer key={timerKey} screen={screen} winResult={winResult} interactionDisabled={interactionDisabled} currentPlayer={currentPlayer} onTimeOut={handleTimeOut} difficulty={difficulty} />

          <GameBoard board={board} selectedCell={selectedCell} isValidTarget={isValidTarget} lastMove={lastMove} winLineSet={winLineSet} winResult={winResult} handleCellClick={handleCellClick} interactionDisabled={interactionDisabled} phase={phase} />

          <HandArea color="yellow" count={hands.yellow} isCurrentPlayer={currentPlayer === 'yellow' && !winResult} isSelected={phase === 'placeSelect' && currentPlayer === 'yellow'} onSelect={handleHandClick} playerLabel={gameMode === '2p' ? 'P2 黄' : 'CPU (' + diffLabel + ')'} disabled={interactionDisabled || gameMode === 'ai'} />

          <div className="flex flex-col items-center gap-2 w-full mb-auto pt-4">
            {!winResult && (
              <button onClick={openInstructionsFromGame} className="w-full py-2 bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 rounded-xl text-sm font-black border border-indigo-800/60 shadow-sm active:scale-95 transition-transform">
                📄 試合を中断して説明を読む
              </button>
            )}
            <div className="flex gap-4 mt-4">
              <button onClick={resetGame} className="w-32 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-black shadow-sm active:scale-95 transition-transform">
                Reset
              </button>
              <button onClick={backToMenu} className="w-32 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-black shadow-sm active:scale-95 transition-transform">
                メニューへ
              </button>
            </div>
          </div>

          {showOverlay && winResult && (
            <WinOverlay 
              winner={winResult.winner} 
              onReset={resetGame} 
              gameMode={gameMode} 
              backToMenu={backToMenu} 
              difficulty={difficulty} 
              winStreak={currentWinStreak} 
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
