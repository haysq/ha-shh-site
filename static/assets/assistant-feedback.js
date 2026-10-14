/* Assistant feedback: after a conversation, ask whether to send it to the team (only with consent).
   Sends questions and answers to /feedback.php; if that fails, offers an email with the same text. */
(function () {
  "use strict";
  var T = window.ASSIST_T, box = document.getElementById("assist");
  if (!T || !box || !T.fb_ask) return;
  var asked = false, sent = false;

  function msgs() {
    var out = [];
    box.querySelectorAll(".assist-log .assist-msg").forEach(function (m) {
      if (m.classList.contains("assist-fb")) return;
      out.push({ who: m.classList.contains("me") ? "me" : "bot", text: (m.innerText || "").slice(0, 2000) });
    });
    return out;
  }
  function userCount() { return box.querySelectorAll(".assist-log .assist-msg.me").length; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function mailLink(list, note) {
    var body = list.map(function (m) { return (m.who === "me" ? "> " : "") + m.text; }).join("\n\n");
    if (note) body = note + "\n\n---\n" + body;
    var a = el("a", "", T.fb_mail);
    a.href = "mailto:hey@ha-shh.com?subject=" + encodeURIComponent(T.title) + "&body=" + encodeURIComponent(body.slice(0, 1800));
    return a;
  }

  function ask() {
    var log = box.querySelector(".assist-log");
    if (!log || sent || box.querySelector(".assist-fb")) return;
    asked = true;
    var card = el("div", "assist-msg bot assist-fb");
    card.appendChild(el("p", "", T.fb_ask));
    var note = el("textarea");
    note.rows = 2;
    note.maxLength = 1000;
    note.placeholder = T.fb_note;
    note.setAttribute("aria-label", T.fb_note);
    var hp = el("input");                       // honeypot for bots; people never see it
    hp.type = "text"; hp.tabIndex = -1; hp.autocomplete = "off"; hp.className = "assist-hp"; hp.setAttribute("aria-hidden", "true");
    var row = el("div", "assist-fb-row");
    var yes = el("button", "assist-fb-yes", T.fb_send), no = el("button", "assist-fb-no", T.fb_no);
    yes.type = no.type = "button";
    row.appendChild(yes); row.appendChild(no);
    card.appendChild(note); card.appendChild(hp); card.appendChild(row);
    log.appendChild(card);
    log.scrollTop = log.scrollHeight;
    no.addEventListener("click", function () { card.remove(); });
    yes.addEventListener("click", function () {
      var list = msgs(), text = note.value.trim();
      yes.disabled = no.disabled = true;
      var payload = { consent: true, lang: (document.documentElement.lang || "en").slice(0, 2), page: location.pathname.slice(0, 200), msgs: list.slice(-60), note: text, hp: hp.value };
      var root = (box.getAttribute("data-kb") || "kb.json").replace(/[a-z]{2}\/kb\.json$/, "");
      fetch(root + "feedback.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "omit" })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error("fail");
          sent = true;
          card.textContent = T.fb_ok;
        })
        .catch(function () {
          card.textContent = "";
          card.appendChild(el("p", "", T.fb_fail));
          card.appendChild(mailLink(list, text));
        });
    });
  }

  window.haAssistFeedback = function () { if (userCount()) ask(); };

  // a "send this conversation" button in the header, and one offer when closing after a real conversation
  var tries = 0, timer = setInterval(function () {
    var head = box.querySelector(".assist-header"), close = box.querySelector(".assist-close");
    if (head && close) {
      clearInterval(timer);
      var b = el("button", "assist-fb-btn");
      b.type = "button"; b.title = T.fb_btn; b.setAttribute("aria-label", T.fb_btn);
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"/><path d="M9 9h6M9 12h4"/></svg>';
      head.insertBefore(b, close);
      b.addEventListener("click", function () { if (userCount()) ask(); });
      close.addEventListener("click", function (e) {
        if (!asked && !sent && userCount() >= 2) { e.preventDefault(); e.stopImmediatePropagation(); ask(); }
      }, true);
    } else if (++tries > 600) clearInterval(timer);
  }, 500);
})();
