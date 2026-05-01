// ==UserScript==
// @name         OLM Auto Solver
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Tự động giải trắc nghiệm của OLM.
// @author       Sonarx & Gemini
// @match        *://olm.vn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. MODULE ANTI-DETECTION ---
    Object.defineProperty(document, 'visibilityState', { get: function() { return 'visible'; } });
    Object.defineProperty(document, 'hidden', { get: function() { return false; } });

    const blockEvents = ['visibilitychange', 'blur', 'focusout', 'mouseleave'];
    blockEvents.forEach(eventName => {
        window.addEventListener(eventName, (e) => e.stopImmediatePropagation(), true);
        document.addEventListener(eventName, (e) => e.stopImmediatePropagation(), true);
    });

    const XOR_KEY = "1047823200";
    const solutionMap = new Map();
    let isAutoSolveEnabled = false;
    let hasTriggeredLoad = false;
    let isReviewing = false;
    let isMinimized = false;

    // --- 1. GIAO DIỆN & KÉO THẢ ---
    function createUI() {
        if (document.getElementById('olm-solver-ui')) return;
        const container = document.createElement('div');
        container.id = "olm-solver-ui";
        container.style = "position: fixed; top: 20px; right: 20px; z-index: 10000; font-family: sans-serif; user-select: none;";

        container.innerHTML = `
            <div id="solver-header" style="background: #3F51B5; color: white; padding: 10px 15px; border-radius: 8px 8px 0 0; cursor: move; display: flex; justify-content: space-between; align-items: center; min-width: 220px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <span style="font-weight: bold; font-size: 13px;">OLM Solver v7.3.16 ⚔️</span>
                <span id="toggle-icon" style="cursor: pointer; padding: 0 5px;">−</span>
            </div>
            <div id="solver-body" style="background: #fff; border: 1px solid #3F51B5; border-top: none; border-radius: 0 0 8px 8px; padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div id="solver-status" style="font-size: 11px; margin-bottom: 12px; color: #555; text-align: center;">🛡️ Chế độ ẩn danh: Bật</div>
                <button id="btn-mass-solve" style="width: 100%; padding: 10px; border: none; border-radius: 6px; background: #4CAF50; color: white; cursor: pointer; font-weight: bold; font-size: 12px;">GIẢI & LƯU TỰ ĐỘNG</button>
            </div>
        `;
        document.body.appendChild(container);

        const header = document.getElementById('solver-header');
        const body = document.getElementById('solver-body');
        const icon = document.getElementById('toggle-icon');

        icon.onclick = (e) => {
            e.stopPropagation();
            isMinimized = !isMinimized;
            body.style.display = isMinimized ? 'none' : 'block';
            container.style.borderRadius = isMinimized ? '8px' : '8px 8px 0 0';
            icon.innerText = isMinimized ? '+' : '−';
        };

        let isDragging = false;
        let offsetX, offsetY;
        header.onmousedown = (e) => {
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            header.style.cursor = "grabbing";
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            container.style.left = (e.clientX - offsetX) + "px";
            container.style.top = (e.clientY - offsetY) + "px";
            container.style.right = "auto";
        };
        document.onmouseup = () => {
            isDragging = false;
            header.style.cursor = "move";
        };

        document.getElementById('btn-mass-solve').onclick = () => {
            if(solutionMap.size === 0) return alert("Chưa có đáp án! Hãy đợi nạp xong.");
            isAutoSolveEnabled = true;
            document.getElementById('solver-status').innerText = "🚀 Đang giải bài...";
            turboLoadAll();
        };
    }

    // --- 2. LOGIC ĐỒNG BỘ THAM SỐ p.a ---
    function processQuestionContext(html) {
        let p = {};
        const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const params = (obj) => Object.assign(p, obj);

        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const codeElm = tempDiv.querySelector("code.language-javascript");
        if (codeElm) {
            try { eval(codeElm.textContent.replace(/\u200B/g, "").trim()); } catch (t) {}
        }

        const resolvePlaceholder = (text) => {
            if (!text) return "";
            return text.replace(/@(.*?)@/g, (match, expression) => {
                try {
                    let val = eval(expression.replace(/&nbsp;/g, ""));
                    return val !== undefined ? val : match;
                } catch (e) { return match; }
            });
        };

        tempDiv.querySelectorAll('input[data-accept]').forEach(inp => {
            inp.setAttribute('data-accept', resolvePlaceholder(inp.getAttribute('data-accept')));
        });
        return tempDiv;
    }

    // --- 3. GIẢI MÃ & TRÍCH XUẤT ĐÁP ÁN ---
    function decrypt(str) {
        if (!str) return "";
        try {
            const binary = atob(str);
            let decrypted = "";
            for (let i = 0; i < binary.length; i++) {
                decrypted += String.fromCharCode(binary.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
            }
            return decodeURIComponent(escape(decrypted));
        } catch (e) { return null; }
    }

    function processData(data) {
        const questions = Array.isArray(data) ? data : (data.data || []);
        const status = document.getElementById('solver-status');
        if (status && !isAutoSolveEnabled) status.innerText = `Sẵn sàng (${questions.length} câu)`;

        questions.forEach(q => {
            const rawHtml = decrypt(q.content || q.json_content);
            if (!rawHtml) return;
            const resolvedDoc = processQuestionContext(rawHtml);
            const qId = (q.id || q._id).toString();

            // Loại bỏ giải thích
            resolvedDoc.querySelectorAll('.exp, .showExp, .quiz-correct, .quiz-list').forEach(el => el.remove());

            const sol = { choiceBlocks: [], tfCorrectIds: new Set(), fillValues: [] };

            const rootDoc = document.createElement('div');
            rootDoc.innerHTML = rawHtml;

            // FIX: Trích xuất Trắc nghiệm chính xác hơn
            rootDoc.querySelectorAll('.quiz-list').forEach(list => {
                const correctSet = new Set();
                list.querySelectorAll('li, .qselect').forEach((el, idx) => {
                    if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) {
                        // Lấy data-ind từ chính thẻ đó hoặc thẻ con qselect
                        const ind = el.getAttribute('data-ind') || el.querySelector('.qselect')?.getAttribute('data-ind') || idx.toString();
                        correctSet.add(ind);
                    }
                });
                sol.choiceBlocks.push(correctSet);
            });

            // FIX: Trích xuất Đúng-Sai
            rootDoc.querySelectorAll('.tf-row, .true-false li').forEach((el, idx) => {
                if (el.classList.contains('correctAnswer') || el.querySelector('.correctAnswer')) {
                    sol.tfCorrectIds.add(el.getAttribute('data-id') || idx.toString());
                }
            });

            resolvedDoc.querySelectorAll('input[data-accept]').forEach(inp => {
                sol.fillValues.push(inp.getAttribute('data-accept').replace(/\$/g, '').split('||')[0].split(';')[0].trim());
            });

            solutionMap.set(qId, sol);
        });
    }

    // --- 4. WORKFLOW TỰ ĐỘNG ---
    function turboLoadAll() {
        if (hasTriggeredLoad) return;
        hasTriggeredLoad = true;
        const qButtons = document.querySelectorAll('#question-list .item-q');
        qButtons.forEach((btn, i) => {
            setTimeout(() => {
                btn.click();
                if(i === qButtons.length-1) setTimeout(() => qButtons[0].click(), 300);
            }, i * 150);
        });
    }

    function autoReviewAll() {
        if (isReviewing) return;
        isReviewing = true;
        isAutoSolveEnabled = false;
        const status = document.getElementById('solver-status');
        status.innerText = "💾 Đang lưu điểm (150ms)...";
        const qButtons = document.querySelectorAll('#question-list .item-q');
        qButtons.forEach((btn, i) => {
            setTimeout(() => {
                btn.click();
                if (i === qButtons.length - 1) status.innerHTML = "<b style='color:green'>✅ HOÀN TẤT & ĐÃ LƯU</b>";
            }, i * 150);
        });
    }

    function forceReactUpdate(input, value) {
        if (!input) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, value);
        ['input', 'change', 'blur'].forEach(t => input.dispatchEvent(new Event(t, { bubbles: true })));
    }

    // --- 5. VÒNG LẶP THỰC THI CHÍNH ---
    setInterval(() => {
        if (!isAutoSolveEnabled || solutionMap.size === 0 || isReviewing) return;
        let anyActionTaken = false;
        let containersFound = 0;

        solutionMap.forEach((sol, qId) => {
            const box = document.querySelector(`.quiz-content[data-id-quiz="${qId}"], #user-test-${qId}`);
            if (!box) return;
            containersFound++;

            const isGarbage = (el) => el.closest('.exp, .showExp, .quiz-correct, .quiz-exp');

            // 1. Điền từ
            const inputs = Array.from(box.querySelectorAll('input[type="text"]:not(.search-input)')).filter(el => !isGarbage(el));
            sol.fillValues.forEach((val, idx) => {
                if (inputs[idx] && inputs[idx].value.trim() !== val) {
                    forceReactUpdate(inputs[idx], val);
                    anyActionTaken = true;
                }
            });

            // 2. Trắc nghiệm
            const quizLists = Array.from(box.querySelectorAll('.quiz-list')).filter(el => !isGarbage(el));
            quizLists.forEach((list, lIdx) => {
                const corrects = sol.choiceBlocks[lIdx];
                if (!corrects) return;
                list.querySelectorAll('.qselect').forEach(option => {
                    const ind = option.getAttribute('data-ind');
                    if (corrects.has(ind) && !option.classList.contains('qchecked')) {
                        option.click();
                        anyActionTaken = true;
                    }
                });
            });

            // 3. Đúng - Sai
            const tfRows = Array.from(box.querySelectorAll('.tf-row, .true-false li')).filter(el => !isGarbage(el));
            tfRows.forEach((row) => {
                const rowId = row.getAttribute('data-id');
                if (rowId !== null) {
                    const targetState = sol.tfCorrectIds.has(rowId) ? "1" : "0";
                    const btn = row.querySelector('.qselect');
                    if (btn && btn.getAttribute('data-state') !== targetState) {
                        btn.click();
                        anyActionTaken = true;
                    }
                }
            });
        });

        if (!anyActionTaken && containersFound > 0) autoReviewAll();
    }, 1500);

    const rawXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new rawXHR();
        xhr.addEventListener('readystatechange', function() {
            if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseURL.includes('get-question-of-ids')) {
                try { processData(JSON.parse(xhr.responseText)); } catch (e) {}
            }
        });
        return xhr;
    };

    window.addEventListener('load', createUI);
})();