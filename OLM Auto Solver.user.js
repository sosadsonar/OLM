// ==UserScript==
// @name         OLM Auto Solver
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @updateURL    https://github.com/sosadsonar/OLM/releases/latest/download/OLM.Auto.Solver.user.js
// @downloadURL  https://github.com/sosadsonar/OLM/releases/latest/download/OLM.Auto.Solver.user.js
// @description  Chống phát hiện chuyển tab. Tự động giải các dạng bài tập trên OLM (Trắc nghiệm, Điền từ, Đúng sai). Hỗ trợ tốt câu hỏi hỗn hợp (Mixed).
// @author       Sonarx + Gemini
// @match        *://olm.vn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const XOR_KEY = "1047823200";
    const solutionMap = new Map();
    const skillMap = new Map();
    const capturedBosses = new Map();

    // Set dùng để theo dõi chính xác các câu hỏi/ô điền ĐÃ ĐƯỢC XỬ LÝ
    const solvedElements = new Set();

    let isAutoSolveEnabled = false;
    let hasTriggeredLoad = false;
    let isReviewing = false;

    // --- 0. ANTI-DETECTION ---
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
    window.addEventListener('blur', e => e.stopImmediatePropagation(), true);

    // --- 1. HOOK BOSS ENGINE ---
    const hookOLM = () => {
        const originalDetect = window.detectQuestion;
        if (typeof originalDetect !== 'function') return;

        window.detectQuestion = function(content, __data, config) {
            const Boss = originalDetect.apply(this, arguments);
            try {
                const qId = (Boss && Boss.id_quiz) ? Boss.id_quiz.toString() :
                            (Boss && Boss.save_data && Boss.save_data.idq ? Boss.save_data.idq.toString() : null);
                if (qId && Boss) capturedBosses.set(qId, Boss);
            } catch (e) {}
            return Boss;
        };
    };

    // --- 2. GIAO DIỆN ---
    function createUI() {
        if (document.getElementById('olm-solver-ui')) return;
        const ui = document.createElement('div');
        ui.id = "olm-solver-ui";
        ui.style = "position: fixed; top: 20px; right: 20px; z-index: 10000; font-family: sans-serif; touch-action: none; user-select: none;";
        ui.innerHTML = `
            <div id="h-drag" style="background: #1B5E20; color: white; padding: 12px; border-radius: 8px 8px 0 0; cursor: move; display: flex; justify-content: space-between; align-items: center; min-width: 210px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                <span style="font-weight: bold; font-size: 13px;">OLM Solver v1.2.1</span>
                <span id="min-btn" style="cursor: pointer; padding: 0 5px;">−</span>
            </div>
            <div id="h-body" style="background: white; border: 1px solid #1B5E20; border-top: none; border-radius: 0 0 8px 8px; padding: 15px;">
                <div id="h-status" style="font-size: 11px; color: #555; text-align: center; margin-bottom: 10px;">Sẵn sàng</div>
                <button id="btn-start" style="width: 100%; padding: 10px; border: none; border-radius: 6px; background: #E64A19; color: white; cursor: pointer; font-weight: bold; font-size: 12px;">GIẢI & LƯU TỰ ĐỘNG</button>
            </div>
        `;
        document.body.appendChild(ui);

        const h = document.getElementById('h-drag'), b = document.getElementById('h-body'), mi = document.getElementById('min-btn'), startBtn = document.getElementById('btn-start');
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
        window.addEventListener('mouseup', () => drag = false); window.addEventListener('touchend', () => drag = false);
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: false});

        startBtn.onclick = function() {
            if(solutionMap.size === 0 && skillMap.size === 0) return alert("Chưa nạp dữ liệu!");
            isAutoSolveEnabled = true;
            this.innerText = "ĐANG THỰC THI...";
            this.disabled = true;
            this.style.opacity = "0.7";
            turboLoadAll();
        };
    }

    // Cập nhật nhãn đếm trực tiếp từ số lượng câu/ô đã giải thành công
    function updateSolvedCountUI() {
        const status = document.getElementById('h-status');
        if (status && isAutoSolveEnabled) {
            status.innerText = `Đã giải: ${solvedElements.size} câu`;
        }
    }

    // --- 3. GIẢI MÃ DỮ LIỆU ---
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
            const sol = { fill: [], mcq: [], tf: [] };
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // --- CHIẾN THUẬT 1: MIXED QUESTION MAPPING ---
            doc.querySelectorAll('[id-curriculum-skill]').forEach(el => {
                const skillId = el.getAttribute('id-curriculum-skill');

                // Mixed Fill
                const inp = el.querySelector('input[data-accept]');
                if (inp) skillMap.set(skillId, { type: 'fill', ans: inp.getAttribute('data-accept'), qId: qId });

                // Mixed MCQ
                if (el.classList.contains('quiz-list')) {
                    const corrects = [];
                    el.querySelectorAll('li, .qselect').forEach((item, idx) => {
                        if (item.classList.contains('correctAnswer') || item.querySelector('.correctAnswer')) {
                            corrects.push(item.getAttribute('data-ind') || idx.toString());
                        }
                    });
                    skillMap.set(skillId, { type: 'mcq', ans: corrects, qId: qId });
                }

                // Mixed True/False (Nếu có dòng đơn lẻ)
                if (el.classList.contains('tf-row') || el.tagName === 'LI' && el.closest('.true-false')) {
                    const isCorrect = el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer');
                    if (isCorrect) skillMap.set(skillId, { type: 'tf', ans: "1", qId: qId });
                }
            });

            // --- CHIẾN THUẬT 2: STANDARD QUESTION MAPPING ---
            doc.querySelectorAll('input[data-accept]').forEach(inp => sol.fill.push(inp.getAttribute('data-accept')));
            doc.querySelectorAll('.quiz-list').forEach(list => {
                const corrects = [];
                list.querySelectorAll('li, .qselect').forEach((el, idx) => {
                    if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) corrects.push(el.getAttribute('data-ind') || idx.toString());
                });
                sol.mcq.push(corrects);
            });
            doc.querySelectorAll('.tf-row, .true-false li').forEach((el, idx) => {
                if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) {
                    sol.tf.push({ id: el.getAttribute('data-id') || idx.toString(), state: "1" });
                } else {
                    sol.tf.push({ id: el.getAttribute('data-id') || idx.toString(), state: "0" });
                }
            });
            solutionMap.set(qId, sol);
        });

        const status = document.getElementById('h-status');
        if (status && !isAutoSolveEnabled) {
            status.innerText = `Đã nạp dữ liệu xong`;
        }
    }

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

    // --- 4. VÒNG LẶP THỰC THI ---
    setInterval(() => {
        if (!isAutoSolveEnabled || isReviewing) return;
        let anyAct = false;
        let totalFound = 0;

        // 4.1 ĐIỀN MIXED (Theo id-curriculum-skill)
        document.querySelectorAll('[id-curriculum-skill]').forEach(el => {
            const sid = el.getAttribute('id-curriculum-skill');
            if (sid && skillMap.has(sid)) {
                const data = skillMap.get(sid);

                // Fill Mixed
                const inp = el.querySelector('input[type="text"]');
                if (data.type === 'fill' && inp) {
                    const realVal = getFinalValue(data.ans, data.qId);
                    if (inp.value.trim() !== realVal.toString()) {
                        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        s.call(inp, realVal);
                        ['input', 'change', 'blur'].forEach(t => inp.dispatchEvent(new Event(t, {bubbles:true})));
                        anyAct = true;
                    }
                    solvedElements.add(`mixed-fill-${sid}`);
                }
                // MCQ Mixed
                if (data.type === 'mcq') {
                    el.querySelectorAll('.qselect').forEach(opt => {
                        const ind = opt.getAttribute('data-ind');
                        if (data.ans.includes(ind) && !opt.classList.contains('qchecked')) {
                            opt.click(); anyAct = true;
                        }
                    });
                    solvedElements.add(`mixed-mcq-${sid}`);
                }
                // True/False Mixed
                if (data.type === 'tf') {
                    const btn = el.querySelector('.qselect');
                    if (btn && btn.getAttribute('data-state') !== data.ans) {
                        btn.click(); anyAct = true;
                    }
                    solvedElements.add(`mixed-tf-${sid}`);
                }
            }
        });

        // 4.2 ĐIỀN STANDARD (Bỏ qua các ô thuộc Mixed)
        solutionMap.forEach((sol, id) => {
            const box = document.querySelector(`[data-id-quiz="${id}"], #user-test-${id}`);
            if (!box) return;
            totalFound++;

            const filter = (el) => !el.closest('.exp, .showExp, .quiz-correct, .quiz-exp');

            // Standard Fill
            const inputs = Array.from(box.querySelectorAll('input[type="text"]:not(.search-input)'))
                               .filter(el => filter(el) && !el.closest('[id-curriculum-skill]'));
            sol.fill.forEach((v, i) => {
                if (inputs[i]) {
                    const realVal = getFinalValue(v, id);
                    if (inputs[i].value.trim() !== realVal.toString()) {
                        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        s.call(inputs[i], realVal);
                        ['input', 'change', 'blur'].forEach(t => inputs[i].dispatchEvent(new Event(t, {bubbles:true})));
                        anyAct = true;
                    }
                    solvedElements.add(`std-fill-${id}-${i}`);
                }
            });

            // Standard MCQ
            const lists = Array.from(box.querySelectorAll('.quiz-list'))
                               .filter(el => filter(el) && !el.hasAttribute('id-curriculum-skill'));
            lists.forEach((l, idx) => {
                if (sol.mcq[idx]) {
                    l.querySelectorAll('.qselect').forEach(opt => {
                        const ind = opt.getAttribute('data-ind');
                        if (sol.mcq[idx].includes(ind) && !opt.classList.contains('qchecked')) {
                            opt.click(); anyAct = true;
                        }
                    });
                    solvedElements.add(`std-mcq-${id}-${idx}`);
                }
            });

            // Standard True/False
            const tfs = Array.from(box.querySelectorAll('.tf-row, .true-false li'))
                             .filter(el => filter(el) && !el.hasAttribute('id-curriculum-skill'));
            tfs.forEach((row, i) => {
                if (sol.tf[i]) {
                    const btn = row.querySelector('.qselect');
                    if (btn && btn.getAttribute('data-state') !== sol.tf[i].state) {
                        btn.click(); anyAct = true;
                    }
                    solvedElements.add(`std-tf-${id}-${i}`);
                }
            });
        });

        // Cập nhật số liệu hiển thị trên giao diện
        updateSolvedCountUI();

        if (!anyAct && (totalFound > 0 || skillMap.size > 0)) autoSave();
    }, 1800);

    function turboLoadAll() {
        if (hasTriggeredLoad) return;
        hasTriggeredLoad = true;
        const btns = document.querySelectorAll('#question-list .item-q');
        if (btns.length === 0) return;
        btns.forEach((b, i) => setTimeout(() => { b.click(); if(i === btns.length-1) setTimeout(() => btns[0].click(), 300); }, i * 150));
    }

    function autoSave() {
        if (isReviewing) return;
        isReviewing = true; isAutoSolveEnabled = false;
        const status = document.getElementById('h-status'), startBtn = document.getElementById('btn-start');
        if(status) status.innerText = `💾 Đang nộp bài... (Tổng: ${solvedElements.size} câu)`;
        const btns = document.querySelectorAll('#question-list .item-q');
        if (btns.length === 0) return finishAction(status, startBtn);
        btns.forEach((b, i) => setTimeout(() => { b.click(); if (i === btns.length - 1) finishAction(status, startBtn); }, i * 150));
    }

    function finishAction(status, btn) {
        if(status) status.innerHTML = `<b style='color:green'>HOÀN TẤT ✅ (${solvedElements.size} câu)</b>`;
        if(btn) { btn.innerText = "GIẢI & LƯU TỰ ĐỘNG"; btn.disabled = false; btn.style.opacity = "1"; }
        isReviewing = false; hasTriggeredLoad = false;
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

    const check = setInterval(() => { if (window.detectQuestion) { hookOLM(); clearInterval(check); } }, 100);
    window.addEventListener('load', createUI);
})();