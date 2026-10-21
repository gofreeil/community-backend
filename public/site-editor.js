/*!
 * site-editor.js — עורך כיתובים בתוך האתר (סופר-אדמין), סקריפט אחד לכל אתרי הרשת.
 *
 * הטמעה באתר: שורה אחת ב-src/app.html (לפני </body>), עם מזהה האתר:
 *   <script defer src="https://api.gofreeil.com/site-editor.js" data-site="singles"></script>
 * בלי תלות בפריימוורק, בלי קוד בצד השרת של האתר, ושדרוג כאן משדרג את כולם.
 *
 * מה הוא עושה:
 *  1. טוען את הכיתובים שנערכו (GET /api/site-edit/texts) ומחליף בדפדפן כל text-node שתוכנו (אחרי trim)
 *     זהה בדיוק לטקסט המקורי - רווחים מסביב נשמרים. MutationObserver מחיל גם על תוכן שנוסף אחר כך
 *     (ניווט בין דפים, רינדור מחדש). הכיתובים תמיד נכנסים כ-textContent, לעולם לא כ-HTML.
 *  2. לסופר-אדמין בלבד (GET /api/site-edit/me, לפי העוגייה המשותפת gofreeil-auth) מציג גלגל ⚙️:
 *     קוד Google Authenticator (פעם אחת ל-12 שעות לכל האתרים), ואז לוחצים על כל כיתוב ועורכים אותו.
 *     השמירה (POST /api/site-edit/save) לפי הטקסט המקורי - בלי דיפלוי.
 *
 * נערך: כל טקסט גלוי - גם בתוך כפתורים וקישורים, גם מספרים (מחיר, כמות), גם placeholder של תיבות
 * (לחיצה על התיבה), וגם תוכן שנטען אחרי הכניסה למצב עריכה. כיתוב עם אותיות נשמר לכל האתר;
 * מספר בלבד נשמר לדף הנוכחי בלבד (מפתח "@<נתיב>|<מספר>"), כדי ש-"5000" בטבלה אחת לא ישנה כל "5000".
 *
 * אזור שלא עורכים ולא מחליפים בו (תוכן משתמשים: כרטיסים, פרסומות, שמות): data-no-edit.
 * ריקון כיתוב מוחק אותו מהאתר (דריסה ריקה); במצב עריכה הוא מוצג מעומעם, והקלדת הנוסח המקורי מחזירה אותו.
 */
