const envList = document.getElementById('env-list');
const toggleBtn = document.getElementById('toggle-btn');
const statusEl = document.getElementById('status');
const langSelect = document.getElementById('lang-select');
const finalEl = document.getElementById('final-transcript');
const interimEl = document.getElementById('interim-transcript');
const historyBody = document.getElementById('history-body');
const expectedInput = document.getElementById('expected-answer');
const gradeBtn = document.getElementById('grade-btn');
const gradeResult = document.getElementById('grade-result');

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSecureContext = window.isSecureContext;

function addEnvItem(label, ok) {
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'ng';
  li.textContent = label;
  envList.appendChild(li);
}

addEnvItem(
  `セキュアコンテキスト(https または localhost): ${isSecureContext ? '有効' : '無効(マイクにアクセスできません)'}`,
  isSecureContext
);
addEnvItem(
  `SpeechRecognition API: ${SpeechRecognitionImpl ? '利用可能' : '非対応ブラウザです(Chrome/Edge/Safariをお試しください)'}`,
  Boolean(SpeechRecognitionImpl)
);

let recognition = null;
let recording = false;
let lastResultText = '';

function appendHistory(text, confidence) {
  const tr = document.createElement('tr');
  const time = new Date().toLocaleTimeString('ja-JP');
  const confText = Number.isFinite(confidence) ? confidence.toFixed(2) : '(N/A)';
  tr.innerHTML = `<td>${time}</td><td>${text}</td><td>${confText}</td>`;
  historyBody.prepend(tr);
}

function setRecording(next) {
  recording = next;
  toggleBtn.textContent = recording ? '録音停止' : '録音開始';
  toggleBtn.classList.toggle('recording', recording);
  statusEl.textContent = recording ? '認識中...' : '待機中';
}

function createRecognition() {
  const r = new SpeechRecognitionImpl();
  r.lang = langSelect.value;
  r.continuous = true;
  r.interimResults = true;

  r.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        finalEl.textContent += text;
        lastResultText = text;
        appendHistory(text, result[0].confidence);
      } else {
        interim += text;
      }
    }
    interimEl.textContent = interim;
  };

  r.onerror = (event) => {
    statusEl.textContent = `エラー: ${event.error}`;
    setRecording(false);
  };

  r.onend = () => {
    if (recording) {
      // continuous=true でも無音が続くとブラウザ側で自動停止することがあるため再開する
      r.start();
    }
  };

  return r;
}

toggleBtn.addEventListener('click', () => {
  if (!SpeechRecognitionImpl) {
    return;
  }
  if (!recording) {
    finalEl.textContent = '';
    interimEl.textContent = '';
    recognition = createRecognition();
    recognition.lang = langSelect.value;
    setRecording(true);
    recognition.start();
  } else {
    setRecording(false);
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
  }
});

// 表記ゆれ(全角/半角、ひらがな/カタカナ、句読点)を吸収する簡易正規化
function normalize(text) {
  return text
    .replace(/[　\s、。！？]/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
    .toLowerCase();
}

// レーベンシュタイン距離による簡易な近似一致度(0〜1、1が完全一致)
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    new Array(b.length + 1).fill(0).map((_, j) => (i === 0 ? j : 0))
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const distance = dp[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

gradeBtn.addEventListener('click', () => {
  const expected = expectedInput.value.trim();
  if (!expected) {
    gradeResult.textContent = '模範解答を入力してください。';
    return;
  }
  if (!lastResultText) {
    gradeResult.textContent = 'まだ音声認識結果がありません。先に録音してください。';
    return;
  }
  const score = similarity(normalize(lastResultText), normalize(expected));
  const verdict = score >= 0.8 ? '正解' : score >= 0.5 ? '要確認' : '不正解';
  gradeResult.textContent =
    `認識結果「${lastResultText}」 vs 模範解答「${expected}」 → 一致度 ${(score * 100).toFixed(0)}% (${verdict})`;
});
