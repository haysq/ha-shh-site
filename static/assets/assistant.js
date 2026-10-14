(function() {
  "use strict";

  if (typeof window === "undefined" || !window.ASSIST_T) {
    return;
  }

  var assistEl = document.getElementById("assist");
  if (!assistEl) {
    return;
  }

  var T = window.ASSIST_T;
  var kbUrl = assistEl.getAttribute("data-kb") || "";
  var docEl = document.documentElement;
  var pageLang = (docEl.getAttribute("lang") || "en").toLowerCase().slice(0, 2);

  var LOCALE_MAP = {
    en: "en-US",
    tr: "tr-TR",
    ar: "ar-SA",
    de: "de-DE",
    es: "es-ES",
    fr: "fr-FR",
    hi: "hi-IN",
    id: "id-ID",
    pt: "pt-BR",
    ru: "ru-RU"
  };

  var speechLocale = LOCALE_MAP[pageLang] || "en-US";

  function normalizeAndTokenize(text, lang) {
    if (!text) {
      return [];
    }
    var str = String(text);
    try {
      str = str.toLocaleLowerCase(lang);
    } catch (e) {
      str = str.toLowerCase();
    }
    str = str.replace(/[\u0131ı]/g, "i");
    if (typeof str.normalize === "function") {
      str = str.normalize("NFD");
    }
    str = str.replace(/[\u0300-\u036f]/g, "");

    var raw;
    try {
      raw = str.split(new RegExp("[^\\p{L}\\p{N}]+", "u"));
    } catch (e) {
      raw = str.split(/[\s.,;:!?()"«»“”\-\/]+/);
    }

    var tokens = [];
    for (var i = 0; i < raw.length; i++) {
      var tok = raw[i];
      if (tok && tok.length >= 2) {
        tokens.push(tok);
      }
    }
    return tokens;
  }

  function matchToken(q, e) {
    if (q === e) {
      return true;
    }
    if (q.length >= 4 && e.length >= 4) {
      if (q.indexOf(e) === 0 || e.indexOf(q) === 0) {
        return true;
      }
      // same stem with different suffixes (e.g. ogrenmek / ogrenmezsin): long common prefix
      var n = 0, max = Math.min(q.length, e.length);
      while (n < max && q.charAt(n) === e.charAt(n)) n++;
      if (n >= 5 && n >= max - 3) {
        return true;
      }
    }
    return false;
  }

  var kbEntries = null;
  var kbIndex = null;
  var kbLoading = false;
  var kbQueue = [];

  function buildIndex(entries) {
    var n = entries.length;
    var docTokens = [];
    var df = {};

    for (var i = 0; i < n; i++) {
      var entry = entries[i];
      var titleText = entry.t || "";
      if (entry.q && entry.q.length) {
        for (var j = 0; j < entry.q.length; j++) {
          titleText += " " + entry.q[j];
        }
      }
      var tTokens = normalizeAndTokenize(titleText, pageLang);
      var bTokens = normalizeAndTokenize(entry.a || "", pageLang);

      docTokens.push({
        title: tTokens,
        body: bTokens
      });

      var seen = {};
      for (var t = 0; t < tTokens.length; t++) {
        seen[tTokens[t]] = true;
      }
      for (var b = 0; b < bTokens.length; b++) {
        seen[bTokens[b]] = true;
      }

      for (var tok in seen) {
        if (Object.prototype.hasOwnProperty.call(seen, tok)) {
          df[tok] = (df[tok] || 0) + 1;
        }
      }
    }

    var idf = {};
    for (var tokenKey in df) {
      if (Object.prototype.hasOwnProperty.call(df, tokenKey)) {
        idf[tokenKey] = 1 + Math.log(n / df[tokenKey]);
      }
    }

    return {
      docTokens: docTokens,
      idf: idf
    };
  }

  function loadKB(callback) {
    if (kbEntries !== null) {
      if (callback) {
        callback(kbEntries);
      }
      return;
    }
    if (callback) {
      kbQueue.push(callback);
    }
    if (kbLoading) {
      return;
    }
    kbLoading = true;

    function onLoaded(data) {
      kbEntries = data || [];
      kbIndex = buildIndex(kbEntries);
      kbLoading = false;
      for (var k = 0; k < kbQueue.length; k++) {
        kbQueue[k](kbEntries);
      }
      kbQueue = [];
    }

    function onError() {
      onLoaded([]);
    }

    if (typeof window.fetch === "function") {
      window.fetch(kbUrl).then(function(res) {
        if (!res.ok) {
          throw new Error("Fetch failed");
        }
        return res.json();
      }).then(onLoaded, onError);
    } else {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", kbUrl, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                onLoaded(JSON.parse(xhr.responseText));
              } catch (e) {
                onError();
              }
            } else {
              onError();
            }
          }
        };
        xhr.send();
      } catch (e) {
        onError();
      }
    }
  }

  var fabBtn = document.createElement("button");
  fabBtn.type = "button";
  fabBtn.className = "assist-fab";
  fabBtn.setAttribute("aria-label", T.open || "Open");
  fabBtn.setAttribute("aria-expanded", "false");
  fabBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  var panelEl = document.createElement("div");
  panelEl.className = "assist-panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-label", T.title || "Assistant");
  panelEl.hidden = true;
  panelEl.style.display = "none";

  var headerEl = document.createElement("div");
  headerEl.className = "assist-header";

  var titleEl = document.createElement("div");
  titleEl.className = "assist-title";
  titleEl.textContent = T.title || "";
  headerEl.appendChild(titleEl);

  var speakBtn = document.createElement("button");
  speakBtn.type = "button";
  speakBtn.className = "assist-speak";

  var speakEnabled = false;
  try {
    speakEnabled = window.localStorage.getItem("assistSpeak") === "true";
  } catch (e) {}

  function updateSpeakButton() {
    // the labels describe the current state ("Read answers aloud: on/off"); the button shows a speaker icon
    var label = speakEnabled ? (T.speak_on || "Read aloud: on") : (T.speak_off || "Read aloud: off");
    speakBtn.setAttribute("aria-pressed", speakEnabled ? "true" : "false");
    speakBtn.setAttribute("aria-label", label);
    speakBtn.title = label;
    speakBtn.innerHTML = speakEnabled
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  }
  updateSpeakButton();

  if (!("speechSynthesis" in window)) {
    speakBtn.style.display = "none";
  } else {
    speakBtn.onclick = function() {
      speakEnabled = !speakEnabled;
      try {
        window.localStorage.setItem("assistSpeak", speakEnabled ? "true" : "false");
      } catch (e) {}
      if (!speakEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      updateSpeakButton();
    };
  }
  headerEl.appendChild(speakBtn);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "assist-close";
  closeBtn.setAttribute("aria-label", T.close || "Close");
  closeBtn.textContent = "×";
  headerEl.appendChild(closeBtn);
  panelEl.appendChild(headerEl);

  var logEl = document.createElement("div");
  logEl.className = "assist-log";
  logEl.setAttribute("aria-live", "polite");
  panelEl.appendChild(logEl);

  if (T.suggestions && T.suggestions.length) {
    var chipsRow = document.createElement("div");
    chipsRow.className = "assist-chips";
    for (var s = 0; s < T.suggestions.length; s++) {
      (function(suggestionText) {
        var chipBtn = document.createElement("button");
        chipBtn.type = "button";
        chipBtn.className = "assist-chip";
        chipBtn.textContent = suggestionText;
        chipBtn.onclick = function() {
          handleQuery(suggestionText);
        };
        chipsRow.appendChild(chipBtn);
      })(T.suggestions[s]);
    }
    panelEl.appendChild(chipsRow);
  }

  var formEl = document.createElement("form");
  formEl.className = "assist-form";

  var inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.className = "assist-input";
  inputEl.setAttribute("placeholder", T.placeholder || "");
  inputEl.setAttribute("aria-label", T.placeholder || "Message");
  formEl.appendChild(inputEl);

  var micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.className = "assist-mic";
  micBtn.setAttribute("aria-label", T.mic || "Mic");
  micBtn.setAttribute("aria-pressed", "false");
  micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>';

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var isListening = false;

  function stopListening() {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
    isListening = false;
    micBtn.className = "assist-mic";
    micBtn.setAttribute("aria-pressed", "false");
    micBtn.setAttribute("aria-label", T.mic || "Mic");
  }

  function startListening() {
    if (!SpeechRecognition) {
      return;
    }
    try {
      recognition = new SpeechRecognition();
      recognition.lang = speechLocale;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = function(event) {
        if (event.results && event.results.length > 0 && event.results[0].length > 0) {
          var transcript = event.results[0][0].transcript;
          inputEl.value = transcript;
          stopListening();
          submitForm();
        }
      };

      recognition.onerror = function() {
        stopListening();
      };

      recognition.onend = function() {
        stopListening();
      };

      recognition.start();
      isListening = true;
      micBtn.className = "assist-mic on";
      micBtn.setAttribute("aria-pressed", "true");
      micBtn.setAttribute("aria-label", T.mic_off || "Stop listening");
    } catch (e) {
      stopListening();
    }
  }

  if (!SpeechRecognition) {
    micBtn.style.display = "none";
  } else {
    micBtn.onclick = function() {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    };
  }
  formEl.appendChild(micBtn);

  var sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.className = "assist-send";
  sendBtn.setAttribute("aria-label", T.send || "Send");
  sendBtn.textContent = T.send || "Send";
  formEl.appendChild(sendBtn);
  panelEl.appendChild(formEl);

  if (T.voice_note) {
    var noteEl = document.createElement("div");
    noteEl.className = "assist-note";
    noteEl.textContent = T.voice_note;
    panelEl.appendChild(noteEl);
  }

  assistEl.appendChild(fabBtn);
  assistEl.appendChild(panelEl);

  function speakText(text) {
    if (!speakEnabled || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      var utt = new window.SpeechSynthesisUtterance(text);
      utt.lang = speechLocale;
      window.speechSynthesis.speak(utt);
    } catch (e) {}
  }

  function scrollToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
  }

  function addUserMessage(text) {
    var msgDiv = document.createElement("div");
    msgDiv.className = "assist-msg me";
    msgDiv.textContent = text;
    logEl.appendChild(msgDiv);
    scrollToBottom();
  }

  function addAssistantPlainMessage(text) {
    var msgDiv = document.createElement("div");
    msgDiv.className = "assist-msg bot";
    msgDiv.textContent = text;
    logEl.appendChild(msgDiv);
    scrollToBottom();
  }

  function addNothingMessage(text) {
    var msgDiv = document.createElement("div");
    msgDiv.className = "assist-msg bot";
    msgDiv.appendChild(document.createTextNode(text));
    if (typeof window.haAssistFeedback === "function" && T.fb_btn) {
      var row = document.createElement("div");
      row.className = "assist-related";
      var fb = document.createElement("button");
      fb.type = "button";
      fb.className = "assist-chip";
      fb.textContent = T.fb_btn;
      fb.onclick = function() { window.haAssistFeedback(); };
      row.appendChild(fb);
      msgDiv.appendChild(row);
    }
    logEl.appendChild(msgDiv);
    scrollToBottom();
  }

  function isFiller(text) {
    var f = String(T.filler || "").split("|");
    var x = text.toLocaleLowerCase(pageLang).replace(/[.!?¿¡,،؟।…\s]+/g, " ").trim();
    for (var i = 0; i < f.length; i++) {
      if (x === String(f[i]).toLocaleLowerCase(pageLang)) return true;
    }
    return false;
  }

  function renderAnswer(entry, relatedEntries) {
    var msgDiv = document.createElement("div");
    msgDiv.className = "assist-msg bot";

    var titleStrong = document.createElement("strong");
    titleStrong.textContent = entry.t || "";
    msgDiv.appendChild(titleStrong);

    var bodyDiv = document.createElement("div");
    bodyDiv.textContent = entry.a || "";
    msgDiv.appendChild(bodyDiv);

    if (entry.url) {
      var moreLink = document.createElement("a");
      try { moreLink.href = new URL(entry.url, new URL(kbUrl.replace(/kb\.json$/, ""), location.href)).href; }
      catch (e) { moreLink.href = entry.url; }
      moreLink.textContent = T.more || "More";
      msgDiv.appendChild(moreLink);
    }

    if (relatedEntries && relatedEntries.length > 0) {
      var relContainer = document.createElement("div");
      relContainer.className = "assist-related";

      var relLabel = document.createElement("div");
      relLabel.textContent = T.related || "Related";
      relContainer.appendChild(relLabel);

      for (var r = 0; r < relatedEntries.length; r++) {
        (function(rel) {
          var relBtn = document.createElement("button");
          relBtn.type = "button";
          relBtn.className = "assist-chip";
          relBtn.textContent = rel.t || "";
          relBtn.onclick = function() {
            renderAnswer(rel, null);
          };
          relContainer.appendChild(relBtn);
        })(relatedEntries[r]);
      }
      msgDiv.appendChild(relContainer);
    }
    if (entry.act === "feedback" && typeof window.haAssistFeedback === "function") {
      setTimeout(function() { window.haAssistFeedback(); }, 0);
    }

    logEl.appendChild(msgDiv);
    scrollToBottom();

    var speechText = (entry.t || "") + ". " + (entry.a || "");
    speakText(speechText);
  }

  function handleQuery(queryText) {
    var trimmed = queryText.replace(/^\s+|\s+$/g, "");
    if (!trimmed) {
      return;
    }
    addUserMessage(trimmed);

    if (isFiller(trimmed)) {
      addNothingMessage(T.hint || T.nothing || "");
      return;
    }

    loadKB(function() {
      var qTokens = normalizeAndTokenize(trimmed, pageLang);
      if (!qTokens.length || !kbEntries.length) {
        addAssistantPlainMessage(T.nothing || "No results");
        return;
      }

      var uniqueQ = [];
      var seenQ = {};
      for (var k = 0; k < qTokens.length; k++) {
        if (!seenQ[qTokens[k]]) {
          seenQ[qTokens[k]] = true;
          uniqueQ.push(qTokens[k]);
        }
      }

      // ignore very short words (question particles like "mi", "is") when the question has longer words
      var longQ = uniqueQ.filter(function(w) { return w.length >= 3; });
      if (longQ.length) uniqueQ = longQ;
      var TYPE_WEIGHT = { faq: 1.25, guide: 1.25, fix: 1.25, feature: 1.1, mode: 1.1, action: 1, privacy: 1, news: 0.6 };

      var scored = [];
      for (var i = 0; i < kbEntries.length; i++) {
        var doc = kbIndex.docTokens[i];
        var totalScore = 0;

        for (var q = 0; q < uniqueQ.length; q++) {
          var qTok = uniqueQ[q];
          var bestTitleIDF = 0;

          for (var t = 0; t < doc.title.length; t++) {
            var tTok = doc.title[t];
            if (matchToken(qTok, tTok)) {
              var tVal = kbIndex.idf[tTok] || 1;
              if (tVal > bestTitleIDF) {
                bestTitleIDF = tVal;
              }
            }
          }

          if (bestTitleIDF > 0) {
            totalScore += bestTitleIDF * 3;
          } else {
            var bestBodyIDF = 0;
            for (var b = 0; b < doc.body.length; b++) {
              var bTok = doc.body[b];
              if (matchToken(qTok, bTok)) {
                var bVal = kbIndex.idf[bTok] || 1;
                if (bVal > bestBodyIDF) {
                  bestBodyIDF = bVal;
                }
              }
            }
            if (bestBodyIDF > 0) {
              totalScore += bestBodyIDF * 1;
            }
          }
        }

        totalScore *= kbEntries[i].recent ? 0.95 : (TYPE_WEIGHT[kbEntries[i].type] || 1);
        if (totalScore > 0) {
          scored.push({
            entry: kbEntries[i],
            score: totalScore
          });
        }
      }

      scored.sort(function(a, b) {
        return b.score - a.score;
      });

      if (!scored.length || scored[0].score < 1.2) {
        addNothingMessage(T.nothing || "No results");
        return;
      }

      var bestEntry = scored[0].entry;
      var bestScore = scored[0].score;
      var related = [];

      for (var idx = 1; idx < scored.length && related.length < 2; idx++) {
        if (scored[idx].score >= bestScore * 0.4) {
          related.push(scored[idx].entry);
        }
      }

      renderAnswer(bestEntry, related);
    });
  }

  function submitForm() {
    var val = inputEl.value;
    inputEl.value = "";
    handleQuery(val);
  }

  formEl.onsubmit = function(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    submitForm();
    return false;
  };

  var hasOpened = false;

  function openPanel() {
    panelEl.hidden = false;
    panelEl.style.display = "";
    fabBtn.setAttribute("aria-expanded", "true");
    if (!hasOpened) {
      hasOpened = true;
      loadKB();
      if (T.hello) {
        addAssistantPlainMessage(T.hello);
      }
    }
    setTimeout(function() {
      inputEl.focus();
    }, 50);
  }

  function closePanel() {
    panelEl.hidden = true;
    panelEl.style.display = "none";
    fabBtn.setAttribute("aria-expanded", "false");
    stopListening();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    fabBtn.focus();
  }

  function togglePanel() {
    if (panelEl.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  fabBtn.onclick = function() {
    togglePanel();
  };

  closeBtn.onclick = function() {
    closePanel();
  };

  document.addEventListener("keydown", function(e) {
    var key = e.key || e.keyCode;
    if (key === "Escape" || key === "Esc" || key === 27) {
      if (!panelEl.hidden) {
        closePanel();
      }
    }
  });
})();
