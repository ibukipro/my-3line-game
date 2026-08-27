import React from 'react';
import confetti from 'canvas-confetti';

// ==========================================================================
// ⚙️ 🌟 [プロ最終最適化・分割版] ① 報酬設定 ＆ 爆速エフェクト制御
// ==========================================================================
const REWARD_CONFIG = Object.freeze({
  5: Object.freeze({
    baseClass: 'reward-medal-icon', 
    easy:   Object.freeze({ colorClass: 'medal-bronze', name: '銅メダル', grade: '9級', title: null }),
    medium: Object.freeze({ colorClass: 'medal-silver', name: '銀メダル', grade: '6級', title: null }),
    hard:   Object.freeze({ colorClass: 'medal-gold',   name: '金メダル', grade: '3級', title: null })
  }),
  10: Object.freeze({
    baseClass: 'reward-trophy-icon', 
    easy:   Object.freeze({ colorClass: 'trophy-bronze', name: '銅のトロフィー', grade: '8級', title: null }),
    medium: Object.freeze({ colorClass: 'trophy-silver', name: '銀のトロフィー', grade: '5級', title: null }),
    hard:   Object.freeze({ colorClass: 'trophy-gold',   name: '金のトロフィー', grade: '2級', title: null })
  }),
  20: Object.freeze({
    baseClass: 'reward-crown-icon', 
    easy:   Object.freeze({ colorClass: 'crown-bronze', name: '銅の王冠', grade: '7級', title: 'ブロンズマスター' }),
    medium: Object.freeze({ colorClass: 'crown-silver', name: '銀の王冠', grade: '4級', title: 'シルバーマスター' }),
    hard:   Object.freeze({ colorClass: 'crown-gold',   name: '金の王冠', grade: '1級', title: 'ゴールドマスター' })
  })
});

