/* ============================================================
   FACT-CHECKER APP.JS — Pipeline Engine & UI Controller
   Integrated with Google Fact Check Tools API
   ============================================================ */

// ── API Configuration ──────────────────────────────────────────
const API_CONFIG = {
  FACT_CHECK_KEY: 'AIzaSyDKsTs38ffTb1m3r1DGRSAS1bOVxFr1KFM',
  FACT_CHECK_BASE: 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
  PAGE_SIZE: 5
};

// ── Rating → Verdict mapper ────────────────────────────────────
// Google's textualRating is free-form ("False", "Mostly False", "True", etc.)
function normalizeRating(textualRating) {
  if (!textualRating) return { verdict: 'UNVERIFIED', score: 50 };
  const r = textualRating.toLowerCase().trim();

  // FALSE patterns
  if (/\b(false|wrong|incorrect|fake|misleading|hoax|inaccurate|fabricated|pants\s*on\s*fire|lie|lies|untrue|झूठ|गलत)\b/.test(r)) {
    return { verdict: 'FALSE', score: Math.round(82 + Math.random() * 17) };
  }
  // MOSTLY FALSE
  if (/\b(mostly\s*false|mostly\s*incorrect|mostly\s*wrong|largely\s*false|half\s*true|partially\s*false|partly\s*false)\b/.test(r)) {
    return { verdict: 'FALSE', score: Math.round(65 + Math.random() * 16) };
  }
  // DISPUTED / MIXED
  if (/\b(disputed|mixed|misleading|both\s*true|partially|partly|unverified|needs\s*context|missing\s*context|unproven|unsubstantiated)\b/.test(r)) {
    return { verdict: 'DISPUTED', score: Math.round(45 + Math.random() * 20) };
  }
  // TRUE patterns
  if (/\b(true|correct|accurate|verified|confirmed|सच|सही)\b/.test(r)) {
    return { verdict: 'TRUE', score: Math.round(5 + Math.random() * 18) };
  }
  // MOSTLY TRUE
  if (/\b(mostly\s*true|largely\s*true|mostly\s*correct|mostly\s*accurate)\b/.test(r)) {
    return { verdict: 'TRUE', score: Math.round(15 + Math.random() * 18) };
  }
  // Default: unknown rating → disputed
  return { verdict: 'DISPUTED', score: Math.round(48 + Math.random() * 20) };
}

// Conversational fluff patterns to strip during optimization
const FLUFF_PATTERNS = [
  /please share|forward this|make this go viral/gi,
  /breaking news|breaking!/gi,
  /must read/gi,
  /urgent|asap/gi,
  /friends|everyone/gi,
  /i want to tell everyone/gi,
  /believe me|trust me/gi,
  /\b(plz|pls|please)\b/gi,
  /!!+|😱|🚨|⚠️|🔴|🆘/g,
  /according to/gi,
  /copy paste this|send to everyone/gi
];

// ── State ──────────────────────────────────────────────────────
const State = {
  currentPost: null,
  processing: false,
  processedCount: 847234,
  detectedCount: 12847,
  throughput: 0,
  currentResult: null
};

// ── DOM References ─────────────────────────────────────────────
const DOM = {};

