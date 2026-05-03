/**
 * Quiz Dong Tu N5 - Main Application Logic
 * 6 question types: JP->VN, VN->JP, Listen->VN, Conjugation, Ba form, Ta form
 */

// ============ STATE ============
let allVerbs = [];
let quizData = [];
let currentIndex = 0;
let score = 0;
let currentVerb = null;
let currentQuestion = null;
let selectedModes = [];
let answered = false;
let wrongAnswers = [];

// ============ INIT ============
async function init() {
  try {
    const res = await fetch('data.json');
    allVerbs = await res.json();
    console.log(`Loaded ${allVerbs.length} verbs`);
  } catch (e) {
    console.error('Failed to load data.json', e);
    alert('Không tải được dữ liệu. Hãy chạy extract_data.py trước.');
  }
}

init();

// ============ SCREENS ============
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============ START QUIZ ============
function startQuiz() {
  // Get selected modes
  selectedModes = [];
  document.querySelectorAll('#start-screen input[type="checkbox"]:checked').forEach(cb => {
    selectedModes.push(cb.value);
  });

  if (selectedModes.length === 0) {
    alert('Vui lòng chọn ít nhất 1 dạng câu hỏi.');
    return;
  }

  // Get count
  const countValue = document.querySelector('input[name="count"]:checked').value;

  // Prepare quiz data
  let pool = shuffle([...allVerbs]);
  if (countValue === '10') {
    pool = pool.slice(0, 10);
  }

  // Generate questions
  quizData = pool.map(verb => {
    const mode = selectedModes[Math.floor(Math.random() * selectedModes.length)];
    return generateQuestion(verb, mode);
  });

  currentIndex = 0;
  score = 0;
  wrongAnswers = [];
  answered = false;

  showScreen('quiz-screen');
  renderQuestion();
}

// ============ GENERATE QUESTION ============
function generateQuestion(verb, mode) {
  const question = { verb, mode, options: [] };

  if (mode === 'conjugation') {
    // Pick a random conjugation form to ask about
    const tenses = ['present', 'past'];
    const forms = ['affirmative', 'negative'];
    const styles = ['polite', 'plain'];

    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const form = forms[Math.floor(Math.random() * forms.length)];
    const style = styles[Math.floor(Math.random() * styles.length)];

    // Decide whether to ask about potential form (50% chance if available)
    const usePotential = Math.random() > 0.5 &&
      verb.potential?.[tense]?.[form]?.[style] &&
      verb.potential[tense][form][style] !== '-';

    const conjType = usePotential ? 'potential' : 'conjugations';
    const correctAnswer = verb[conjType][tense][form][style];

    if (!correctAnswer || correctAnswer === '-') {
      // Fallback to regular conjugation
      question.conjType = 'conjugations';
      question.tense = tense;
      question.form = form;
      question.style = style;
      question.correctAnswer = verb.conjugations[tense][form][style];
    } else {
      question.conjType = conjType;
      question.tense = tense;
      question.form = form;
      question.style = style;
      question.correctAnswer = correctAnswer;
    }

    // Generate wrong options from other verbs
    const wrongVerbs = allVerbs.filter(v => v.id !== verb.id);
    const shuffledWrong = shuffle(wrongVerbs);
    const wrongOptions = [];

    for (const wv of shuffledWrong) {
      if (wrongOptions.length >= 3) break;
      const wAnswer = wv[question.conjType]?.[tense]?.[form]?.[style];
      if (wAnswer && wAnswer !== '-' && wAnswer !== question.correctAnswer && !wrongOptions.includes(wAnswer)) {
        wrongOptions.push(wAnswer);
      }
    }

    question.options = shuffle([question.correctAnswer, ...wrongOptions]);

  } else if (mode === 'jp-vn' || mode === 'listen') {
    // Show Japanese word -> pick Vietnamese meaning
    question.correctAnswer = verb.meaning;
    const wrongVerbs = shuffle(allVerbs.filter(v => v.id !== verb.id));
    const wrongOptions = [];
    for (const wv of wrongVerbs) {
      if (wrongOptions.length >= 3) break;
      if (wv.meaning !== verb.meaning && !wrongOptions.includes(wv.meaning)) {
        wrongOptions.push(wv.meaning);
      }
    }
    question.options = shuffle([verb.meaning, ...wrongOptions]);

  } else if (mode === 'vn-jp') {
    // Show Vietnamese meaning -> pick Japanese word
    question.correctAnswer = verb.kanji;
    const wrongVerbs = shuffle(allVerbs.filter(v => v.id !== verb.id));
    const wrongOptions = [];
    for (const wv of wrongVerbs) {
      if (wrongOptions.length >= 3) break;
      if (wv.kanji !== verb.kanji && !wrongOptions.includes(wv.kanji)) {
        wrongOptions.push(wv.kanji);
      }
    }
    question.options = shuffle([verb.kanji, ...wrongOptions]);

  } else if (mode === 'ba' || mode === 'ta') {
    // Ba/Ta form conjugation quiz with smart wrong answers
    const formKey = mode === 'ba' ? 'ba_form' : 'ta_form';
    question.correctAnswer = verb[formKey];
    question.formType = mode;

    if (!question.correctAnswer) {
      // Fallback if no ba/ta data
      question.correctAnswer = mode === 'ba' ? verb.reading + 'ば' : verb.reading + 'た';
    }

    // Generate smart wrong answers using the SAME verb but with wrong conjugation patterns
    const wrongOptions = generateSmartWrongAnswers(verb, mode);
    question.options = shuffle([question.correctAnswer, ...wrongOptions.slice(0, 3)]);
  }

  return question;
}

