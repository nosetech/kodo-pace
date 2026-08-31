(() => {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const widthRange = document.getElementById("widthRange");
  const pressureToggle = document.getElementById("pressureToggle");
  const allowTouchToggle = document.getElementById("allowTouchToggle");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const saveBtn = document.getElementById("saveBtn");
  const debugInfo = document.getElementById("debugInfo");

  // 実ピクセル座標で描くための devicePixelRatio 対応。ぼやけ・ズレを防ぐ。
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }
  window.addEventListener("resize", resizeCanvas);

  /** @type {{x:number,y:number,pressure:number}[][]} */
  const strokes = [];
  /** @type {{x:number,y:number,pressure:number}[]|null} */
  let currentStroke = null;

  // 手のひら(パーム)誤検知対策: ペンが使用中/直後は touch 由来のポインタを無視する。
  // iPadOS Safari 等でも、アプリ側でこの種のガードを入れるのが一般的な実装パターン。
  let activePenPointerId = null;
  let lastPenActivityAt = 0;
  const PALM_REJECTION_WINDOW_MS = 500;

  // 追従性計測用: 直近1秒間に処理した座標点(coalesced展開後)の数を数える。
  let pointTimestamps = [];
  let lastCoalescedSupport = "-";

  function shouldIgnoreAsPalm(e) {
    if (allowTouchToggle.checked) return false;
    if (e.pointerType !== "touch") return false;
    const penRecentlyActive =
      activePenPointerId !== null ||
      Date.now() - lastPenActivityAt < PALM_REJECTION_WINDOW_MS;
    return penRecentlyActive;
  }

  function pressureToWidth(pressure) {
    const base = Number(widthRange.value);
    if (!pressureToggle.checked) return base;
    // pressure は 0(ホバー) 〜 1。マウス/非対応デバイスでは常に 0.5 が返る仕様(Pointer Events spec)。
    const p = pressure > 0 ? pressure : 0.5;
    return base * (0.3 + p * 1.4);
  }

  function drawSegment(p0, p1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = pressureToWidth(p1.pressure);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  function redrawAll() {
    const rect = canvas.parentElement.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of strokes) {
      if (stroke.length === 1) {
        drawSegment(stroke[0], stroke[0]);
        continue;
      }
      for (let i = 1; i < stroke.length; i++) {
        drawSegment(stroke[i - 1], stroke[i]);
      }
    }
  }

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure,
    };
  }

  function handleMove(e) {
    if (!currentStroke || e.pointerId !== currentStroke.pointerId) return;

    // getCoalescedEvents: ディスプレイの描画フレームレート(60fps)より高い
    // サンプリングレート(Apple Pencil は最大240Hz)で送られてくる中間点をすべて拾い、
    // カクつきの少ない線にするための Pointer Events API の仕組み。
    const events =
      typeof e.getCoalescedEvents === "function"
        ? e.getCoalescedEvents()
        : [e];
    lastCoalescedSupport =
      typeof e.getCoalescedEvents === "function" ? "対応" : "非対応";

    const now = Date.now();
    for (const ev of events) {
      const point = pointFromEvent(ev);
      const last = currentStroke.points[currentStroke.points.length - 1];
      drawSegment(last, point);
      currentStroke.points.push(point);
      pointTimestamps.push(now);
    }
    updateDebug(e);
  }

  function updateDebug(e) {
    const oneSecondAgo = Date.now() - 1000;
    pointTimestamps = pointTimestamps.filter((t) => t > oneSecondAgo);
    debugInfo.textContent =
      `pointerType: ${e.pointerType} / ` +
      `pressure: ${e.pressure.toFixed(2)} / ` +
      `points/s: ${pointTimestamps.length} / ` +
      `coalesced対応: ${lastCoalescedSupport}`;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (shouldIgnoreAsPalm(e)) return;
    if (e.pointerType === "pen") {
      activePenPointerId = e.pointerId;
      lastPenActivityAt = Date.now();
    }
    canvas.setPointerCapture(e.pointerId);
    const point = pointFromEvent(e);
    currentStroke = { pointerId: e.pointerId, points: [point] };
    // 移動を伴わないタップ(句読点や「。」の点など)でも見える点を残す
    drawSegment(point, point);
    updateDebug(e);
  });

  canvas.addEventListener("pointermove", handleMove);

  function endStroke(e) {
    if (!currentStroke || e.pointerId !== currentStroke.pointerId) return;
    strokes.push(currentStroke.points);
    currentStroke = null;
    if (e.pointerId === activePenPointerId) {
      activePenPointerId = null;
      lastPenActivityAt = Date.now();
    }
  }

  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", (e) => {
    // マウス操作時のみ、キャンバス外に出たら線を止める(ペン/タッチは capture 済みなので影響しない)
    if (e.pointerType === "mouse") endStroke(e);
  });

  undoBtn.addEventListener("click", () => {
    strokes.pop();
    redrawAll();
  });

  clearBtn.addEventListener("click", () => {
    strokes.length = 0;
    redrawAll();
  });

  saveBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `kodo-pace-answer-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  resizeCanvas();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("service worker registration failed", err);
    });
  }
})();