(function () {
  'use strict';
  if (window.__gfSiteEditor) return;
  window.__gfSiteEditor = true;

  var script = document.currentScript || document.querySelector('script[src*="site-editor.js"]');
  if (!script || !script.src) return;
  var API = new URL(script.src).origin;
  var SITE = String(script.getAttribute('data-site') || location.hostname.split('.')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  if (!SITE) return;

  // ---------------------------------------------------------------- אחסון קל בדפדפן
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* פרטי / חסום */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* פרטי / חסום */ } }

  var TEXTS_KEY = 'gf-se-texts:' + SITE;
  var BUST_KEY = 'gf-se-bust:' + SITE;
  var ME_KEY = 'gf-se-me';
  var ME_TTL_MS = 10 * 60 * 1000;

  // ---------------------------------------------------------------- החלפת טקסטים
  var SKIP = 'script,style,noscript,textarea,input,select,option,svg,[data-no-edit],[data-se-ui],[data-se-key]';
  var PH = 'input[placeholder],textarea[placeholder]';
  var HAS_LETTER = /\p{L}/u;
  var HAS_TEXT = /[\p{L}\p{N}]/u;

  /** המפתח של דריסה: כיתוב עם אותיות - לכל האתר; מספר בלבד - לדף הנוכחי בלבד */
  function keyFor(orig) {
    return HAS_LETTER.test(orig) ? orig : '@' + location.pathname + '|' + orig;
  }

  var overrides = new Map();
  var paused = false;
  var touched = false; // נכתבה לפחות דריסה אחת - נשמור עקביות גם אם המפה התרוקנה
  var scheduled = false;
  var pending = new Set();
  var originals = new WeakMap(); // text-node / תיבה -> הטקסט המקורי (אחרי trim) כשהחלפנו אותו
  var applied = new WeakMap();   // text-node / תיבה -> הערך המלא שכתבנו (לזיהוי שהוא עדיין שלנו)

  function split(raw) {
    var t = raw.trim();
    var i = raw.indexOf(t);
    return { t: t, lead: raw.slice(0, i), trail: raw.slice(i + t.length) };
  }

  function applyNode(node) {
    var raw = node.nodeValue || '';
    var t = raw.trim();
    var prev = originals.get(node);
    var mine = prev !== undefined && applied.get(node) === raw;
    if (!t && !mine) return; // ריק - אלא אם זה כיתוב שאנחנו מחקנו (דריסה ריקה), שאולי צריך להחזיר
    if (!mine) { originals.delete(node); applied.delete(node); }
    var orig = mine ? prev : t;
    var next = overrides.get(keyFor(orig));

    if (next === undefined || next === orig) {
      if (mine) { // הדריסה בוטלה - חוזרים לטקסט שבקוד
        var s = split(raw);
        node.nodeValue = s.lead + orig + s.trail;
        originals.delete(node);
        applied.delete(node);
      }
      return;
    }
    if (mine && next === t) return;
    var p = split(raw);
    var value = p.lead + next + p.trail;
    node.nodeValue = value;
    originals.set(node, orig);
    applied.set(node, value);
    touched = true;
  }

  /** placeholder של תיבה - אותו מנגנון כמו text-node, על המאפיין */
  function applyPlaceholder(box) {
    var cur = box.getAttribute('placeholder') || '';
    var prev = originals.get(box);
    var mine = prev !== undefined && applied.get(box) === cur;
    if (!mine) { originals.delete(box); applied.delete(box); }
    var orig = mine ? prev : cur.trim();
    if (!orig) return;
    var next = overrides.get(keyFor(orig));
    if (next === undefined || next === orig) {
      if (mine) {
        box.setAttribute('placeholder', orig);
        originals.delete(box);
        applied.delete(box);
      }
      return;
    }
    if (mine && next === cur) return;
    box.setAttribute('placeholder', next);
    originals.set(box, orig);
    applied.set(box, next);
    touched = true;
  }

  function originalPlaceholderOf(box) {
    var cur = box.getAttribute('placeholder') || '';
    var prev = originals.get(box);
    return prev !== undefined && applied.get(box) === cur ? prev : cur.trim();
  }

  function applyTree(root) {
    if (root.nodeType === 3) {
      if (!(root.parentElement && root.parentElement.closest(SKIP))) applyNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (root.matches(PH)) {
      if (!root.closest('[data-no-edit],[data-se-ui]')) applyPlaceholder(root);
      return;
    }
    if (root.closest(SKIP)) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (n.matches(PH)) { applyPlaceholder(n); return NodeFilter.FILTER_REJECT; }
          return n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = walker.nextNode())) applyNode(n);
  }

  function flush() {
    scheduled = false;
    if (paused || (overrides.size === 0 && !touched)) { pending.clear(); return; }
    var nodes = Array.from(pending);
    pending.clear();
    nodes.forEach(function (n) { if (n.isConnected) applyTree(n); });
  }

  // setTimeout ולא requestAnimationFrame: בלשונית ברקע rAF לא רץ
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, 16);
  }

  function setTexts(texts) {
    overrides = new Map(Object.entries(texts || {}));
    pending.add(document.body);
    schedule();
  }

  /** הטקסט המקורי (מהקוד) של text-node שאולי הוחלף - המפתח שבו הדריסה נשמרת */
  function originalTextOf(node) {
    var raw = node.nodeValue || '';
    var prev = originals.get(node);
    return prev !== undefined && applied.get(node) === raw ? prev : raw.trim();
  }

  function startObserver() {
    new MutationObserver(function (records) {
      // במצב עריכה: תוכן שנטען עכשיו (רשימה שהגיעה מהשרת, גלילה) נעשה גם הוא ניתן לעריכה
      if (state.mode === 'edit') { wrapAdded(records); return; }
      // בלי דריסות (המצב הרגיל ברוב האתרים) - אפס עבודה על כל שינוי DOM
      if (paused || (overrides.size === 0 && !touched)) return;
      records.forEach(function (r) {
        if (r.type === 'childList') r.addedNodes.forEach(function (n) { pending.add(n); });
        else pending.add(r.target); // characterData / placeholder
      });
      if (pending.size) schedule();
    }).observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder'],
    });
  }

  // מספרים נשמרים לפי דף - במעבר דף בלי טעינה (SPA) מחילים מחדש על מה שנשאר על המסך
  var lastPath = location.pathname;
  function onUrlChange() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    pending.add(document.body);
    schedule();
  }

  function watchUrl() {
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      if (typeof orig !== 'function') return;
      history[m] = function () {
        var r = orig.apply(this, arguments);
        try { onUrlChange(); } catch (e) { /* לא מפילים את הניווט של האתר */ }
        return r;
      };
    });
    window.addEventListener('popstate', onUrlChange);
  }

  function loadTexts() {
    // החלה מיידית מהמטמון המקומי (בלי הבהוב בביקור חוזר), ואז רענון מהשרת
    var cached = lsGet(TEXTS_KEY);
    if (cached) { try { setTexts(JSON.parse(cached)); } catch (e) { /* מטמון פגום */ } }
    var bust = lsGet(BUST_KEY);
    var url = API + '/api/site-edit/texts?site=' + encodeURIComponent(SITE) + (bust ? '&b=' + encodeURIComponent(bust) : '');
    return fetch(url, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) {
        if (!body || !body.texts) return;
        lsSet(TEXTS_KEY, JSON.stringify(body.texts));
        setTexts(body.texts);
      })
      .catch(function () { /* אין רשת - האתר מציג את הטקסט שבקוד */ });
  }

  // ---------------------------------------------------------------- זיהוי סופר-אדמין
  function checkMe() {
    var cached = ssGet(ME_KEY);
    if (cached) {
      try {
        var c = JSON.parse(cached);
        if (Date.now() - c.at < ME_TTL_MS) return Promise.resolve(c.me);
      } catch (e) { /* מטמון פגום */ }
    }
    return fetch(API + '/api/site-edit/me', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (me) ssSet(ME_KEY, JSON.stringify({ at: Date.now(), me: me }));
        return me;
      })
      .catch(function () { return null; });
  }

  // ---------------------------------------------------------------- ממשק העריכה
  var CSS_GLOBAL =
    '[data-se-key]{pointer-events:auto;outline:1px dashed rgba(245,158,11,.65);outline-offset:2px;border-radius:2px;cursor:text;min-width:1ch;' +
    '-webkit-user-select:text;user-select:text}' +
    '[data-se-key]:hover{outline-color:#f59e0b;background:rgba(245,158,11,.12)}' +
    '[data-se-key]:focus{outline:2px solid #3b82f6;background:rgba(59,130,246,.12)}' +
    '[data-se-deleted]:empty::before{content:attr(data-se-deleted);opacity:.45;text-decoration:line-through}' +
    '[data-se-ph]{outline:1px dashed rgba(245,158,11,.65)!important;outline-offset:2px;cursor:pointer!important}' +
    '[data-se-ph]:hover{outline-color:#f59e0b!important}';

  var CSS_UI =
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}' +
    '.gear{position:fixed;bottom:1rem;left:1rem;z-index:2147483000;width:2.75rem;height:2.75rem;border-radius:999px;' +
    'border:1px solid rgba(255,255,255,.25);background:rgba(15,23,42,.88);font-size:1.35rem;line-height:1;cursor:pointer;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.4);opacity:.7;transition:opacity .2s,transform .3s}' +
    '.gear:hover{opacity:1;transform:rotate(60deg)}' +
    '.panel{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);z-index:2147483001;display:flex;flex-wrap:wrap;' +
    'align-items:center;justify-content:center;gap:.6rem;max-width:calc(100vw - 2rem);padding:.55rem 1rem;border-radius:1.25rem;' +
    'border:1px solid rgba(245,158,11,.5);background:rgba(15,23,42,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);color:#e2e8f0;direction:rtl}' +
    'form{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.6rem;margin:0}' +
    '.label{font-size:.8rem;font-weight:700;white-space:nowrap}' +
    '.hint{font-size:.7rem;color:#94a3b8}' +
    '.code{width:6.5rem;direction:ltr;text-align:center;letter-spacing:.3em;font-size:1.05rem;font-weight:800;border-radius:.6rem;' +
    'border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;padding:.3rem .4rem}' +
    'button.b{border-radius:999px;padding:.35rem 1rem;font-size:.85rem;font-weight:800;cursor:pointer}' +
    'button.primary{border:none;background:#22c55e;color:#052e16}' +
    'button.ghost{border:1px solid rgba(255,255,255,.3);background:transparent;color:#e2e8f0}' +
    'button.b:disabled{opacity:.55;cursor:default}' +
    '.err{font-size:.75rem;font-weight:700;color:#fca5a5}' +
    '.ok{font-size:.85rem;font-weight:800;color:#86efac}';

  var state = {
    ready: false,       // סופר-אדמין זוהה - הגלגל מוצג
    configured: true,   // האם הוגדר סוד Authenticator בשרת
    verified: false,    // עוגיית העריכה תקפה
    mode: 'idle',       // idle | ask | edit
    busy: false,
    error: '',
    saved: false,
    changed: 0,
    code: '',
  };

  var host = null;
  var shadow = null;
  var wrapped = new Map(); // span -> { key, orig, shown, raw, node, extras }
  var boxes = new Map();   // תיבה עם placeholder -> { key, orig, shown }
  var globalStyle = null;

  function el(tag, props, children) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'class') e.className = props[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else if (props[k] === true) e.setAttribute(k, '');
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function ensureHost() {
    if (host) return;
    host = el('div', { 'data-se-ui': true });
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(el('style', {}, [CSS_UI]));
  }

  function render() {
    if (!state.ready) return;
    ensureHost();
    Array.from(shadow.childNodes).forEach(function (n) { if (n.tagName !== 'STYLE') shadow.removeChild(n); });

    if (state.mode === 'idle') {
      shadow.appendChild(el('button', { class: 'gear', title: 'עריכת כיתובי האתר', 'aria-label': 'עריכת כיתובי האתר', onclick: onGear }, ['⚙️']));
      if (state.saved) shadow.appendChild(el('div', { class: 'panel' }, [el('span', { class: 'ok' }, ['✅ נשמר ומעודכן באתר'])]));
      return;
    }

    if (state.mode === 'ask') {
      var input = el('input', {
        class: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000',
        oninput: function (e) { state.code = e.target.value; ok.disabled = state.busy || state.code.replace(/\D/g, '').length !== 6; },
      });
      input.value = state.code;
      var ok = el('button', { class: 'b primary', type: 'submit' }, [state.busy ? '…' : 'אישור']);
      ok.disabled = state.busy || state.code.replace(/\D/g, '').length !== 6;
      var form = el('form', { onsubmit: function (e) { e.preventDefault(); submitCode(); } }, [
        el('span', { class: 'label' }, ['🔐 קוד מ-Google Authenticator']),
        input,
        ok,
        // באמצע עריכה (תוקף האימות פג) - חוזרים למצב העריכה ולא מאבדים את השינויים
        el('button', { class: 'b ghost', type: 'button', onclick: function () { state.mode = editing ? 'edit' : 'idle'; state.error = ''; render(); } }, ['ביטול']),
      ]);
      var panel = el('div', { class: 'panel' }, [form]);
      if (state.error) panel.appendChild(el('span', { class: 'err' }, [state.error]));
      shadow.appendChild(panel);
      setTimeout(function () { input.focus(); }, 0);
      return;
    }

    // edit
    var p = el('div', { class: 'panel' }, [
      el('span', { class: 'label' }, ['⚙️ לחצו על כיתוב וערכו אותו' + (state.changed ? ' · ' + state.changed + ' שונו' : '')]),
      el('span', { class: 'hint' }, ['ריקון כיתוב מוחק אותו מהאתר']),
    ]);
    if (state.error) p.appendChild(el('span', { class: 'err', title: state.error }, [state.error]));
    var cancel = el('button', { class: 'b ghost', type: 'button', onclick: function () { cancelEdit(); } }, ['ביטול']);
    var save = el('button', { class: 'b primary', type: 'button', onclick: function () { saveAll(); } }, [state.busy ? 'שומר…' : 'שמירה']);
    cancel.disabled = state.busy;
    save.disabled = state.busy || state.changed === 0;
    p.appendChild(cancel);
    p.appendChild(save);
    shadow.appendChild(p);
  }

  // ----- מצב עריכה: עטיפת כל text-node גלוי ב-span contenteditable
  // גם בתוך כפתורים וקישורים - הלחיצה עליהם חסומה במצב עריכה (blockClicks)
  var NO_WRAP = SKIP + ',[contenteditable]';
  var editing = false; // נשאר true גם כשבאמצע עריכה מבקשים קוד מחדש (mode=ask)

  /** textContent ולא innerText: innerText מושפע מ-CSS (text-transform, קריסת רווחים) ולכן כיתוב שלא נגעו בו נראה "ששונה" */
  function currentValue(span) {
    return (span.querySelector('br,div,p') ? span.innerText : (span.textContent || '')).trim();
  }

  function boxValue(box) {
    return (box.getAttribute('placeholder') || '').trim();
  }

  function countChanges() {
    var keys = new Set(); // לפי מפתח ולא לפי הופעה - כיתוב שחוזר בכמה מקומות הוא שינוי אחד
    wrapped.forEach(function (w, span) { if (currentValue(span) !== w.shown) keys.add(w.key); });
    boxes.forEach(function (b, box) { if (boxValue(box) !== b.shown) keys.add(b.key); });
    state.changed = keys.size;
    render();
  }

  function onPaste(e) {
    e.preventDefault(); // הדבקה כטקסט נקי בלבד
    document.execCommand('insertText', false, (e.clipboardData && e.clipboardData.getData('text/plain')) || '');
  }

  /** placeholder נערך בחלון קטן - אין לו text-node שאפשר להקליד בתוכו */
  function editBox(box) {
    var b = boxes.get(box);
    if (!b) return;
    var v = prompt('הטקסט שמופיע בתוך התיבה (ריק = חזרה לנוסח המקורי):', boxValue(box));
    if (v === null) return;
    v = v.trim();
    box.setAttribute('placeholder', v || b.orig);
    // אותו placeholder בשאר הדף מתעדכן יחד
    boxes.forEach(function (o, other) { if (other !== box && o.key === b.key) other.setAttribute('placeholder', v || b.orig); });
    countChanges();
  }

  function blockClicks(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    if (target.closest('[data-se-ui]')) return;
    var box = target.closest('[data-se-ph]');
    if (box) {
      e.preventDefault();
      e.stopPropagation();
      editBox(box);
      return;
    }
    if (!target.closest('input,textarea,select') && target.closest('a,button,label,summary,[role="button"],form')) {
      e.preventDefault(); // במצב עריכה אין ניווט ואין הפעלת כפתורים - גם לא מטפלי הלחיצה של האתר
      e.stopPropagation();
    }
    if (target.closest('[data-se-key]')) return;
    // כרטיסים שמכוסים בקישור שקוף "בולעים" את הלחיצה - מחפשים את הכיתוב שמתחת לסמן
    var hit = document.elementsFromPoint(e.clientX, e.clientY).find(function (x) { return x.matches('[data-se-key]'); });
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    hit.focus();
    var sel = window.getSelection();
    var range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
    else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
    }
    if (range && hit.contains(range.startContainer)) { sel.removeAllRanges(); sel.addRange(range); }
  }

  function onKey(e) {
    if (e.key === 'Escape' && state.mode === 'edit' && !state.busy) cancelEdit();
  }

  function onBeforeUnload(e) {
    if (editing && state.changed > 0) { e.preventDefault(); e.returnValue = ''; }
  }

  function onPopState() {
    if (editing) exitEdit();
  }

  /** טקסט עם אות או ספרה (לא סימנים/אימוג'י בלבד), מחוץ לאזורים שאסור לערוך.
   * כיתוב שנמחק (דריסה ריקה) נעטף ריק, עם המקור מעומעם - כדי שאפשר יהיה להחזיר אותו */
  function wrappable(node) {
    var parent = node.parentElement;
    var text = (node.nodeValue || '').trim();
    if (!parent || parent.closest(NO_WRAP)) return false;
    return text ? HAS_TEXT.test(text) : !!originalTextOf(node);
  }

  function collect(root, texts, inputs) {
    if (root.nodeType === 3) {
      if (wrappable(root)) texts.push(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (root.matches(PH)) inputs.push(root);
    else root.querySelectorAll(PH).forEach(function (x) { inputs.push(x); });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) if (wrappable(n)) texts.push(n);
  }

  function wrapNode(node) {
    if (!node.parentNode || !wrappable(node)) return; // כבר נעטף / הוסר בינתיים
    var raw = node.nodeValue || '';
    var shown = raw.trim();
    var at = raw.indexOf(shown);
    var lead = raw.slice(0, at);
    var trail = raw.slice(at + shown.length);
    var orig = originalTextOf(node);
    var key = keyFor(orig);

    var span = document.createElement('span');
    span.setAttribute('data-se-key', key);
    span.setAttribute('contenteditable', 'true');
    span.setAttribute('spellcheck', 'false');
    span.textContent = shown;
    if (!shown) span.setAttribute('data-se-deleted', orig);

    var extras = [];
    var parts = [];
    if (lead) { var a = document.createTextNode(lead); extras.push(a); parts.push(a); }
    parts.push(span);
    if (trail) { var b = document.createTextNode(trail); extras.push(b); parts.push(b); }
    node.replaceWith.apply(node, parts);

    span.addEventListener('paste', onPaste);
    span.addEventListener('input', function () {
      // אותו כיתוב בשאר הדף מתעדכן יחד, כדי שלא ייראה כאילו רק הופעה אחת השתנתה
      var v = currentValue(span);
      wrapped.forEach(function (w, other) { if (other !== span && w.key === key) other.textContent = v; });
      countChanges();
    });
    wrapped.set(span, { key: key, orig: orig, shown: shown, raw: raw, node: node, extras: extras });
  }

  function markBox(box) {
    if (boxes.has(box) || box.closest('[data-no-edit],[data-se-ui]')) return;
    var shown = boxValue(box);
    if (!shown) return;
    var orig = originalPlaceholderOf(box);
    box.setAttribute('data-se-ph', '');
    boxes.set(box, { key: keyFor(orig), orig: orig, shown: shown });
  }

  function wrapAdded(records) {
    var texts = [];
    var inputs = [];
    records.forEach(function (r) {
      if (r.type !== 'childList') return;
      r.addedNodes.forEach(function (n) { if (n.isConnected) collect(n, texts, inputs); });
    });
    texts.forEach(wrapNode);
    inputs.forEach(markBox);
  }

  function enterEdit() {
    paused = true;
    globalStyle = el('style', {}, [CSS_GLOBAL]);
    document.head.appendChild(globalStyle);

    wrapped = new Map();
    boxes = new Map();
    var texts = [];
    var inputs = [];
    collect(document.body, texts, inputs);
    texts.forEach(wrapNode);
    inputs.forEach(markBox);

    document.addEventListener('click', blockClicks, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    editing = true;
    state.changed = 0;
    state.error = '';
    state.saved = false;
    state.mode = 'edit';
    render();
  }

  function exitEdit() {
    // מחזירים את ה-text-nodes המקוריים של האתר, כדי שהוא ימשיך להתעדכן כרגיל
    wrapped.forEach(function (w, span) {
      w.node.nodeValue = w.raw;
      span.replaceWith(w.node);
      w.extras.forEach(function (t) { t.remove(); });
    });
    wrapped = new Map();
    boxes.forEach(function (b, box) {
      box.setAttribute('placeholder', b.shown);
      box.removeAttribute('data-se-ph');
    });
    boxes = new Map();
    document.removeEventListener('click', blockClicks, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('popstate', onPopState);
    if (globalStyle) { globalStyle.remove(); globalStyle = null; }
    editing = false;
    state.mode = 'idle';
    state.changed = 0;
    paused = false;
    pending.add(document.body);
    schedule();
    render();
  }

  function cancelEdit() {
    if (state.changed > 0 && !confirm('יש שינויים שלא נשמרו. לצאת בלי לשמור?')) return;
    exitEdit();
  }

  // ----- שרת
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'gf-site-edit' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    });
  }

  function onGear() {
    state.error = '';
    if (!state.configured) {
      state.error = 'אימות דו-שלבי לא הוגדר בשרת (SUPER_ADMIN_TOTP_SECRET)';
      alert(state.error);
      return;
    }
    if (state.verified) { enterEdit(); return; }
    // אולי הקוד כבר הוזן באתר אחר של הרשת (העוגייה משותפת) - בודקים טרי, בלי המטמון
    ssSet(ME_KEY, '');
    checkMe().then(function (me) {
      state.verified = !!(me && me.verified);
      if (state.verified) enterEdit();
      else { state.mode = 'ask'; render(); }
    });
  }

  function verifyCode() {
    if (state.busy) return Promise.resolve();
    state.busy = true;
    state.error = '';
    render();
    return post('/api/site-edit/verify', { code: state.code }).then(function (r) {
      if (!r.res.ok) throw new Error((r.data && r.data.error) || 'האימות נכשל');
      state.verified = true;
      state.code = '';
      ssSet(ME_KEY, ''); // לרענן את מצב האימות בטעינה הבאה
    }).catch(function (e) {
      state.error = (e && e.message) || 'האימות נכשל';
    }).then(function () {
      state.busy = false;
    });
  }

  /** קוד מהגלגל: אימות ואז מצב עריכה. באמצע עריכה (תוקף פג): אימות ואז שמירה. */
  function submitCode() {
    var wasEditing = editing;
    verifyCode().then(function () {
      if (!state.verified) { render(); return; }
      if (wasEditing) { state.mode = 'edit'; render(); saveAll(); }
      else enterEdit();
    });
  }

  function saveAll() {
    if (state.busy) return;
    // חזרה לנוסח שבקוד נשלחת כ-null - הדריסה נמחקת (גם כשהמפתח הוא מפתח-דף של מספר);
    // ריק = הכיתוב נמחק מהאתר
    var texts = {};
    wrapped.forEach(function (w, span) {
      var value = currentValue(span);
      if (value !== w.shown) texts[w.key] = value === w.orig ? null : value;
    });
    boxes.forEach(function (b, box) {
      var value = boxValue(box);
      if (value !== b.shown) texts[b.key] = value === b.orig ? null : value;
    });
    if (!Object.keys(texts).length) { exitEdit(); return; }
    state.busy = true;
    state.error = '';
    render();
    post('/api/site-edit/save', { site: SITE, texts: texts }).then(function (r) {
      if (r.res.status === 401) {
        // פג תוקף האימות (12 שעות) - מבקשים קוד מחדש בלי לאבד את העריכות
        state.verified = false;
        state.mode = 'ask';
        throw new Error('פג תוקף האימות - הזינו קוד חדש ושמרו שוב');
      }
      if (!r.res.ok) throw new Error((r.data && r.data.error) || 'השמירה נכשלה');
      var saved = r.data.texts || {};
      lsSet(TEXTS_KEY, JSON.stringify(saved));
      lsSet(BUST_KEY, String(Date.now())); // עוקף את מטמון הדפדפן/CDN בטעינה הבאה של אותו אדמין
      state.busy = false;
      exitEdit();
      setTexts(saved); // מחילים מיד את המפה המלאה
      state.saved = true;
      render();
      setTimeout(function () { state.saved = false; render(); }, 2500);
    }).catch(function (e) {
      state.busy = false;
      state.error = (e && e.message) || 'השמירה נכשלה';
      render();
    });
  }

  // ---------------------------------------------------------------- הפעלה
  function start() {
    startObserver();
    watchUrl();
    loadTexts();
    // זיהוי הסופר-אדמין אחרי שהאתר סיים להיטען - לא על הנתיב הקריטי של הדף
    var run = function () {
      checkMe().then(function (me) {
        if (!me || !me.superAdmin) return;
        state.ready = true;
        state.configured = me.configured !== false;
        state.verified = !!me.verified;
        render();
      });
    };
    if (document.readyState === 'complete') setTimeout(run, 300);
    else window.addEventListener('load', function () { setTimeout(run, 300); });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