// ============ RENDER QUESTION ============
function renderQuestion() {
  if (currentIndex >= quizData.length) {
    showFinalResult();
    return;
  }

  currentQuestion = quizData[currentIndex];
  currentVerb = currentQuestion.verb;
  answered = false;

  // Update header
  const badgeMap = {
    'jp-vn': 'Nhật → Việt',
    'vn-jp': 'Việt → Nhật',
    'listen': '🔊 Nghe → Việt',
    'conjugation': '📝 Chia động từ',
    'ba': '📝 Thể ば',
    'ta': '📝 Thể た'
  };
  document.getElementById('quiz-badge').textContent = badgeMap[currentQuestion.mode];
  document.getElementById('quiz-score').textContent = `Điểm: ${score}`;
  document.getElementById('quiz-progress').textContent = `Câu ${currentIndex + 1}/${quizData.length}`;

  const pct = ((currentIndex) / quizData.length) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';

  // Question text
  const questionText = document.getElementById('question-text');
  const btnFurigana = document.getElementById('btn-furigana-quiz');
  const btnSpeak = document.getElementById('btn-speak-quiz');

  // Reset furigana state
  document.querySelector('.question-area')?.classList.remove('show-furigana');
  btnFurigana.classList.remove('active');

  if (currentQuestion.mode === 'jp-vn') {
    questionText.innerHTML = buildRubyText(currentVerb.kanji, currentVerb.reading);
    btnFurigana.style.display = hasKanji(currentVerb.kanji) ? '' : 'none';
    btnSpeak.style.display = '';

  } else if (currentQuestion.mode === 'vn-jp') {
    questionText.innerHTML = `<span class="meaning-text">${currentVerb.meaning}</span>`;
    btnFurigana.style.display = 'none';
    btnSpeak.style.display = 'none';

  } else if (currentQuestion.mode === 'listen') {
    questionText.innerHTML = `<span style="font-size:3rem">🔊</span><span class="meaning-text">Nghe và chọn nghĩa đúng</span>`;
    btnFurigana.style.display = 'none';
    btnSpeak.style.display = '';
    // Auto-play speech
    setTimeout(() => speakText(currentVerb.reading), 300);

  } else if (currentQuestion.mode === 'conjugation') {
    const tenseVN = currentQuestion.tense === 'present' ? 'Hiện tại' : 'Quá khứ';
    const formVN = { affirmative: 'Khẳng định', negative: 'Phủ định' }[currentQuestion.form];
    const styleVN = currentQuestion.style === 'polite' ? 'Lịch sự' : 'Thường';
    const typeVN = currentQuestion.conjType === 'potential' ? ' (Khả năng)' : '';

    questionText.innerHTML = `
      ${buildRubyText(currentVerb.kanji, currentVerb.reading)}
      <span class="conj-prompt">${tenseVN} ・ ${formVN} ・ ${styleVN}${typeVN}</span>
    `;
    btnFurigana.style.display = hasKanji(currentVerb.kanji) ? '' : 'none';
    btnSpeak.style.display = '';

  } else if (currentQuestion.mode === 'ba' || currentQuestion.mode === 'ta') {
    const formName = currentQuestion.mode === 'ba' ? 'ば' : 'た';
    questionText.innerHTML = `
      ${buildRubyText(currentVerb.kanji, currentVerb.reading)}
      <span class="conj-prompt">Chia thể ${formName}</span>
    `;
    btnFurigana.style.display = hasKanji(currentVerb.kanji) ? '' : 'none';
    btnSpeak.style.display = '';
  }

  // Options
  const optionsArea = document.getElementById('options-area');
  optionsArea.innerHTML = '';
  currentQuestion.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.onclick = () => selectAnswer(i, opt);
    optionsArea.appendChild(btn);
  });

  // Hide result overlay
  document.getElementById('result-overlay').classList.add('hidden');
}