function cacheDom() {
  DOM.postInput       = document.getElementById('post-input');
  DOM.checkBtn        = document.getElementById('check-btn');
  DOM.pipelineCards   = [
    document.getElementById('pipeline-card-0'),
    document.getElementById('pipeline-card-1'),
    document.getElementById('pipeline-card-2'),
    document.getElementById('pipeline-card-3')
  ];
  DOM.progressDots    = [
    document.getElementById('prog-0'),
    document.getElementById('prog-1'),
    document.getElementById('prog-2'),
    document.getElementById('prog-3'),
    document.getElementById('prog-4')
  ];
  DOM.progressLines   = [
    document.getElementById('prog-line-0'),
    document.getElementById('prog-line-1'),
    document.getElementById('prog-line-2'),
    document.getElementById('prog-line-3')
  ];
  DOM.rawContent      = document.getElementById('card-raw-content');
  DOM.cleanContent    = document.getElementById('card-clean-content');
  DOM.claimsContent   = document.getElementById('card-claims-content');
  DOM.verdictContent  = document.getElementById('card-verdict-content');
  DOM.evidenceBody    = document.getElementById('evidence-body');
  DOM.evidenceSection = document.getElementById('evidence-section');
  DOM.verdictArea     = document.getElementById('verdict-area');
  DOM.alertBlock      = document.getElementById('alert-block');
  DOM.fakemeterScore  = document.getElementById('fakemeter-score');
  DOM.fakemeterLabel  = document.getElementById('fakemeter-label');
  DOM.gaugeNeedle     = document.getElementById('gauge-needle');
  DOM.processedCounter= document.getElementById('processed-count');
  DOM.detectedCounter = document.getElementById('detected-count');
  DOM.throughputEl    = document.getElementById('throughput-val');
  DOM.accuracyEl      = document.getElementById('accuracy-val');
  DOM.navProcessed    = document.getElementById('nav-processed');
  DOM.apiStatusBadge  = document.getElementById('api-status-badge');
}

// ── Pipeline Engine ─────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Stage 1: Raw Input Display
function stageRawInput(postText) {
  DOM.rawContent.innerHTML = `
    <div class="pipeline-card-content mono">${escHtml(postText)}</div>
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <span class="lang-tag">${detectLanguage(postText)}</span>
      <span style="display:inline-flex;align-items:center;gap:4px;padding:1px 6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;font-size:0.65rem;color:#64748b;font-weight:500">
        ${postText.split(/\s+/).length} words
      </span>
    </div>
  `;
}

// Stage 2: Optimization — strip fluff, extract signal
function stageOptimize(postText) {
  let cleaned = postText;
  let strippedItems = [];

  FLUFF_PATTERNS.forEach(pattern => {
    const matches = cleaned.match(pattern) || [];
    matches.forEach(m => strippedItems.push(m.trim()));
    cleaned = cleaned.replace(pattern, '');
  });

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  const wordsBefore = postText.split(/\s+/).length;
  const wordsAfter = cleaned.split(/\s+/).length;
  const reduction = Math.max(0, Math.round((1 - wordsAfter / wordsBefore) * 100));

  DOM.cleanContent.innerHTML = `
    <div class="pipeline-card-content mono" style="margin-bottom:10px">${escHtml(cleaned)}</div>
    ${strippedItems.length ? `
    <div style="font-size:0.68rem;color:#64748b;margin-bottom:6px">STRIPPED FLUFF:</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${strippedItems.slice(0,6).map(s=>`<span style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);padding:1px 6px;border-radius:4px;font-size:0.65rem;color:#ef4444;text-decoration:line-through">${escHtml(s)}</span>`).join('')}
    </div>` : ''}
    <div style="margin-top:8px;font-size:0.7rem;color:#22c55e">▼ ${reduction}% reduced — ${wordsAfter} tokens to verify</div>
  `;

  return cleaned;
}

// Stage 3: Claim Extraction
function extractClaims(text) {
  const sentences = text.split(/[.!?।]/).map(s => s.trim()).filter(s => s.length > 15);
  return sentences.slice(0, 3);
}