function checkAndShowReward(winCount, difficulty = 'easy') {
  if (winCount !== 5 && winCount !== 10 && winCount !== 20) return;

  const rewardGroup = REWARD_CONFIG[winCount];
  if (!rewardGroup) return; 

  const diffData = rewardGroup[difficulty] || rewardGroup.easy;
  if (!diffData) return; 

  const diffMap = { easy: 'よわい', medium: 'ふつう', hard: 'つよい' };
  const displayDiff = diffMap[difficulty] || 'よわい';

  const color = diffData.colorClass || '';
  const rankClass = color.indexOf('bronze') !== -1 ? 'rank-bronze' 
                  : color.indexOf('silver') !== -1 ? 'rank-silver' 
                  : 'rank-gold';

  closeRewardModal();

    if (typeof confetti === 'function') {
    const isCrown = winCount === 20;
    const isTrophy = winCount === 10;
    
    const initialCount = isCrown ? 200 : (isTrophy ? 140 : 80);
    const intervalSpeed = isCrown ? 240 : (isTrophy ? 350 : 500);

    const defaultPalette = [
      '#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42',
      '#ffa62d', '#ff36ff', '#00ffcc', '#ff3366', '#33ccff', '#99ff33'
    ];
    const paletteLen = defaultPalette.length;

     // 💡 1. 【古いゴミの全消去】裏で動いている余計な計算を、一瞬で完全に全滅リセット
    if (window.confettiLoop) {
      clearInterval(window.confettiLoop);
      window.confettiLoop = null;
    }
    if (typeof confetti.reset === 'function') {
      confetti.reset(); 
    }

    // 💡 2. 【極限最速 50ms ディレイ】
    // 待ち時間を 100 ➔ 50（0.05秒）に極限まで短縮しました！
    // 画面が切り替わった瞬間に、1ミリのタイムラグも感じさせずに左右同時大爆発が爽快に炸裂します。
    // 裏画面をCSSで眠らせているため、これだけ早くしてもカクつく心配は一切ありません！
    setTimeout(function() {

      /* ==========================================================================
         🎉 👑 【テンポ極限最速 ＆ 大迫力100%完全復活版】
         ========================================================================== */

      // 💥 最初の左右同時大爆発（100%の迫力・命を60に制限して爆速お掃除）
      confetti({ particleCount: initialCount, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, zIndex: 99999, scalar: 1.2, ticks: 60 });
      confetti({ particleCount: initialCount, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, zIndex: 99999, scalar: 1.2, ticks: 60 });

      // 3. 上からパラパラ降り続けるループ
      window.confettiLoop = setInterval(function() {
        const randomColor1 = defaultPalette[(Math.random() * paletteLen) | 0];
        const randomColor2 = defaultPalette[(Math.random() * paletteLen) | 0];
        const loopParticleCount = 1;

        confetti({ angle: 40,  spread: 60, startVelocity: 28, origin: { x: -0.05, y: -0.15 }, particleCount: loopParticleCount, gravity: 0.9, ticks: 180, colors: [randomColor1], zIndex: 99999, scalar: 1.1 });
        confetti({ angle: 90,  spread: 90, startVelocity: 16, origin: { x: 0.5,   y: -0.15 }, particleCount: loopParticleCount, gravity: 0.85, ticks: 180, colors: [randomColor2], zIndex: 99999, scalar: isCrown ? 1.35 : 1.15 });
        confetti({ angle: 140, spread: 60, startVelocity: 28, origin: { x: 1.05,  y: -0.15 }, particleCount: loopParticleCount, gravity: 0.9, ticks: 180, colors: [randomColor1], zIndex: 99999, scalar: 1.1 });
      }, intervalSpeed);

    }, 50); // 💡 人間の脳波の限界に挑む 50ミリ秒（0.05秒）
  }







    // ==========================================================================
  // ② ⭕ [プロ最終最適化・エラー絶対回避版] HTML組み立てのフラット事前計算
  // ==========================================================================
  
  // 💡 改善：テンプレートリテラル内のネストを全廃し、事前にフラットな文字列として組み立てる
  // これによりブラウザのBabelのパースバグを100%予防し、最速でDOMへ流し込めるようになります。
  var gradeBadgeHtml = '';
  var gradeTextHtml = '';
  if (diffData.grade) {
    gradeBadgeHtml = '<span class="badge-grade ' + rankClass + '">' + diffData.grade + '</span>';
    gradeTextHtml = '<p style="font-size: 13px; color: #bae6fd; margin: 10px 0 0 0; font-weight: 500; line-height: 1.5; white-space: normal;">「' + diffData.grade + '」を取得しました！</p>';
  }

  var titleBadgeHtml = '';
  var titleTextHtml = '';
  if (diffData.title) {
    titleBadgeHtml = '<div class="badge-title-container"><span class="badge-title ' + rankClass + '">👑 ' + diffData.title + '</span></div>';
    titleTextHtml = '<p style="font-size: 12px; color: #ffd700; margin: 8px 0 0 0; font-weight: bold; line-height: 1.5; white-space: normal;">称号「' + diffData.title + '」が<br />授与されました！</p>';
  }

  const baseClassStr = rewardGroup.baseClass || '';
  const nameStr = diffData.name || '';

  // 文字列結合（+）をベースにHTMLを最速・確実に組み立て
  const modalHtml = 
    '<div id="rewardModalOverlay" class="reward-modal-overlay">' +
      '<div class="reward-modal-box">' +
        '<div style="color: #facc15; font-size: 12px; font-weight: bold;">★ ACHIEVEMENTS UNLOCKED ★</div>' +
        
        '<div class="reward-medal-container">' +
          '<span class="' + baseClassStr + ' ' + color + ' sparkle-popup">' +
            '<i class="sparkle-star star-1">✦</i>' +
            '<i class="sparkle-star star-2">✦</i>' +
            '<i class="sparkle-star star-3">✦</i>' +
            '<i class="sparkle-star star-4">✦</i>' +
          '</span>' +
          gradeBadgeHtml +
        '</div>' +
        
        titleBadgeHtml +
        
        '<p style="margin: 1px 0 -15px 0; font-size: 12px; font-weight: bold; color: #cbd5e1;">【 難易度：' + displayDiff + ' 】</p>' +
        '<h2 style="margin: 25px 0 15px 0; font-size: 22px;">' + winCount + '勝達成！</h2>' +
        '<p style="font-size: 12px; color: #ccc; margin: 0;">' + nameStr + 'を獲得しました！</p>' +
        gradeTextHtml +
        titleTextHtml +
        
        '<button class="reward-close-btn" onclick="closeRewardModal()" style="margin: 30px 0 20px 0;">受け取る！</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ==========================================================================
// 🧹 🌟 ポップアップを閉じる（100%安全お掃除版）
// ==========================================================================
function closeRewardModal() {
  if (window.confettiLoop) {
    clearInterval(window.confettiLoop);
    window.confettiLoop = null;
  }

  if (typeof confetti === 'function' && typeof confetti.reset === 'function') {
    confetti.reset();
  }

  const modal = document.getElementById('rewardModalOverlay');
  if (modal) {
    modal.remove();
  }
}

// グローバルスコープへの安全な露出
window.checkAndShowReward = checkAndShowReward;
window.closeRewardModal = closeRewardModal;




// ==========================================================================
// 🏆 [プロ最終最適化・最軽量完全版] 獲得実績コレクション
// ==========================================================================

// 💡 1. 静的データを関数の「外側」へ追い出し、毎回のメモリ生成コストを完全ゼロへ！
const COLLECTION_ITEMS_DATA = Object.freeze([
  { id: 'm_easy',   streak: 5,  diff: 'easy',   diffLabel: 'よわい',   baseClass: 'reward-medal-icon',   colorClass: 'medal-bronze',  grade: '9級', title: null },
  { id: 't_easy',   streak: 10, diff: 'easy',   diffLabel: 'よわい',   baseClass: 'reward-trophy-icon',  colorClass: 'trophy-bronze', grade: '8級', title: null },
  { id: 'c_easy',   streak: 20, diff: 'easy',   diffLabel: 'よわい',   baseClass: 'reward-crown-icon',   colorClass: 'crown-bronze',  grade: '7級', title: 'ブロンズマスター' },

  { id: 'm_medium', streak: 5,  diff: 'medium', diffLabel: 'ふつう',   baseClass: 'reward-medal-icon',   colorClass: 'medal-silver',  grade: '6級', title: null },
  { id: 't_medium', streak: 10, diff: 'medium', diffLabel: 'ふつう',   baseClass: 'reward-trophy-icon',  colorClass: 'trophy-silver', grade: '5級', title: null },
  { id: 'c_medium', streak: 20, diff: 'medium', diffLabel: 'ふつう',   baseClass: 'reward-crown-icon',   colorClass: 'crown-silver',  grade: '4級', title: 'シルバーマスター' },

  { id: 'm_hard',   streak: 5,  diff: 'hard',   diffLabel: 'つよい',   baseClass: 'reward-medal-icon',   colorClass: 'medal-gold',    grade: '3級', title: null },
  { id: 't_hard',   streak: 10, diff: 'hard',   diffLabel: 'つよい',   baseClass: 'reward-trophy-icon',  colorClass: 'trophy-gold',   grade: '2級', title: null },
  { id: 'c_hard',   streak: 20, diff: 'hard',   diffLabel: 'つよい',   baseClass: 'reward-crown-icon',   colorClass: 'crown-gold',    grade: '1級', title: 'ゴールドマスター' }
]);

// 💡 2. 全体を React.memo で包み、実績データが本当に変わった時以外は再計算コストをシャットアウト
window.AchievementCollection = React.memo(function AchievementCollection(props) {
  var streaks = (props && props.streaks) ? props.streaks : {};
  var e = React.createElement;

  var cards = COLLECTION_ITEMS_DATA.map(function(item) {
    var count = Number(streaks[item.diff]) || 0;
    var isUnlocked = count >= item.streak;

    // ① マスター称号
    var topTitleElem;
    if (item.title) {
      topTitleElem = e('span', { 
        className: 'master-top-ribbon ' + item.diff + (isUnlocked ? '' : ' locked') 
      }, item.title);
    } else {
      topTitleElem = e('div', { className: 'master-top-spacer' }, ''); 
    }

    // ② アイコン領域
    var iconClass = 'reward-icon ' + item.baseClass + ' ' + item.colorClass;
    var iconChild = e('span', { className: iconClass });
    var wrapperClass = 'achievement-icon-wrapper' + (isUnlocked ? ' sparkle-frame' : '');
    var iconWrapper;

    if (isUnlocked) {
      var star1 = e('i', { className: 'sparkle-star star-1' }, '✦');
      var star2 = e('i', { className: 'sparkle-star star-2' }, '✦');
      var star3 = e('i', { className: 'sparkle-star star-3' }, '✦');
      var star4 = e('i', { className: 'sparkle-star star-4' }, '✦');
      iconWrapper = e('div', { className: wrapperClass }, iconChild, star1, star2, star3, star4);
    } else {
      var lockBadge = e('svg', {
        className: 'lock-badge',
        viewBox: '0 0 24 24',
        width: '18',
        height: '18',
        fill: 'none',
        stroke: '#ffffff',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      },
        e('rect', { x: '3', y: '10', width: '18', height: '12', rx: '2', ry: '2' }),
        e('path', { d: 'M7 10V6a5 5 0 0 1 10 0v4' }),
        e('circle', { cx: '12', cy: '15', r: '1.5', fill: '#ffffff', stroke: 'none' }),
        e('path', { d: 'M12 16.5v2', strokeWidth: '1.8' })
      );
      iconWrapper = e('div', { className: wrapperClass }, iconChild, lockBadge);
    }

    // ③ 下のテキスト情報
    var streakElem = e('div', { className: 'streak-label' }, item.diffLabel + ' ' + item.streak + '勝‼');
    var gradeElem = e('span', { className: 'grade-badge grade-' + item.diff }, item.grade);
    var infoArea = e('div', { className: 'achievement-info' }, streakElem, gradeElem);   

    // ④ カードの組み立て
    return e('div', {
      key: item.id,
      className: 'achievement-card ' + (isUnlocked ? 'unlocked' : 'locked')
    }, topTitleElem, iconWrapper, infoArea);
  });

  // ⑤ 全体パネルの組み立て
  return e('div', { className: 'achievement-panel' },
    e('h3', { className: 'achievement-title' }, '🏆 獲得実績コレクション'),
    e('div', { className: 'achievement-scroll-list' }, cards)
  );
}, function areEqual(prevProps, nextProps) {
  // 💡 【超高速化】連勝実績のオブジェクトの中身をプロファイルチェック
  // 実績の数字（easy, medium, hard）が一切変わっていないなら、このコンポーネントを完全に静止（フリーズ）させます。
  var p = prevProps.streaks || {};
  var n = nextProps.streaks || {};
  return p.easy === n.easy && p.medium === n.medium && p.hard === n.hard;
});

export { checkAndShowReward, closeRewardModal };
export default AchievementCollection;