// ============ SELECT ANSWER ============
function selectAnswer(index, selected) {
  if (answered) return;
  answered = true;

  const correct = currentQuestion.correctAnswer;
  const isCorrect = selected === correct;

  if (isCorrect) score++;
  else wrongAnswers.push({ verb: currentVerb, selected, correct });

  // Highlight options
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (btn.textContent === correct) btn.classList.add('correct');
    if (i === index && !isCorrect) btn.classList.add('wrong');
  });

  // Show result overlay after short delay
  setTimeout(() => showResultOverlay(isCorrect), 500);
}

// ============ RESULT OVERLAY ============
function showResultOverlay(isCorrect) {
  const overlay = document.getElementById('result-overlay');
  overlay.classList.remove('hidden');

  // Status
  const status = document.getElementById('result-status');
  status.className = 'result-status ' + (isCorrect ? 'correct' : 'wrong');
  status.textContent = isCorrect ? '✓ Chính xác!' : '✗ Sai rồi!';

  // Word info
  document.getElementById('result-word').textContent = currentVerb.kanji;
  document.getElementById('result-reading').textContent = currentVerb.reading;
  document.getElementById('result-meaning').textContent = currentVerb.meaning;
  document.getElementById('result-group').textContent = `Nhóm ${currentVerb.group}`;

  // Conjugation table
  buildConjugationTable('conjugation-table', currentVerb.conjugations);

  // Potential table
  const potSection = document.getElementById('potential-section');
  const hasPotential = currentVerb.potential?.present?.affirmative?.polite &&
    currentVerb.potential.present.affirmative.polite !== '-';
  if (hasPotential) {
    potSection.style.display = '';
    buildConjugationTable('potential-table', currentVerb.potential);
  } else {
    potSection.style.display = 'none';
  }

  // Ba/Ta section
  const btSection = document.getElementById('ba-ta-section');
  const btArea = document.getElementById('ba-ta-area');
  if (currentVerb.ba_form || currentVerb.ta_form) {
    btSection.style.display = '';
    btArea.innerHTML = '';
    if (currentVerb.ba_form) {
      btArea.innerHTML += `
        <div class="ba-ta-item">
          <div class="ba-ta-label">Thể ば</div>
          <div class="ba-ta-form">${currentVerb.ba_form}</div>
          ${currentVerb.ba_example ? `<div class="ba-ta-example"><span>${currentVerb.ba_example}</span><button class="btn-icon-sm" onclick="speakText('${escapeQuotes(currentVerb.ba_example)}')" title="Phát âm">🔊</button></div>` : ''}
        </div>
      `;
    }
    if (currentVerb.ta_form) {
      btArea.innerHTML += `
        <div class="ba-ta-item">
          <div class="ba-ta-label">Thể た</div>
          <div class="ba-ta-form">${currentVerb.ta_form}</div>
          ${currentVerb.ta_example ? `<div class="ba-ta-example"><span>${currentVerb.ta_example}</span><button class="btn-icon-sm" onclick="speakText('${escapeQuotes(currentVerb.ta_example)}')" title="Phát âm">🔊</button></div>` : ''}
        </div>
      `;
    }
  } else {
    btSection.style.display = 'none';
  }

  // Examples
  const exArea = document.getElementById('examples-area');
  exArea.innerHTML = '';
  currentVerb.examples.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'example-item';
    div.innerHTML = `
      <div class="example-jp">
        <span>${ex.japanese}</span>
        <button class="btn-icon-sm" onclick="speakText('${escapeQuotes(ex.reading || ex.japanese)}')" title="Phát âm">🔊</button>
      </div>
      <div class="example-reading">${ex.reading || ''}</div>
      <div class="example-vn">${ex.vietnamese || ''}</div>
    `;
    exArea.appendChild(div);
  });

  // Reset toggle states
  document.getElementById('btn-furigana-result').classList.remove('active');
  document.getElementById('btn-furigana-result').textContent = 'Hiện phiên âm';
  document.getElementById('btn-vn-result').classList.remove('active');
  document.getElementById('btn-vn-result').textContent = 'Hiện nghĩa TV';
  exArea.classList.remove('show-furigana-result', 'show-vn-result');

  // Update next button
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = (currentIndex >= quizData.length - 1) ? 'Xem kết quả' : 'Câu tiếp theo';

  // Scroll overlay to top
  overlay.scrollTop = 0;
}

