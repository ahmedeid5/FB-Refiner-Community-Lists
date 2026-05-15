// --- FB-Refiner Pro: FINAL PROFESSIONAL CORE (V29.1 - Fixed False Positives) ---
// BASE: thebest.js Logic | ENGINE: Pro Core v7.1 | TARGET: Facebook Only

// ====== 1. CONSTANTS & DICTIONARIES ======
const DEFAULT_BLACKLIST = ["خول", "عرص", "متناكه", "وسخ", "شرموطه", "عرس", "شرموط", "متناك", "قحب", "منيوك", "منيك", "كس", "طيز", "زبر", "لبوه", "ديوث"];
const SUSPICIOUS_ACTIONS = ["متابعة", "Follow", "انضمام", "Join"];
const SEND_ICON_PATHS = ["M1.32", "M2.01", "M23 12", "M12 2L4.5 20.29", "M22 2L11 13", "M21 3L3 10.5", "M21 3Z"];
const REEL_ICON_PATH = "M1.046 6.5"; 

const innocentWords = new Set(['كسل', 'كسارة', 'كسر', 'كاسر', 'كسوة', 'انكسار', 'عروس', 'عرسة', 'عرس', 'عراس', 'ديكور', 'حديقة', 'بنك', 'بنية', 'كسول', 'يا كسول', 'عم', 'طير', 'حيوان', 'مرة', 'جزمة', 'ايران', 'بحرين', 'طيران']);
const arabicSuffixes = ['ك', 'كما', 'كم', 'كن', 'ه', 'ها', 'هم', 'نا', 'ي', 'ات', 'ين', 'ون', 'ية', 'ة', 'ه'];
const arabicPrefixes = ['ال', 'ل', 'لل', 'ب', 'ف', 'م', 'الم', 'يا', 'بالم', 'فال'];
const familyContext = ['ام', 'اب', 'اخت', 'اخ', 'اهل', 'عرض', 'شرف', 'زوجة', 'بنت', 'جد', 'تيتة', 'مره', 'نسوان'];
const contextTriggers = ['يا', 'يابن', 'يابنت', 'انت', 'انتي', 'انتم', 'يلعن', 'ابن', 'امك', 'ابوك', 'ياولاد'];
const connectedTriggerPrefixes = ['يا', 'ياب'];
const charMapAr = { 'ا': '[اأإآى]', 'أ': '[اأإآى]', 'إ': '[اأإآى]', 'آ': '[اأإآى]', 'ب': '[ب]', 'ت': '[ت]', 'ث': '[ث]', 'ج': '[ج]', 'ح': '[ح]', 'خ': '[خ]', 'د': '[د]', 'ذ': '[ذ]', 'ر': '[ر]', 'ز': '[ز]', 'س': '[س]', 'ش': '[ش]', 'ص': '[ص]', 'ض': '[ض]', 'ط': '[ط]', 'ظ': '[ظ]', 'ع': '[ع]', 'غ': '[غ]', 'ف': '[ف]', 'ق': '[ق]', 'ك': '[ك]', 'ل': '[ل]', 'م': '[م]', 'ن': '[ن]', 'ه': '[هة]', 'ة': '[هة]', 'و': '[و]', 'ي': '[يىئ]', 'ى': '[يىئ]', 'ئ': '[يىئ]' };
const leetMapEn = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '#': 'h', '&': 'and' };

// ====== 2. STATE & SETTINGS ======
let settings = { 
    holdYourFinger: true, 
    blockAds: true, 
    blockReels: true, 
    searchQuery: "", 
    customIntruderWords: [], 
    customHardWords: [],
    customSoftWords: [],
    hideToxicComments: false, 
    rg_engine: 'ar', 
    strictArabic: 'off', 
    showSummaryBar: true
};
let blacklist = { hard: [], soft: [], manual: DEFAULT_BLACKLIST };
let hardRegex = null;
let morphemicRootSet = new Set();
let strictAffixSet = new Set();
let softWordsSet = new Map();