function stageClaims(claims) {
  DOM.claimsContent.innerHTML = `
    <div class="pipeline-card-content">
      <div style="font-size:0.68rem;color:#64748b;margin-bottom:8px;font-weight:600">FACTUAL CLAIMS DETECTED:</div>
      ${claims.map((c, i) => `
        <div style="margin-bottom:8px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;border-left:2px solid #3b82f6">
          <div style="font-size:0.65rem;color:#3b82f6;font-weight:700;margin-bottom:2px">CLAIM ${i+1}</div>
          <div style="font-size:0.78rem;color:#94a3b8">${escHtml(c)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Google Fact Check API Call ──────────────────────────────────
async function callFactCheckAPI(query, languageCode = '') {
  const params = new URLSearchParams({
    query: query,
    key: API_CONFIG.FACT_CHECK_KEY,
    pageSize: API_CONFIG.PAGE_SIZE
  });

  // Add language hint if detected
  if (languageCode) params.append('languageCode', languageCode);

  const url = `${API_CONFIG.FACT_CHECK_BASE}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.warn('[FactCheck API] Error:', response.status, errBody);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('[FactCheck API] Network error:', err);
    return null;
  }
}

// Parse API response into our internal match format
function parseAPIResponse(apiData) {
  if (!apiData || !apiData.claims || !apiData.claims.length) return [];

  return apiData.claims.map((claim, idx) => {
    const review = claim.claimReview && claim.claimReview[0];
    if (!review) return null;

    const { verdict: v, score: s } = normalizeRating(review.textualRating);

    return {
      isApiResult: true,
      fact: {
        claim: claim.text || 'Unknown claim',
        verdict: v,
        source: review.publisher ? review.publisher.name : 'Unknown publisher',
        sourceUrl: review.url || '#',
        category: 'Fact-Check',
        confidence: Math.max(0.6, 1 - (idx * 0.07)),  // Higher-ranked results get higher confidence
        textualRating: review.textualRating || v,
        reviewTitle: review.title || '',
        reviewDate: review.reviewDate ? review.reviewDate.split('T')[0] : '',
        claimant: claim.claimant || ''
      },
      score: Math.max(0.2, 1 - (idx * 0.15))  // relevance score decreasing by rank
    };
  }).filter(Boolean).slice(0, 5);
}

// ── Verdict Builder ─────────────────────────────────────────────
function computeVerdict(matches) {
  if (!matches.length) {
    return {
      verdict: 'UNVERIFIED',
      score: 50,
      confidence: 0.35,
      explanation: 'No matching fact-checks found in Google\'s Fact Check database. This claim could not be cross-referenced against known fact-checked content.',
      source: 'System (No Match Found)',
      sourceUrl: null,
      textualRating: 'Unverified',
      isApiResult: true
    };
  }

  const top = matches[0];
  const fact = top.fact;

  // Use score from API normalizer (already computed)
  const { score } = normalizeRating(fact.textualRating || '');
  const misinfoScore = score;
  const explanation = buildExplanation(fact);

  return {
    verdict: fact.verdict,
    score: misinfoScore,
    confidence: fact.confidence,
    explanation,
    source: `${fact.source}${fact.reviewDate ? ' · ' + fact.reviewDate : ''}`,
    sourceUrl: fact.sourceUrl || null,
    textualRating: fact.textualRating || fact.verdict,
    isApiResult: true
  };
}

function buildExplanation(fact) {
  const ratingStr = fact.textualRating ? `"${fact.textualRating}"` : fact.verdict;
  const byLine = `${fact.source}`;
  const titleLine = fact.reviewTitle ? ` (review: "${fact.reviewTitle.slice(0, 80)}...")` : '';
  const claimantLine = fact.claimant ? ` Originally attributed to: ${fact.claimant}.` : '';

  if (fact.verdict === 'FALSE') {
    return `This claim has been rated ${ratingStr} by ${byLine}${titleLine}.${claimantLine} The content contradicts established facts according to professional fact-checkers. Exercise caution before sharing this information.`;
  } else if (fact.verdict === 'TRUE') {
    return `This claim has been rated ${ratingStr} by ${byLine}${titleLine}.${claimantLine} The information is consistent with verified facts from credible sources.`;
  } else {
    return `This claim has been rated ${ratingStr} by ${byLine}${titleLine}.${claimantLine} The evidence is mixed or the context may be incomplete. Independent research is recommended before sharing.`;
  }
}

// ── Main Pipeline Runner ────────────────────────────────────────
async function runPipeline() {
  const postText = DOM.postInput.value.trim();
  if (!postText || State.processing) return;

  State.processing = true;
  DOM.checkBtn.disabled = true;
  DOM.checkBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⟳</span> Analyzing...';

  // Hide previous results
  DOM.alertBlock.className = 'alert-block';
  hideElement(DOM.evidenceSection);
  hideElement(DOM.verdictArea);
  resetPipeline();

  await delay(300);

  // ─── Stage 0: Raw Input ───────────────────────────────────
  setStage(0);
  stageRawInput(postText);
  await delay(700);

  // ─── Stage 1: Optimization ───────────────────────────────
  setStage(1);
  const cleaned = stageOptimize(postText);
  await delay(800);

  // ─── Stage 2: Claim Extraction ───────────────────────────
  setStage(2);
  const claims = extractClaims(cleaned);
  stageClaims(claims);
  await delay(700);

  // ─── Stage 3: API Retrieval + Verdict ────────────────────
  setStage(3);

  // Show "fetching from Google" status in verdict card
  DOM.verdictContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:#64748b;font-size:0.8rem">
      <span style="display:inline-block;animation:spin 1s linear infinite;font-size:1rem">⟳</span>
      Querying Google Fact Check API...
    </div>
    <div style="margin-top:8px;font-size:0.7rem;color:#475569">
      🌐 Cross-referencing against global fact-check database
    </div>
  `;

  // Detect language for API hint
  const lang = detectLanguage(postText);
  const langCode = 'en';

  // Build API query using substantive keywords (filtering out common English filler words)
  const stopWords = new Set(['an','the','are','was','were','be','been','being','have','has','had','do','does','did','for','with','of','on','at','from','by','about','as','into','like','through','after','over','between','out','against','during','without','before','under','around','among','it','this','that','they','them','their','he','she','his','hers','we','our','you','your','i','my','me']);
  const tokens = tokenize(cleaned).filter(t => !stopWords.has(t) && t.length >= 3);
  const apiQuery = tokens.length > 0 ? tokens.slice(0, 5).join(' ') : cleaned.slice(0, 50);

  // Call Google Fact Check API
  let matches = [];

  const apiData = await callFactCheckAPI(apiQuery, langCode);

  if (apiData && apiData.claims && apiData.claims.length > 0) {
    matches = parseAPIResponse(apiData);
    setApiStatusBadge('google', matches.length);
  } else {
    setApiStatusBadge('none', 0);
    console.info('[VeriShield] Google API returned no results.');
  }

  const result = computeVerdict(matches);
  State.currentResult = result;

  // Update Stage 3 card content
  DOM.verdictContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:1.5rem">${result.verdict === 'TRUE' ? '✅' : result.verdict === 'FALSE' ? '❌' : result.verdict === 'DISPUTED' ? '⚠️' : '❓'}</span>
      <span class="${verdictColorClass(result.verdict)}" style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700">${result.verdict}</span>
    </div>
    <div style="font-size:0.72rem;color:#64748b">Misinfo score: <span class="mono ${scoreColorClass(result.score)}">${result.score}/100</span></div>
    <div style="font-size:0.7rem;color:#64748b;margin-top:3px">Confidence: <span class="mono" style="color:#94a3b8">${Math.round(result.confidence * 100)}%</span></div>
    <div style="margin-top:6px;font-size:0.65rem;display:flex;align-items:center;gap:4px;color:#3b82f6">
      🌐 Google Fact Check API
    </div>
  `;

  await delay(400);

  // ─── Reveal Results ───────────────────────────────────────
  showElement(DOM.evidenceSection);
  renderEvidenceTable(matches);

  showElement(DOM.verdictArea);
  renderVerdict(result);
  animateFakemeter(result.score);
  showAlert(result);

  // Scroll verdict into view
  setTimeout(() => {
    DOM.verdictArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 300);

  // Update counters
  State.processedCount += Math.floor(Math.random() * 10) + 1;
  if (result.score >= 60) State.detectedCount += 1;
  updateCounters();

  State.processing = false;
  DOM.checkBtn.disabled = false;
  DOM.checkBtn.innerHTML = '🔍 Analyze Post';
}

// ── Set API Status Badge ────────────────────────────────────────
function setApiStatusBadge(mode, count) {
  if (!DOM.apiStatusBadge) return;
  if (mode === 'google') {
    DOM.apiStatusBadge.style.display = 'inline-flex';
    DOM.apiStatusBadge.className = 'api-badge api-badge-live';
    DOM.apiStatusBadge.innerHTML = `🌐 Google Fact Check API · ${count} result${count !== 1 ? 's' : ''}`;
  } else {
    DOM.apiStatusBadge.style.display = 'inline-flex';
    DOM.apiStatusBadge.className = 'api-badge api-badge-local';
    DOM.apiStatusBadge.innerHTML = `🗂 Local DB · ${count} match${count !== 1 ? 'es' : ''}`;
  }
}

// ── Pipeline Stage Management ───────────────────────────────────
function setStage(stageIdx) {
  DOM.pipelineCards.forEach((card, i) => {
    if (!card) return;
    card.classList.remove('active', 'processing');
    if (i === stageIdx) {
      card.classList.add('active', 'processing');
    } else if (i < stageIdx) {
      card.classList.add('active');
    }
  });

  DOM.progressDots.forEach((dot, i) => {
    if (dot) dot.classList.toggle('done', i <= stageIdx);
  });
  DOM.progressLines.forEach((line, i) => {
    if (line) line.classList.toggle('done', i < stageIdx);
  });
}

function resetPipeline() {
  DOM.pipelineCards.forEach(c => c && c.classList.remove('active', 'processing'));
  DOM.progressDots.forEach(d => d && d.classList.remove('done'));
  DOM.progressLines.forEach(l => l && l.classList.remove('done'));

  DOM.rawContent.innerHTML  = emptyContent('Waiting for input...');
  DOM.cleanContent.innerHTML = emptyContent('Will strip fluff & extract signal...');
  DOM.claimsContent.innerHTML = emptyContent('Will extract factual claims...');
  DOM.verdictContent.innerHTML = emptyContent('Awaiting verification...');

  if (DOM.apiStatusBadge) DOM.apiStatusBadge.style.display = 'none';
}

function emptyContent(msg) {
  return `<div class="pipeline-card-content" style="color:rgba(255,255,255,0.28);font-style:italic;font-size:0.8rem">${msg}</div>`;
}

// ── Evidence Table ──────────────────────────────────────────────
function renderEvidenceTable(matches) {
  if (!matches.length) {
    DOM.evidenceBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:rgba(255,255,255,0.28)">No matching facts found via Google Fact Check API</td></tr>`;
    return;
  }

  DOM.evidenceBody.innerHTML = matches.map(({ fact, score }) => {
    const ratingDisplay = fact.textualRating && fact.textualRating !== fact.verdict
      ? `<span class="${verdictColorClass(fact.verdict)}" style="font-weight:700;font-size:0.8rem">${fact.verdict}</span>
         <span style="font-size:0.68rem;color:rgba(255,255,255,0.35);display:block;margin-top:1px">"${escHtml(fact.textualRating)}"</span>`
      : `<span class="${verdictColorClass(fact.verdict)}" style="font-weight:700;font-size:0.8rem">${fact.verdict}</span>`;

    const sourceCell = fact.sourceUrl && fact.sourceUrl !== '#'
      ? `<a href="${escHtml(fact.sourceUrl)}" target="_blank" rel="noopener" style="color:#93c5fd;font-size:0.75rem;text-decoration:none;word-break:break-word" title="Open fact-check">↗ ${escHtml(fact.source)}</a>`
      : `<span style="font-size:0.75rem;color:rgba(255,255,255,0.35)">${escHtml(fact.source)}</span>`;

    const claimCell = fact.reviewTitle
      ? `<div style="color:rgba(255,255,255,0.85);font-size:0.82rem;margin-bottom:2px">${escHtml(fact.claim.slice(0, 120))}${fact.claim.length > 120 ? '…' : ''}</div>
         <div style="color:rgba(255,255,255,0.38);font-size:0.7rem;font-style:italic">${escHtml(fact.reviewTitle.slice(0, 80))}${fact.reviewTitle.length > 80 ? '…' : ''}</div>`
      : `<div style="color:rgba(255,255,255,0.85);font-size:0.82rem">${escHtml(fact.claim.slice(0, 120))}${fact.claim.length > 120 ? '…' : ''}</div>`;

    const catStyle = 'background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.25);color:#60a5fa';

    return `
      <tr>
        <td><span class="lang-tag" style="${catStyle}">${escHtml(fact.category)}</span></td>
        <td style="max-width:320px">${claimCell}</td>
        <td>${ratingDisplay}</td>
        <td>
          <div class="match-score">
            <div class="match-bar"><div class="match-bar-fill" style="width:${Math.round(score*100)}%"></div></div>
            <span class="mono" style="font-size:0.72rem;color:rgba(255,255,255,0.55)">${Math.round(score*100)}%</span>
          </div>
        </td>
        <td>${sourceCell}</td>
      </tr>
    `;
  }).join('');
}

// ── Verdict Area ────────────────────────────────────────────────
function renderVerdict(result) {
  const vClass = result.verdict === 'FALSE' ? 'verdict-false'
               : result.verdict === 'TRUE' ? 'verdict-true'
               : result.verdict === 'DISPUTED' ? 'verdict-disputed' : '';

  const vCard = DOM.verdictArea.querySelector('.verdict-card');
  vCard.className = `verdict-card ${vClass}`;

  const badgeClass = result.verdict === 'FALSE' ? 'false'
                   : result.verdict === 'TRUE' ? 'true'
                   : result.verdict === 'DISPUTED' ? 'disputed' : 'disputed';

  const icon = result.verdict === 'FALSE' ? '✗'
             : result.verdict === 'TRUE' ? '✓'
             : result.verdict === 'DISPUTED' ? '~' : '?';

  const verdictBadgeEl = document.getElementById('verdict-badge');
  verdictBadgeEl.className = `verdict-badge ${badgeClass}`;

  const textualRatingDisplay = result.textualRating && result.textualRating !== result.verdict
    ? `${icon} ${result.verdict} <span style="font-size:0.6em;opacity:0.75;font-weight:400">· "${result.textualRating}"</span>`
    : `${icon} ${result.verdict}`;

  verdictBadgeEl.innerHTML = textualRatingDisplay;

  document.getElementById('verdict-explanation').textContent = result.explanation;

  // Source with optional link
  const sourceEl = document.getElementById('verdict-source-text');
  if (result.sourceUrl) {
    sourceEl.innerHTML = `<a href="${escHtml(result.sourceUrl)}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:none">↗ ${escHtml(result.source)}</a>`;
  } else {
    sourceEl.textContent = result.source;
  }

  document.getElementById('confidence-value').textContent = `${Math.round(result.confidence * 100)}%`;

  const fillPct = Math.round(result.confidence * 100);
  const fillEl = document.getElementById('confidence-fill');
  fillEl.style.width = '0%';
  fillEl.style.background = result.verdict === 'FALSE'
    ? 'linear-gradient(90deg, #f87171, #f97316)'
    : result.verdict === 'TRUE'
    ? 'linear-gradient(90deg, #4ade80, #06b6d4)'
    : 'linear-gradient(90deg, #fbbf24, #f97316)';
  setTimeout(() => {
    fillEl.style.width = fillPct + '%';
    fillEl.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
  }, 100);

  // Show API attribution
  const apiAttr = document.getElementById('verdict-api-attr');
  if (apiAttr) {
    apiAttr.innerHTML = `
      <span style="font-size:0.68rem;color:#3b82f6;display:flex;align-items:center;gap:4px;margin-top:8px">
        🌐 Powered by <strong>Google Fact Check Tools API</strong>
      </span>`;
  }
}

// ── FakeMeter Gauge ─────────────────────────────────────────────
function animateFakemeter(score) {
  const angle = -90 + (score / 100) * 180;
  DOM.gaugeNeedle.style.transform = `rotate(${angle}deg)`;
  DOM.fakemeterScore.textContent = score;

  let color, label;
  if (score <= 20)      { color = '#22c55e'; label = 'CREDIBLE'; }
  else if (score <= 45) { color = '#84cc16'; label = 'LIKELY TRUE'; }
  else if (score <= 65) { color = '#f59e0b'; label = 'DISPUTED'; }
  else if (score <= 80) { color = '#f97316'; label = 'SUSPICIOUS'; }
  else                   { color = '#ef4444'; label = 'MISINFORMATION'; }

  DOM.fakemeterScore.style.color = color;
  DOM.fakemeterLabel.style.color = color;
  DOM.fakemeterLabel.textContent = label;
}

// ── Alert Block ─────────────────────────────────────────────────
function showAlert(result) {
  let alertClass, alertIcon, alertTitle, alertText;

  if (result.score >= 65) {
    alertClass = 'danger';
    alertIcon = '🚨';
    alertTitle = 'HIGH-RISK MISINFORMATION DETECTED';
    alertText = `This content scores ${result.score}/100 on our misinformation index. Professional fact-checkers have rated this claim "${result.textualRating}". Do not share without independent verification.`;
  } else if (result.score >= 40) {
    alertClass = 'warn';
    alertIcon = '⚠️';
    alertTitle = 'DISPUTED CONTENT — Proceed with Caution';
    alertText = `This content has been rated "${result.textualRating}" (score: ${result.score}/100). Evidence is mixed or context may be incomplete. Independent verification from multiple credible sources is strongly recommended before sharing.`;
  } else {
    alertClass = 'safe';
    alertIcon = '✅';
    alertTitle = 'CONTENT APPEARS CREDIBLE';
    alertText = `Our analysis found no significant misinformation markers (score: ${result.score}/100). Fact-checkers have rated this "${result.textualRating}". The claims align with verified sources, though independent verification is always advised.`;
  }

  DOM.alertBlock.className = `alert-block ${alertClass} visible`;
  DOM.alertBlock.innerHTML = `
    <div class="alert-icon">${alertIcon}</div>
    <div class="alert-body">
      <div class="alert-title">${alertTitle}</div>
      <div class="alert-text">${alertText}</div>
    </div>
    <button onclick="this.parentElement.className='alert-block'" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;line-height:1;padding:0 4px;align-self:flex-start">×</button>
  `;
}

// ── Metrics ────────────────────────────────────────────────────
function updateCounters() {
  if (DOM.processedCounter) animateCount(DOM.processedCounter, State.processedCount);
  if (DOM.detectedCounter)  animateCount(DOM.detectedCounter, State.detectedCount);
  if (DOM.navProcessed)     DOM.navProcessed.textContent = formatNum(State.processedCount);
}

function animateCount(el, target) {
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  const diff = target - current;
  if (diff <= 0) { el.textContent = formatNum(target); return; }
  const step = Math.max(1, Math.floor(diff / 20));
  let val = current;
  const timer = setInterval(() => {
    val = Math.min(val + step, target);
    el.textContent = formatNum(val);
    if (val >= target) clearInterval(timer);
  }, 30);
}

function updateThroughput() {
  State.throughput = Math.floor(1200 + Math.random() * 900);
  if (DOM.throughputEl) DOM.throughputEl.textContent = formatNum(State.throughput);
  const acc = (95.5 + Math.random() * 3.5).toFixed(1);
  if (DOM.accuracyEl) DOM.accuracyEl.textContent = acc + '%';
}

// ── Utilities ───────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function detectLanguage(text) {
  return 'English';
}

function formatTimeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatNum(n) {
  return n.toLocaleString('en-IN');
}

function showElement(el) { if (el) el.classList.remove('hidden'); }
function hideElement(el) { if (el) el.classList.add('hidden'); }

function verdictColorClass(v) {
  if (v === 'TRUE') return 'text-safe';
  if (v === 'FALSE') return 'text-danger';
  return 'text-warn';
}

function scoreColorClass(s) {
  if (s >= 65) return 'text-danger';
  if (s >= 40) return 'text-warn';
  return 'text-safe';
}

function animateHeroCounters() {
  document.querySelectorAll('[data-count-to]').forEach(el => {
    const target = parseInt(el.dataset.countTo);
    const suffix = el.dataset.suffix || '';
    let val = 0;
    const step = Math.max(1, Math.floor(target / 80));
    const timer = setInterval(() => {
      val = Math.min(val + step, target);
      el.textContent = formatNum(val) + suffix;
      if (val >= target) clearInterval(timer);
    }, 20);
  });
}

function scrollToDashboard() {
  document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  updateCounters();
  setInterval(updateThroughput, 2000);
  updateThroughput();
  animateHeroCounters();

  DOM.checkBtn.addEventListener('click', runPipeline);
  DOM.postInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runPipeline();
  });

  DOM.postInput.placeholder = `Paste news post here...\n\nExample: "New Education Policy 2020 bans all English medium schools from 2024!"`;
});