function buildConjugationTable(tableId, conjData) {
  const table = document.getElementById(tableId);
  table.innerHTML = `
    <thead>
      <tr>
        <th></th>
        <th>Lịch sự</th>
        <th>Thường</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>HT Khẳng định</td>
        <td>${conjData.present?.affirmative?.polite || '-'}</td>
        <td>${conjData.present?.affirmative?.plain || '-'}</td>
      </tr>
      <tr>
        <td>HT Phủ định</td>
        <td>${conjData.present?.negative?.polite || '-'}</td>
        <td>${conjData.present?.negative?.plain || '-'}</td>
      </tr>
      <tr>
        <td>QK Khẳng định</td>
        <td>${conjData.past?.affirmative?.polite || '-'}</td>
        <td>${conjData.past?.affirmative?.plain || '-'}</td>
      </tr>
      <tr>
        <td>QK Phủ định</td>
        <td>${conjData.past?.negative?.polite || '-'}</td>
        <td>${conjData.past?.negative?.plain || '-'}</td>
      </tr>
    </tbody>
  `;
}

// ============ NAVIGATION ============
function nextQuestion() {
  currentIndex++;
  if (currentIndex >= quizData.length) {
    showFinalResult();
  } else {
    renderQuestion();
  }
}

function showFinalResult() {
  showScreen('final-screen');
  document.getElementById('result-overlay').classList.add('hidden');

  const pct = quizData.length > 0 ? Math.round((score / quizData.length) * 100) : 0;
  document.getElementById('final-score').innerHTML = `
    ${score}/${quizData.length}
    <span class="label">${pct}% chính xác</span>
  `;

  const details = document.getElementById('final-details');
  if (wrongAnswers.length === 0) {
    details.innerHTML = '<p style="text-align:center;color:var(--success);padding:16px;">🎉 Xuất sắc! Bạn trả lời đúng tất cả!</p>';
  } else {
    details.innerHTML = `<p style="color:var(--text-muted);margin-bottom:8px;">Các câu trả lời sai:</p>`;
    wrongAnswers.forEach(wa => {
      details.innerHTML += `
        <div class="final-detail-item">
          <span class="icon">✗</span>
          <span class="word">${wa.verb.kanji}</span>
          <span class="meaning">${wa.verb.meaning}</span>
        </div>
      `;
    });
  }
}

