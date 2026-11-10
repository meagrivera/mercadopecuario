// blog.js — Botones de compartir y lector de voz para los artículos del blog.
(function () {
  "use strict";

  /* ---------- Compartir ---------- */

  document.querySelectorAll("[data-share-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-share-copy");
      var label = btn.querySelector(".share-label");
      var done = function () {
        if (!label) return;
        var old = label.textContent;
        label.textContent = "¡Copiado!";
        setTimeout(function () { label.textContent = old; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copia el enlace:", url); });
      } else {
        window.prompt("Copia el enlace:", url);
      }
    });
  });

  if (navigator.share) {
    document.querySelectorAll("[data-share-native]").forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () {
        navigator.share({
          title: btn.getAttribute("data-title"),
          url: btn.getAttribute("data-url")
        }).catch(function () {});
      });
    });
  }

  /* ---------- Escuchar el artículo ---------- */

  var player = document.querySelector(".tts-player");
  var article = document.querySelector("article.post");
  var synth = window.speechSynthesis;

  if (!player || !article || !synth || typeof SpeechSynthesisUtterance === "undefined") return;
  player.hidden = false;

  var btnPlay = player.querySelector(".tts-play");
  var btnStop = player.querySelector(".tts-stop");
  var selRate = player.querySelector(".tts-rate");
  var status = player.querySelector(".tts-status");
  var bar = player.querySelector(".tts-progress span");

  // Bloques de texto a leer, en orden (sin pies de foto, botones, referencias, etc.)
  var EXCLUDE = "figure, .post-cta, .post-meta, .post-byline, .post-breadcrumb, .share-bar, .tts-player";
  var blocks = Array.prototype.filter.call(
    article.querySelectorAll("h1, .post-lead, h2, h3, p, li"),
    function (el) {
      if (el.closest(EXCLUDE)) return false;
      if (el.tagName === "P" && el.closest("li")) return false;
      return clean(el.textContent).length > 0;
    }
  );

  function clean(text) {
    return text
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")          // banderas
      .replace(/\p{Extended_Pictographic}/gu, "")       // emojis
      .replace(/[‍️]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Divide textos largos en frases (Chrome corta las locuciones muy largas)
  function chunks(text) {
    var parts = text.match(/[^.!?…:;]+[.!?…:;]*["”»]?\s*/g) || [text];
    var out = [], buf = "";
    parts.forEach(function (p) {
      if ((buf + p).length > 220 && buf) { out.push(buf.trim()); buf = ""; }
      buf += p;
    });
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  // Cola: [{el, text}]
  var queue = [];
  blocks.forEach(function (el) {
    var t = clean(el.textContent);
    if (/^H[1-3]$/.test(el.tagName) && !/[.!?:]$/.test(t)) t += ".";
    chunks(t).forEach(function (c) { queue.push({ el: el, text: c }); });
  });

  // Elegir voz en español latino; España solo como último recurso
  var PREF = ["es-419", "es-MX", "es-US", "es-CO", "es-AR", "es-CL", "es-PE", "es-VE", "es-NI", "es-CR", "es-GT", "es-HN", "es-SV", "es-PA", "es-DO", "es-PR", "es-UY", "es-EC", "es-BO", "es-PY", "es-CU"];
  var voice = null;

  function score(v) {
    var lang = (v.lang || "").replace("_", "-");
    var i = PREF.indexOf(lang);
    var s;
    if (i >= 0) s = 100 - i;
    else if (/^es/i.test(lang) && !/es-ES/i.test(lang)) s = 60;
    else if (/^es/i.test(lang)) s = 20;
    else return -1;
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 30;
    if (/google/i.test(v.name)) s += 15;
    return s;
  }

  function pickVoice() {
    var best = null, bestScore = -1;
    synth.getVoices().forEach(function (v) {
      var s = score(v);
      if (s > bestScore) { best = v; bestScore = s; }
    });
    voice = best;
  }
  pickVoice();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", pickVoice);
  else synth.onvoiceschanged = pickVoice;

  var idx = 0, state = "stopped", current = null, token = 0;

  function setStatus(text) { if (status) status.textContent = text; }
  function setButton() {
    btnPlay.setAttribute("aria-pressed", state === "playing" ? "true" : "false");
    btnPlay.querySelector(".tts-play-label").textContent =
      state === "playing" ? "Pausar" : (state === "paused" ? "Continuar" : "Escuchar el artículo");
    btnPlay.classList.toggle("is-playing", state === "playing");
    btnStop.hidden = state === "stopped";
  }
  function highlight(el) {
    if (current && current !== el) current.classList.remove("tts-active");
    current = el;
    if (el) el.classList.add("tts-active");
  }
  function progress() {
    if (bar) bar.style.width = (queue.length ? Math.round((idx / queue.length) * 100) : 0) + "%";
  }

  function speakNext() {
    if (state !== "playing") return;
    if (idx >= queue.length) { stop(true); return; }
    var item = queue[idx];
    var my = ++token;
    var u = new SpeechSynthesisUtterance(item.text);
    u.lang = voice ? voice.lang : "es-MX";
    if (voice) u.voice = voice;
    u.rate = parseFloat(selRate.value) || 1;
    u.onend = function () {
      if (my !== token || state !== "playing") return;
      idx++;
      progress();
      speakNext();
    };
    u.onerror = function (e) {
      if (my !== token || e.error === "interrupted" || e.error === "canceled") return;
      idx++;
      speakNext();
    };
    highlight(item.el);
    synth.speak(u);
  }

  function play() {
    if (!voice) pickVoice();
    state = "playing";
    setButton();
    setStatus(voice ? "Leyendo con la voz: " + voice.name : "Leyendo en español");
    synth.cancel();
    speakNext();
  }
  function pause() {
    // Pausa como "cancelar y recordar posición": funciona igual en todos los navegadores
    state = "paused";
    synth.cancel();
    setButton();
    setStatus("En pausa");
  }
  function stop(finished) {
    state = "stopped";
    synth.cancel();
    idx = 0;
    highlight(null);
    progress();
    setButton();
    setStatus(finished ? "Terminaste de escuchar el artículo." : "");
  }

  btnPlay.addEventListener("click", function () {
    if (state === "playing") pause(); else play();
  });
  btnStop.addEventListener("click", function () { stop(false); });
  selRate.addEventListener("change", function () {
    if (state === "playing") { synth.cancel(); speakNext(); }
  });
  window.addEventListener("pagehide", function () { synth.cancel(); });

  setButton();
})();
