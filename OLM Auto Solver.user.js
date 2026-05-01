// ==UserScript==
// @name         OLM Auto Solver
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @updateURL    https://github.com/sosadsonar/OLM/releases/latest/download/OLM.Auto.Solver.user.js
// @downloadURL  https://github.com/sosadsonar/OLM/releases/latest/download/OLM.Auto.Solver.user.js
// @description  Cho phép chuyển tab + Tự động giải tất cả các loại câu hỏi trừ tự luận.
// @author       Sonarx + Gemini
// @match        *://olm.vn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const XOR_KEY = "1047823200";
    const solutionMap = new Map();
    const capturedBosses = new Map();
    let isAutoSolveEnabled = false;
    let hasTriggeredLoad = false;
    let isReviewing = false;

    // --- 0. ANTI-DETECTION ---
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
    window.addEventListener('blur', e => e.stopImmediatePropagation(), true);

    // --- 1. HOOK BOSS ---
    const hookOLM = () => {
        const originalDetect = window.detectQuestion;
        if (typeof originalDetect !== 'function') return;

        window.detectQuestion = function(content, __data, config) {
            const Boss = originalDetect.apply(this, arguments);
            try {
                const qId = (Boss && Boss.id_quiz) ? Boss.id_quiz.toString() :
                            (Boss && Boss.save_data && Boss.save_data.idq ? Boss.save_data.idq.toString() : null);

                if (qId && Boss) {
                    capturedBosses.set(qId, Boss);
                    console.log(`%c[BOSS SYNC] ID: ${qId} đã sẵn sàng tham số.`, "color: #00BCD4; font-weight: bold;");
                }
            } catch (e) {}
            return Boss;
        };
    };

    // --- 2. GIAO DIỆN KÉO THẢ ---
    function createUI() {
        if (document.getElementById('olm-solver-ui')) return;
        const ui = document.createElement('div');
        ui.id = "olm-solver-ui";
        ui.style = "position: fixed; top: 20px; right: 20px; z-index: 10000; font-family: sans-serif; touch-action: none; user-select: none;";
        ui.innerHTML = `
            <div id="h-drag" style="background: #2E7D32; color: white; padding: 12px; border-radius: 8px 8px 0 0; cursor: move; display: flex; justify-content: space-between; align-items: center; min-width: 210px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                <span style="font-weight: bold; font-size: 13px;">OLM Solver v1.0.0</span>
                <span id="min-btn" style="cursor: pointer; padding: 0 5px;">−</span>
            </div>
            <div id="h-body" style="background: white; border: 1px solid #2E7D32; border-top: none; border-radius: 0 0 8px 8px; padding: 15px;">
                <div id="h-status" style="font-size: 11px; color: #555; text-align: center; margin-bottom: 10px;">Đang chờ dữ liệu</div>
                <button id="btn-start" style="width: 100%; padding: 10px; border: none; border-radius: 6px; background: #FF5722; color: white; cursor: pointer; font-weight: bold; font-size: 12px;">GIẢI & LƯU TỰ ĐỘNG</button>
            </div>
        `;
        document.body.appendChild(ui);

        const h = document.getElementById('h-drag'), b = document.getElementById('h-body'), mi = document.getElementById('min-btn');
        mi.onclick = (e) => { b.style.display = b.style.display === 'none' ? 'block' : 'none'; mi.innerText = b.style.display === 'none' ? '+' : '−'; };

        let drag = false, sx, sy;
        const move = (e) => {
            if (!drag) return;
            const c = e.type.includes('touch') ? e.touches[0] : e;
            ui.style.left = (c.clientX - sx) + 'px'; ui.style.top = (c.clientY - sy) + 'px'; ui.style.right = 'auto';
            if (e.type.includes('touch')) e.preventDefault();
        };
        h.addEventListener('mousedown', (e) => { drag = true; sx = e.clientX - ui.offsetLeft; sy = e.clientY - ui.offsetTop; });
        h.addEventListener('touchstart', (e) => { drag = true; sx = e.touches[0].clientX - ui.offsetLeft; sy = e.touches[0].clientY - ui.offsetTop; });
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('mouseup', () => drag = false); window.addEventListener('touchend', () => drag = false);

        document.getElementById('btn-start').onclick = function() {
            if(solutionMap.size === 0) return alert("Chưa có dữ liệu!");
            isAutoSolveEnabled = true; this.innerText = "ĐANG GIẢI...";
            turboLoadAll();
        };
    }

    // --- 3. GIẢI MÃ & XỬ LÝ DỮ LIỆU ---
    function decrypt(s) {
        try {
            const b = atob(s); let d = "";
            for (let i = 0; i < b.length; i++) d += String.fromCharCode(b.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
            return decodeURIComponent(escape(d));
        } catch (e) { return ""; }
    }

    function processData(data) {
        const qs = Array.isArray(data) ? data : (data.data || []);
        qs.forEach(q => {
            const html = decrypt(q.content || q.json_content);
            if (!html) return;
            const qId = (q.id || q._id).toString();
            const sol = { fill: [], mcq: [], tf: new Set() };
            const doc = new DOMParser().parseFromString(html, 'text/html');

            doc.querySelectorAll('input[data-accept]').forEach(inp => sol.fill.push(inp.getAttribute('data-accept')));
            doc.querySelectorAll('.quiz-list').forEach(list => {
                const corrects = [];
                list.querySelectorAll('li, .qselect').forEach((el, idx) => {
                    if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) {
                        corrects.push(el.getAttribute('data-ind') || idx.toString());
                    }
                });
                sol.mcq.push(corrects);
            });
            doc.querySelectorAll('.tf-row, .true-false li').forEach((el, idx) => {
                if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) {
                    sol.tf.add(el.getAttribute('data-id') || idx.toString());
                }
            });
            solutionMap.set(qId, sol);
        });
        if(document.getElementById('h-status')) document.getElementById('h-status').innerText = `Đã nạp: ${solutionMap.size} câu`;
    }

    // --- 4. THAY THẾ PARAM ---
    function getFinalValue(raw, qId) {
        if (!raw) return "";
        let val = raw;
        const Boss = capturedBosses.get(qId);
        if (Boss && Boss.p) {
            val = val.replace(/@p\.(.*?)@/g, (m, k) => Boss.p[k.trim()] !== undefined ? Boss.p[k.trim()] : m);
            val = val.replace(/@(.*?)@/g, (m, k) => Boss.p[k.trim()] !== undefined ? Boss.p[k.trim()] : m);
        }
        return val.replace(/\$/g, '').split('||')[0].split(';')[0].trim();
    }

    // --- 5. VÒNG LẶP ĐIỀN BÀI ---
    setInterval(() => {
        if (!isAutoSolveEnabled || isReviewing || solutionMap.size === 0) return;
        let anyAct = false;
        let count = 0;

        solutionMap.forEach((sol, id) => {
            const box = document.querySelector(`[data-id-quiz="${id}"], #user-test-${id}`);
            if (!box) return;
            count++;

            const filter = (el) => !el.closest('.exp, .showExp, .quiz-correct');

            // 1. ĐIỀN TỪ
            const inputs = Array.from(box.querySelectorAll('input[type="text"]:not(.search-input)')).filter(filter);
            sol.fill.forEach((v, i) => {
                const realVal = getFinalValue(v, id);
                if (inputs[i] && inputs[i].value.trim() !== realVal.toString()) {
                    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    s.call(inputs[i], realVal);
                    ['input', 'change', 'blur'].forEach(t => inputs[i].dispatchEvent(new Event(t, {bubbles:true})));
                    anyAct = true;
                }
            });

            // 2. TRẮC NGHIỆM
            const lists = Array.from(box.querySelectorAll('.quiz-list')).filter(filter);
            lists.forEach((l, idx) => {
                if (!sol.mcq[idx]) return;
                l.querySelectorAll('.qselect').forEach(opt => {
                    if (sol.mcq[idx].includes(opt.getAttribute('data-ind')) && !opt.classList.contains('qchecked')) {
                        opt.click(); anyAct = true;
                    }
                });
            });

            // 3. ĐÚNG/SAI (TRUE/FALSE)
            const tfs = Array.from(box.querySelectorAll('.tf-row, .true-false li')).filter(filter);
            tfs.forEach((r, idx) => {
                const rid = r.getAttribute('data-id') || idx.toString();
                const btn = r.querySelector('.qselect');
                if (btn && btn.getAttribute('data-state') !== (sol.tf.has(rid) ? "1" : "0")) {
                    btn.click(); anyAct = true;
                }
            });
        });

        if (!anyAct && count > 0) autoSave();
    }, 1500);

    function turboLoadAll() {
        if (hasTriggeredLoad) return;
        hasTriggeredLoad = true;
        const btns = document.querySelectorAll('#question-list .item-q');
        btns.forEach((b, i) => setTimeout(() => { b.click(); if(i === btns.length-1) setTimeout(() => btns[0].click(), 300); }, i * 150));
    }

    function autoSave() {
        if (isReviewing) return;
        isReviewing = true; isAutoSolveEnabled = false;
        const status = document.getElementById('h-status');
        status.innerText = "💾 Đang nộp bài...";
        const btns = document.querySelectorAll('#question-list .item-q');
        btns.forEach((b, i) => setTimeout(() => { b.click(); if (i === btns.length - 1) status.innerHTML = "<b style='color:green'>XONG!</b>"; }, i * 150));
    }

    const rawXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new rawXHR();
        xhr.addEventListener('readystatechange', () => {
            if (xhr.readyState === 4 && xhr.responseURL.includes('get-question-of-ids')) {
                try { processData(JSON.parse(xhr.responseText)); } catch (e) {}
            }
        });
        return xhr;
    };

    const check = setInterval(() => {
        if (window.detectQuestion) { hookOLM(); clearInterval(check); }
    }, 100);

    window.addEventListener('load', createUI);
})();