const processedElements = new WeakSet();
let debounceTimer = null;
let hiddenBatch = [];
const pageStartTime = Date.now();

// ====== 3. CORE UTILITIES ======

function injectToggle(nextVisibleItem, batch) {
    if (!settings.showSummaryBar || !batch || batch.length === 0) return;
    const firstHidden = batch[0];
    if (!firstHidden || !firstHidden.parentNode) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'rg-batch-wrapper';
    firstHidden.parentNode.insertBefore(wrapper, firstHidden);
    const count = batch.length;
    const btn = document.createElement('div');
    btn.className = 'rg-hidden-toggle';
    btn.innerHTML = `🛡️ FB-Refiner: ${count} hidden posts (Ads / Suggested) <span>Show</span>`;
    wrapper.appendChild(btn);
    batch.forEach(el => wrapper.appendChild(el));
    let isShown = false;
    btn.onclick = (e) => {
        e.stopPropagation(); isShown = !isShown;
        batch.forEach(el => { if (el && el.style) { el.style.display = isShown ? 'block' : 'none'; if (isShown) el.style.opacity = '0.8'; } });
        btn.querySelector('span').innerText = isShown ? 'Hide' : 'Show';
        if (isShown) btn.classList.add('rg-sticky'); else btn.classList.remove('rg-sticky');
    };
}

function normalizeArabic(text) {
    if (!text) return "";
    return text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
}

function createShadowText(text) {
    if (!text) return "";
    let cleaned = text.replace(/[\u064B-\u0652\u0640]/g, "").replace(/(.)\1+/gu, '$1')
                     .replace(/[^\u0600-\u06FF\s]/g, (m) => {
                         const map = { '1': 'ا', '3': 'ع', '0': 'ه', '4': 'ع', '@': 'ا' };
                         return map[m] || " ";
                     }).replace(/\s+/g, " ").trim();
    return cleaned;
}