function restartQuiz() {
  startQuiz();
}

function goHome() {
  showScreen('start-screen');
}

// ============ FURIGANA ============
function toggleQuizFurigana() {
  const area = document.querySelector('.question-area');
  const btn = document.getElementById('btn-furigana-quiz');
  area.classList.toggle('show-furigana');
  btn.classList.toggle('active');
}

function toggleResultFurigana() {
  const area = document.getElementById('examples-area');
  const btn = document.getElementById('btn-furigana-result');
  area.classList.toggle('show-furigana-result');
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? 'Ẩn phiên âm' : 'Hiện phiên âm';
}

function toggleResultVN() {
  const area = document.getElementById('examples-area');
  const btn = document.getElementById('btn-vn-result');
  area.classList.toggle('show-vn-result');
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? 'Ẩn nghĩa TV' : 'Hiện nghĩa TV';
}

// ============ SMART WRONG ANSWER GENERATION ============
function generateSmartWrongAnswers(verb, mode) {
  const reading = verb.reading;
  const kanji = verb.kanji;
  const group = verb.group;
  const correctAnswer = mode === 'ba' ? verb.ba_form : verb.ta_form;
  const wrongSet = new Set();

  // Get the verb stem (everything except the last character for group 1)
  // For group 2, stem is everything except る
  // For group 3, special handling for する and 来る

  if (group === 3) {
    // Group 3: する → すれば/した, 来る → 来れば/来た
    // For する verbs (散歩する, 勉強する, etc.)
    if (reading.endsWith('する')) {
      const prefix = kanji.replace(/する$/, '');
      if (mode === 'ba') {
        wrongSet.add(prefix + 'したら');
        wrongSet.add(prefix + 'して');
        wrongSet.add(prefix + 'しれば');
        wrongSet.add(prefix + 'されば');
      } else {
        wrongSet.add(prefix + 'して');
        wrongSet.add(prefix + 'すた');
        wrongSet.add(prefix + 'しった');
        wrongSet.add(prefix + 'さた');
      }
    } else if (reading === 'くる') {
      if (mode === 'ba') {
        wrongSet.add('来たら');
        wrongSet.add('来て');
        wrongSet.add('来ければ');
      } else {
        wrongSet.add('来って');
        wrongSet.add('来いた');
        wrongSet.add('来んだ');
      }
    }
  } else if (group === 2) {
    // Group 2: ~る verbs → stem + れば (ba) / stem + た (ta)
    const kanjiStem = hasKanji(kanji) ? kanji.slice(0, -1) : '';
    const readingStem = reading.slice(0, -1);

    if (mode === 'ba') {
      // Correct: stem + れば. Wrong patterns:
      wrongSet.add((kanjiStem || readingStem) + 'ば');
      wrongSet.add((kanjiStem || readingStem) + 'えば');
      wrongSet.add((kanjiStem || readingStem) + 'りば');
      wrongSet.add((kanjiStem || readingStem) + 'ければ');
      wrongSet.add((kanjiStem || readingStem) + 'れれば');
    } else {
      // Correct: stem + た. Wrong patterns:
      wrongSet.add((kanjiStem || readingStem) + 'った');
      wrongSet.add((kanjiStem || readingStem) + 'だ');
      wrongSet.add((kanjiStem || readingStem) + 'いた');
      wrongSet.add((kanjiStem || readingStem) + 'んだ');
      wrongSet.add((kanjiStem || readingStem) + 'りた');
    }
  } else {
    // Group 1: u-verbs - various stem changes
    const lastChar = reading.slice(-1);
    const stem = reading.slice(0, -1);
    const kanjiStem = hasKanji(kanji) ? kanji.slice(0, -1) : '';
    const base = kanjiStem || stem;

    // U-verb ending patterns for wrong answers
    if (mode === 'ba') {
      // Correct ba form uses え-dan + ば
      // Wrong patterns: other conjugation-like forms
      const wrongBaSuffixes = {
        'う': ['うば', 'いば', 'わば', 'ば'],
        'く': ['くば', 'きば', 'かば', 'いば'],
        'ぐ': ['ぐば', 'ぎば', 'がば', 'いば'],
        'す': ['すば', 'しば', 'さば', 'せれば'],
        'つ': ['つば', 'ちば', 'たば', 'いば'],
        'ぬ': ['ぬば', 'にば', 'なば', 'んば'],
        'ぶ': ['ぶば', 'びば', 'ばば', 'んば'],
        'む': ['むば', 'みば', 'まば', 'んば'],
        'る': ['るば', 'りば', 'らば', 'れれば']
      };
      const suffixes = wrongBaSuffixes[lastChar] || ['ば', 'れば', 'えば'];
      suffixes.forEach(s => wrongSet.add(base + s));
    } else {
      // Ta form wrong patterns - apply wrong ta-form rules
      const wrongTaSuffixes = {
        'う': ['いた', 'うた', 'んだ', 'した'],
        'く': ['った', 'くた', 'きた', 'んだ'],
        'ぐ': ['いた', 'ぐた', 'ぎた', 'った'],
        'す': ['った', 'すた', 'しった', 'しんだ'],
        'つ': ['ちた', 'つた', 'いた', 'んだ'],
        'ぬ': ['にた', 'ぬた', 'った', 'いた'],
        'ぶ': ['びた', 'ぶた', 'った', 'いた'],
        'む': ['みた', 'むた', 'った', 'いた'],
        'る': ['った', 'りた', 'るた', 'んだ']
      };
      const suffixes = wrongTaSuffixes[lastChar] || ['た', 'った', 'んだ'];
      suffixes.forEach(s => wrongSet.add(base + s));
    }
  }

  // Remove the correct answer from wrong set
  wrongSet.delete(correctAnswer);
  // Remove empty strings
  wrongSet.delete('');

  let results = [...wrongSet];

  // If we don't have enough wrong answers, add from other verbs
  if (results.length < 3) {
    const formKey = mode === 'ba' ? 'ba_form' : 'ta_form';
    const others = shuffle(allVerbs.filter(v => v.id !== verb.id && v[formKey]));
    for (const ov of others) {
      if (results.length >= 3) break;
      if (ov[formKey] && ov[formKey] !== correctAnswer && !results.includes(ov[formKey])) {
        results.push(ov[formKey]);
      }
    }
  }

  return shuffle(results).slice(0, 3);
}

// ============ RUBY TEXT ============
function hasKanji(text) {
  return /[\u4e00-\u9faf]/.test(text);
}

function buildRubyText(kanji, reading) {
  if (!hasKanji(kanji)) return `<span>${kanji}</span>`;
  return `<ruby>${kanji}<rt>${reading}</rt></ruby>`;
}

// ============ TTS ============
function speakWord() {
  if (currentVerb) {
    speakText(currentVerb.reading);
  }
}

function speakText(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85;

  // Try to find a Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const jpVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jpVoice) utterance.voice = jpVoice;

  window.speechSynthesis.speak(utterance);
}

// Preload voices
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// ============ UTILS ============
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeQuotes(str) {
  return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"') : '';
}