function normalizeEnglishEnhanced(text) {
    if (!text) return "";
    let n = text.toLowerCase().trim().replace(/[\u200B-\u200F\uFEFF]/g, '').normalize('NFD').replace(/[\u0300-\u036F]/g, '');
    n = n.replace(/[\s\.\-_*#@~!+^\[\]{}()\/<>\\=&|]/g, '');
    for (const [c, r] of Object.entries(leetMapEn)) n = n.split(c).join(r);
    return n.replace(/(.)\1+/g, '$1').trim();
}

function multiLanguageDetect(text, wordsList) {
    if (!text || !wordsList || wordsList.length === 0) return false;
    const nText = normalizeEnglishEnhanced(text);
    if (!nText) return false;
    for (let word of wordsList) {
        const nWord = normalizeEnglishEnhanced(word);
        if (nWord && nWord.length >= 2 && nText.includes(nWord)) {
            if (nWord.length >= 3 || nText === nWord) return word; 
        }
    }
    return false;
}

function stripArabicAffixes(word) {
    if (!word || word.length <= 3) return word;
    let clean = word;
    for (let p of arabicPrefixes) { if (clean.startsWith(p) && (clean.length - p.length) >= 3) { clean = clean.substring(p.length); break; } }
    let changed = true;
    while (changed && clean.length > 3) {
        changed = false;
        for (let s of arabicSuffixes) { if (clean.endsWith(s) && (clean.length - s.length) >= 3) { clean = clean.slice(0, -s.length); changed = true; break; } }
    }
    return clean;
}

function getFinalEgyptianRoot(word) {
    if (!word || word.length < 4) return word;
    let res = word.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة$/g, 'ه');
    res = res.replace(/^(ال|وال|بال|فال|لل|ح|ه)/, "");
    res = res.replace(/(ات|ون|ين|ها|هم|كم|na|وا|ت)$/, "");
    if (res.length < 3) return word;
    if (res.startsWith("مت") && res.length >= 5) {
        let l = res.split(""); res = l[2] + "ي" + l[4]; 
    } else if (res.startsWith("م") && res.length >= 5) {
        if (res[res.length - 2] === "و") res = res.substring(1).replace("و", ""); else res = res.substring(1);
    } else if (res.startsWith("ا") && res.length === 4) {
        res = res.substring(1);
    }
    if (res.length >= 5) { 
        res = res.replace("ا", ""); 
        if (res.length > 4) res = res.replace("ي", ""); 
    }
    return res;
}

function generateArabicPattern(word) {
    const clean = word.toLowerCase().trim().replace(/[\u064B-\u065F]/g, '');
    if (clean.length < 3) return null;
    let pattern = '';
    const separator = '[\\s\\._\\-\\*\\^\\?\\!\\,،]{0,1}';
    for (let i = 0; i < clean.length; i++) { 
        pattern += (charMapAr[clean[i]] || `[${clean[i]}]`) + '+'; 
        if (i < clean.length - 1) pattern += separator; 
    }
    return pattern;
}

function compileRegex() {
    const hardAndManual = [...new Set([...blacklist.manual, ...blacklist.hard])];
    const softWords = [...new Set(blacklist.soft)];
    
    morphemicRootSet = new Set();
    strictAffixSet = new Set();
    softWordsSet = new Map();

    hardAndManual.forEach(w => {
        if (/[\u0600-\u06FF]/.test(w)) {
            morphemicRootSet.add(getFinalEgyptianRoot(w));
            strictAffixSet.add(stripArabicAffixes(w));
        }
    });

    softWords.forEach(w => {
        if (/[\u0600-\u06FF]/.test(w)) {
            softWordsSet.set(stripArabicAffixes(w), w);
        }
    });

    console.log(`🛡️ FB-Refiner: Brain Re-indexed. (CPU Load: Low)`);

    const trulyHard = hardAndManual.filter(w => w && w.length >= 3);
    if (trulyHard.length > 0) {
        const patterns = trulyHard.map(w => /[\u0600-\u06FF]/.test(w) ? generateArabicPattern(w) : w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(p => p);
        hardRegex = new RegExp(`(${patterns.join('|')})`, 'gi');
    } else {
        hardRegex = null;
    }
}

function checkMatch(text, regex) {
    if (!text || !regex) return false;
    const matches = [...text.matchAll(regex)];
    for (const match of matches) {
        const m = match[0];
        if (m.length < 3) continue;
        const index = match.index, length = m.length;
        const beforeOk = index === 0 || !/[\u0600-\u06FFa-zA-Z0-9]/.test(text[index - 1]);
        const afterOk = index + length === text.length || !/[\u0600-\u06FFa-zA-Z0-9]/.test(text[index + length]);
        if (beforeOk && afterOk) return m;
    }
    return false;
}

function isToxic(text) {
    if (!text || text.length < 3) return false;
    if (innocentWords.has(text.toLowerCase().trim())) return false;
    
    const engine = settings.rg_engine || 'ar';
    
    if (engine === 'ar' || (engine === 'auto' && /[\u0600-\u06FF]/.test(text))) {
        if (/[\u0600-\u06FF]/.test(text)) {
            const shadow = createShadowText(text);
            let match = checkMatch(text.toLowerCase(), hardRegex) || checkMatch(shadow, hardRegex);
            if (match) return match;

            const shadowWords = shadow.split(" ");
            for (let i = 0; i < shadowWords.length; i++) {
                const currentWord = shadowWords[i];
                if (currentWord.length < 3) continue;

                if (settings.strictArabic === 'morphemic') {
                    if (morphemicRootSet.has(getFinalEgyptianRoot(currentWord))) return currentWord; 
                } else if (settings.strictArabic === 'strict') {
                    if (strictAffixSet.has(stripArabicAffixes(currentWord))) return currentWord;
                }

                const stem = stripArabicAffixes(currentWord);
                if (softWordsSet.has(stem)) {
                    const contextArea = shadowWords.slice(Math.max(0, i - 3), i);
                    if (contextTriggers.some(t => contextArea.join(" ").includes(t)) || (i > 0 && connectedTriggerPrefixes.some(p => shadowWords[i-1].startsWith(p))) || connectedTriggerPrefixes.some(p => currentWord.startsWith(p))) {
                        return softWordsSet.get(stem);
                    }
                }
            }
            if (engine === 'ar') return false; 
        }
    }
    const allBad = [...new Set([...blacklist.manual, ...blacklist.hard, ...blacklist.soft])];
    return multiLanguageDetect(text, allBad);
}

// ====== 4. FB RADAR ====== (باقي الكود كما هو بدون أي تغيير)
function isFBHomeFeed() {
    const path = window.location.pathname;
    return path === "/" || path === "/home.php" || window.location.search.includes("sk=");
}

function isIntruder(el) {
    if (!el || !settings.blockAds) return false;
    if (el.closest?.('[role="navigation"], [role="banner"], #header')) return false;
    if (el.tagName === "BODY" || el.id === "facebook" || el.id === "mount_0_0" || el.getAttribute?.('role') === 'complementary') return false;
    if (el.closest?.('[aria-label="جهات الاتصال"], [aria-label="Contacts"], [aria-label="Messenger"], [aria-label="الدردشة"]')) return false;
    const text = el.innerText || "";
    const label = (el.getAttribute?.('aria-label') || "").toLowerCase();
    const isInitialLoad = (Date.now() - pageStartTime) < 5000;
    if (label.includes('sponsored') || label.includes('ممول') || text.includes('مُموَّل') || text.includes('Sponsored') || label.includes('advertisement') || label.includes('إعلان')) {
        if (isInitialLoad && (el.offsetHeight > 500 || el.offsetWidth > 300)) { if (el.getAttribute?.('role') !== 'article' && el.tagName !== 'ARTICLE') return false; }
        return true;
    }
    const isArticle = el.getAttribute?.('role') === 'article' || el.tagName === 'ARTICLE';
    if (isArticle) {
        if (settings.customIntruderWords.length > 0 && settings.customIntruderWords.some(word => text.toLowerCase().includes(word.toLowerCase()))) return true;

        if (isFBHomeFeed()) {
            if (label.includes('suggested') || text.includes('Suggested for you') || text.includes('مُقترح لك')) return true;

            const headerText = text.substring(0, 450);
            const isFollowing = headerText.includes('Following') || headerText.includes('متابع.') || headerText.includes('متابع ') || headerText.includes('Joined') || headerText.includes('تم الانضمام');

            if (!isFollowing) {
                const buttons = el.querySelectorAll('button[role], [role="button"]');
                for (let i = 0; i < Math.min(buttons.length, 12); i++) {
                    const btn = buttons[i];
                    if (btn.closest('video, [data-video-id], [aria-label*="Video"], [aria-label*="فيديو"]')) continue;

                    const btnText = btn.textContent || "";
                    if (SUSPICIOUS_ACTIONS.some(a => btnText.includes(a))) {
                        const rect = btn.getBoundingClientRect();
                        const parentRect = el.getBoundingClientRect();
                        if (rect.top - parentRect.top < 250) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function handleAction(e, targetNode) {
    const interactiveEl = targetNode.closest?.('button, a, [role="button"]');
    if (targetNode.closest?.('[role="comment"], form')) setTimeout(runRefinery, 150);
    if (!settings.holdYourFinger) return;
    const isPublish = interactiveEl && ((interactiveEl.innerText || interactiveEl.getAttribute('aria-label') || "").toLowerCase().match(/نشر|post|send|إرسال/) || SEND_ICON_PATHS.some(p => interactiveEl.innerHTML.includes(p)));
    const isEnter = e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey && (targetNode.isContentEditable || targetNode.tagName === 'TEXTAREA');
    if (isPublish || isEnter) {
        const editors = document.querySelectorAll('[contenteditable="true"], textarea, input:not([type="hidden"])');
        for (let el of editors) {
            const detectedWord = isToxic(el.innerText || el.value || "");
            if (detectedWord) { e.preventDefault(); e.stopPropagation(); showWarning(detectedWord); el.focus(); return; }
        }
    }
}

document.addEventListener('click', (e) => handleAction(e, e.target), true);
document.addEventListener('keydown', (e) => handleAction(e, e.target), true);

function runRefinery() {
    const query = normalizeArabic(settings.searchQuery);
    const isSearching = query.length >= 2;
    const items = document.querySelectorAll('[role="comment"], .UFIComment, .x1yzt967, .xwib8y2');
    items.forEach(item => {
        if (item.querySelector('[contenteditable="true"]')) return;
        const textContent = item.textContent || "";
        if (isSearching) {
            const match = normalizeArabic(textContent).includes(query);
            item.style.display = match ? '' : 'none';
            if (match) item.classList.add('rg-match'); else item.classList.remove('rg-match');
        } else {
            item.classList.remove('rg-match');
            item.style.display = (settings.hideToxicComments && isToxic(textContent)) ? 'none' : '';
        }
    });
}

function processNode(item) {
    if (!item || item.nodeType !== 1 || processedElements.has(item) || item.id?.startsWith('rg-')) return;
    if (item.querySelectorAll?.('[role="article"]').length > 2) return;
    const isArticle = item.getAttribute?.('role') === 'article' || item.tagName === 'ARTICLE';
    const isAdCandidate = item.classList?.contains('x1n2onr6') || item.querySelector?.('a[attributionsrc]');
    let hiddenByMe = false;
    if (isArticle || isAdCandidate) {
        if (isIntruder(item)) { if (item.offsetHeight <= 5000) { item.style.setProperty('display', 'none', 'important'); if (isArticle) hiddenBatch.push(item); hiddenByMe = true; } }
    }
    if (!hiddenByMe && settings.blockReels && (item.querySelector?.('a[href*="/reels/"]') || item.innerHTML?.includes?.(REEL_ICON_PATH))) {
        if (isFBHomeFeed()) {
            const text = item.innerText || "";
            if (!text.includes('متابع.') && !text.includes('Following')) { item.style.setProperty('display', 'none', 'important'); hiddenBatch.push(item); hiddenByMe = true; }
        }
    }
    if (isArticle) { if (!hiddenByMe && hiddenBatch.length > 0) { injectToggle(item, [...hiddenBatch]); hiddenBatch = []; } processedElements.add(item); }
}

function processNewNodes(mutations) {
    let hasNew = false;
    for (let m of mutations) {
        for (let n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            hasNew = true; processNode(n);
            if (n.querySelectorAll) n.querySelectorAll('[role="article"], article, .x1n2onr6').forEach(processNode);
        }
    }
    if (hasNew && (settings.searchQuery.length >= 2 || settings.hideToxicComments)) { clearTimeout(debounceTimer); debounceTimer = setTimeout(runRefinery, 200); }
}

// ====== 5. UI (كما هو) ======
const style = document.createElement('style');
style.innerHTML = `
    .rg-match { background: rgba(46, 204, 113, 0.15) !important; border-left: 4px solid #2ecc71 !important; display: block !important; }
    #rg-floating-icon { position: fixed; top: 15px; left: 15px; z-index: 10000000; cursor: pointer; color: rgba(255, 255, 255, 0.5); font-weight: 900; font-size: 15px; transition: 0.3s; user-select: none; background: none; border: none; font-family: 'Arial Black', sans-serif; }
    #rg-dropdown-menu { position: fixed; top: 55px; left: 15px; z-index: 9999999; background: #121212; color: #e4e6eb; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); border: 1px solid #333; width: 260px; padding: 12px; display: none; flex-direction: column; gap: 10px; direction: ltr; text-align: left; font-family: 'Segoe UI', sans-serif; }
    .rg-header-bar { font-weight: 900; color: #1877F2; font-size: 14px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 5px; }
    .rg-tool-label { font-weight: 700; color: #2ecc71 !important; font-size: 11px; margin-bottom: 2px; }
    .rg-lbl { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; cursor: pointer; color: #ccc; padding: 4px 0; }
    .rg-btn-edit { color: #1877F2; font-size: 10px; cursor: pointer; text-decoration: underline; background:none; border:none; padding:0; text-align:left; }
    .rg-drawer { display: none; background: #1c1c1c; padding: 8px; border-radius: 8px; border: 1px solid #444; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
    input.rg-input { background: #000; color: #fff; border: 1px solid #444; padding: 8px; border-radius: 20px; width: 100%; font-size: 11px; outline: none; box-sizing: border-box; }
    .rg-tag { background: #333; color: #eee; padding: 2px 6px; border-radius: 4px; font-size: 9px; display: flex; align-items: center; gap: 4px; }
    .rg-tag-x { color: #e74c3c; cursor: pointer; font-weight: bold; }
    .rg-batch-wrapper { position: relative; width: 100%; clear: both; }
    .rg-hidden-toggle { background: rgba(0, 0, 0, 0.05); border: 1px dashed #ccc; color: #666; padding: 8px; margin: 10px 0; border-radius: 8px; text-align: center; font-size: 12px; cursor: pointer; transition: 0.2s; user-select: none; }
    .rg-hidden-toggle:hover { background: rgba(24, 119, 242, 0.05); border-color: #1877F2; color: #1877F2; }
    .rg-hidden-toggle.rg-sticky { position: sticky; top: 60px; z-index: 999; background: #fff; border: 1px solid #1877F2; box-shadow: 0 4px 12px rgba(0,0,0,0.1); color: #1877F2; }
    .rg-hidden-toggle span { font-weight: bold; text-decoration: underline; margin-left: 10px; }
`;
(document.head || document.documentElement).appendChild(style);

function showWarning(word) {
    const old = document.getElementById("rg-modal"); if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "rg-modal";
    modal.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:15px 25px;border-radius:10px;border-left:8px solid #e74c3c;z-index:1000000;text-align:center;font-family:sans-serif;box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #333;";
    modal.innerHTML = `⚠️ <b>FB-Refiner Protection</b><br>Toxic word detected: <span style="color:#e74c3c; font-weight:bold; border:1px solid #e74c3c; padding:2px 6px; border-radius:4px; margin: 0 5px; display: inline-block;">${word}</span><br><small style="color:#999;">Please review your content before posting.</small>`;
    document.body.appendChild(modal);
    setTimeout(() => { if (modal && modal.parentNode) modal.remove(); }, 6000);
}

function renderTags() {
    const list = document.getElementById("rg-tag-list"); if (!list) return;
    list.innerHTML = "";
    settings.customIntruderWords.forEach((word, idx) => {
        const tag = document.createElement("div"); tag.className = "rg-tag"; tag.textContent = word;
        const del = document.createElement("span"); del.className = "rg-tag-x"; del.innerHTML = "×";
        del.onclick = () => { settings.customIntruderWords.splice(idx, 1); try { chrome.storage.local.set({rgSettings: settings}, () => { renderTags(); compileRegex(); }); } catch (error) { console.warn('Extension context invalidated, word not deleted'); } };
        tag.appendChild(del); list.appendChild(tag);
    });
}

function renderCustomHardSoftTags() {
    const hard = document.getElementById("rg-hard-list");
    const soft = document.getElementById("rg-soft-list");
    if (hard) {
        hard.innerHTML = "";
        if (!settings.customHardWords || settings.customHardWords.length === 0) {
            hard.innerHTML = '<small style="color:#999;">No hard words added from right-click</small>';
        } else {
            settings.customHardWords.forEach((word, idx) => {
                const tag = document.createElement("div"); tag.className = "rg-tag"; tag.textContent = word;
                const del = document.createElement("span"); del.className = "rg-tag-x"; del.innerHTML = "×";
                del.onclick = () => deleteCustomBlacklistWord(word, 'hard');
                tag.appendChild(del); hard.appendChild(tag);
            });
        }
    }
    if (soft) {
        soft.innerHTML = "";
        if (!settings.customSoftWords || settings.customSoftWords.length === 0) {
            soft.innerHTML = '<small style="color:#999;">No soft words added from right-click</small>';
        } else {
            settings.customSoftWords.forEach((word, idx) => {
                const tag = document.createElement("div"); tag.className = "rg-tag"; tag.textContent = word;
                const del = document.createElement("span"); del.className = "rg-tag-x"; del.innerHTML = "×";
                del.onclick = () => deleteCustomBlacklistWord(word, 'soft');
                tag.appendChild(del); soft.appendChild(tag);
            });
        }
    }
}

function deleteCustomBlacklistWord(word, listType) {
    console.log('Deleting word:', word, 'from', listType);
    try {
        chrome.storage.local.get(['rg_blacklist'], (res) => {
            const blacklistData = res.rg_blacklist || { manual: [], files: [] };
            const customFile = (blacklistData.files || []).find(f => f.name === 'Context Menu');
            if (!customFile || !customFile[listType]) return;
            const index = customFile[listType].indexOf(word);
            if (index === -1) return;
            customFile[listType].splice(index, 1);
            chrome.storage.local.set({ rg_blacklist: blacklistData }, () => {
                if (listType === 'hard') settings.customHardWords = customFile[listType];
                else settings.customSoftWords = customFile[listType];
                renderCustomHardSoftTags();
                compileRegex();
            });
        });
    } catch (error) {
        console.warn('Extension context invalidated, skipping delete operation');
    }
}

function createFacebookUI() {
    if (document.getElementById("rg-floating-icon") || !document.body) return;
    const icon = document.createElement("div"); icon.id = "rg-floating-icon"; icon.innerHTML = "FB";
    const menu = document.createElement("div"); menu.id = "rg-dropdown-menu";
    menu.innerHTML = `
        <div class="rg-header-bar">🛡️ FB-Refiner FB Pro</div>
        <div class="rg-tool-item"><div class="rg-tool-label">🔍 FB Comments Filter Tool</div><input id="rg-search-input" class="rg-input" placeholder="Search comments..."></div>
        <div style="border-top:1px solid #333; padding-top:8px; display: flex; flex-direction: column; gap: 6px;">
            <div class="rg-tool-item"><div class="rg-tool-label">☝️ Hold Your Finger</div><label class="rg-lbl">Stop toxic posts <input type="checkbox" id="rg-opt-hyf" ${settings.holdYourFinger?'checked':''}></label></div>
            <div class="rg-tool-item"><div class="rg-tool-label">⏳ Clean Feed Tool</div><label class="rg-lbl">Ads & Suggested <input type="checkbox" id="rg-opt-ads" ${settings.blockAds?'checked':''}></label><button id="rg-btn-edit" class="rg-btn-edit">Edit Custom Keywords</button><div id="rg-drawer" class="rg-drawer"><input type="text" id="rg-add-word" class="rg-input" placeholder="New word + Enter..."><div id="rg-tag-list" class="rg-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;"></div></div></div>
            <div class="rg-tool-item"><div class="rg-tool-label">🎬 Media Blocker Tool</div><label class="rg-lbl">Block Reels <input type="checkbox" id="rg-opt-rel" ${settings.blockReels?'checked':''}></label></div>
            <div class="rg-tool-item">
                <div class="rg-tool-label">☣️ Toxic Comments Tool</div>
                <label class="rg-lbl">Filter Swears <input type="checkbox" id="rg-opt-tox" ${settings.hideToxicComments?'checked':''}></label>
                <button id="rg-btn-context-menu" class="rg-btn-edit">Edit Custom Toxic Words</button>
                <div id="rg-context-menu-drawer" class="rg-drawer">
                    <div style="font-size:11px;color:#999;">Words added from right-click context menu</div>
                    <div style="margin-top:6px; font-size:11px; color:#aaa;">Hard list</div>
                    <div id="rg-hard-list" class="rg-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;"></div>
                    <div style="margin-top:6px; font-size:11px; color:#aaa;">Soft list</div>
                    <div id="rg-soft-list" class="rg-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(icon); document.body.appendChild(menu); renderTags(); renderCustomHardSoftTags();
    icon.onclick = (e) => { e.stopPropagation(); menu.style.display = menu.style.display==='flex'?'none':'flex'; };
    document.getElementById("rg-btn-edit").onclick = (e) => { e.stopPropagation(); const d = document.getElementById("rg-drawer"); d.style.display = d.style.display==='flex'?'none':'flex'; };
    document.getElementById("rg-btn-context-menu").onclick = (e) => { e.stopPropagation(); const d = document.getElementById("rg-context-menu-drawer"); d.style.display = d.style.display==='flex'?'none':'flex'; };
    const setup = (id, key) => { 
        const el = document.getElementById(id); if(!el) return;
        el.onchange = (e) => { 
            settings[key] = e.target.checked; 
            try { chrome.storage.local.set({rgSettings: settings}); } catch (error) {}
            if(key==='hideToxicComments') runRefinery(); 
        }; 
    };
    setup("rg-opt-hyf", "holdYourFinger"); setup("rg-opt-ads", "blockAds"); setup("rg-opt-rel", "blockReels"); setup("rg-opt-tox", "hideToxicComments");
    document.getElementById("rg-add-word").onkeydown = (e) => { if (e.key === 'Enter' && e.target.value.trim()) { settings.customIntruderWords.push(e.target.value.trim()); try { chrome.storage.local.set({rgSettings: settings}, () => { renderTags(); compileRegex(); }); } catch (error) {} e.target.value = ''; } };
    document.getElementById("rg-search-input").oninput = (e) => { settings.searchQuery = e.target.value; runRefinery(); };
}

function syncSettings(callback) {
    try {
        chrome.storage.local.get(['rgSettings', 'rg_blacklist'], (res) => {
            if (res.rgSettings) settings = { ...settings, ...res.rgSettings };
            if (res.rg_blacklist) {
                const bl = res.rg_blacklist;
                blacklist.manual = bl.manual || DEFAULT_BLACKLIST;
                blacklist.hard = []; blacklist.soft = [];
                const customFile = (bl.files || []).find(f => f.name === 'Context Menu' || f.name === 'Context Menu Additions');
                (bl.files || []).forEach(f => { if (f.hard) blacklist.hard.push(...f.hard); if (f.soft) blacklist.soft.push(...f.soft); });
                settings.customHardWords = customFile?.hard || [];
                settings.customSoftWords = customFile?.soft || [];
            }
            compileRegex();
            if (callback) callback();
        });
    } catch (error) {
        console.warn('Extension context invalidated, using default settings');
        compileRegex();
        if (callback) callback();
    }
}

function safeInit() {
    if (!document.body) { setTimeout(safeInit, 100); return; }
    syncSettings(() => { 
        createFacebookUI(); 
        new MutationObserver(processNewNodes).observe(document.body, { childList: true, subtree: true }); 
        document.querySelectorAll('[role="article"], article, .x1n2onr6').forEach(processNode); 
    });
}

safeInit();

try {
    chrome.storage.onChanged.addListener(() => syncSettings(() => { renderTags(); renderCustomHardSoftTags(); }));
} catch (error) {
    console.warn('Extension context invalidated, storage listener not set');
}
try {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'refresh') {
            syncSettings(() => { renderTags(); renderCustomHardSoftTags(); });
        } else if (msg.action === 'updateWords' && msg.listName === 'customIntruderWords') {
            settings.customIntruderWords = msg.words || [];
            renderTags();
            try { chrome.storage.local.set({ rgSettings: settings }); } catch (error) {}
        }
    });
} catch (error) {
    console.warn('Extension context invalidated, message listener not set');
}
