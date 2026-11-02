/* Feedback: asks two questions, then hands the answer to GitHub as an issue.
   Nothing is sent from this page, so there is no endpoint, no address and no
   analytics on the way out. The dialog is built here and injected once, which
   keeps both pages' markup identical and lets the footer link work without it
   (it falls back to GitHub's own issue chooser). */
(function () {
  "use strict";

  var REPO = "funclassroom/funclassroom.github.io";
  var NEW_ISSUE = "https://github.com/" + REPO + "/issues/new";
  var ISSUES = "https://github.com/" + REPO + "/issues";

  var dialog = null;
  var sheet = null;
  var form = null;
  var gameField = null;
  var linkField = null;
  var messageLabel = null;
  var messageBox = null;
  var gameBox = null;
  var linkBox = null;
  var errorLine = null;
  var noteLine = null;
  var lastFocus = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function firstLine(text, max) {
    var line = String(text || "").split("\n")[0].replace(/\s+/g, " ").trim();
    if (line.length > max) line = line.slice(0, max - 1).trim() + "…";
    return line;
  }

  function build() {
    dialog = el("div", "fb");
    dialog.hidden = true;
    dialog.setAttribute("data-feedback-dialog", "");
    dialog.innerHTML =
      '<div class="fb-sheet" role="dialog" aria-modal="true" aria-labelledby="fb-title">' +
        '<button type="button" class="fb-close" data-fb-cancel aria-label="Close feedback">' +
          '<svg class="ico" aria-hidden="true"><use href="#i-close"/></svg>' +
        "</button>" +
        '<p class="fb-kicker">Feedback</p>' +
        '<h2 class="fb-title" id="fb-title">Tell me what to change</h2>' +
        '<p class="fb-lede">This opens a GitHub issue in a new tab, with what you type already in it. ' +
          "Nothing is sent from this page. You need a free GitHub account to post it.</p>" +
        '<form class="fb-form" novalidate>' +
          '<fieldset class="fb-kinds">' +
            '<legend>What is it about?</legend>' +
            '<label class="fb-kind is-on"><input type="radio" name="fb-kind" value="bug" checked><span>Something is broken</span></label>' +
            '<label class="fb-kind"><input type="radio" name="fb-kind" value="request"><span>Request a G@M£$</span></label>' +
          "</fieldset>" +
          '<label class="fb-field" data-fb-game hidden>' +
            '<span>Which G@M£$?</span>' +
            '<input name="fb-game" type="text" maxlength="120" autocomplete="off" placeholder="e.g. Bloons TD 5">' +
          "</label>" +
          '<label class="fb-field" data-fb-link hidden>' +
            '<span>Where can I play it? <em>(optional)</em></span>' +
            '<input name="fb-link" type="url" maxlength="400" autocomplete="off" placeholder="https://…">' +
          "</label>" +
          '<label class="fb-field">' +
            '<span data-fb-message-label>What happened?</span>' +
            '<textarea name="fb-message" rows="5" maxlength="2000" placeholder="What did you click, what did you expect, what did it do?"></textarea>' +
          "</label>" +
          '<p class="fb-error" data-fb-error role="alert" hidden></p>' +
          '<p class="fb-note" data-fb-note aria-live="polite" hidden></p>' +
          '<div class="fb-actions">' +
            '<button type="button" class="fb-cancel" data-fb-cancel>Cancel</button>' +
            '<button type="submit" class="fb-send">Open GitHub issue</button>' +
          "</div>" +
          '<p class="fb-alt">Want to look first? <a href="' + ISSUES + '" target="_blank" rel="noopener">See what has already been reported</a>.</p>' +
        "</form>" +
      "</div>";

    document.body.appendChild(dialog);

    sheet = dialog.querySelector(".fb-sheet");
    form = dialog.querySelector(".fb-form");
    gameField = dialog.querySelector("[data-fb-game]");
    linkField = dialog.querySelector("[data-fb-link]");
    gameBox = form.elements["fb-game"];
    linkBox = form.elements["fb-link"];
    messageBox = form.elements["fb-message"];
    messageLabel = dialog.querySelector("[data-fb-message-label]");
    errorLine = dialog.querySelector("[data-fb-error]");
    noteLine = dialog.querySelector("[data-fb-note]");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      send();
    });

    Array.prototype.forEach.call(dialog.querySelectorAll("[data-fb-cancel]"), function (button) {
      button.addEventListener("click", close);
    });

    Array.prototype.forEach.call(dialog.querySelectorAll('input[name="fb-kind"]'), function (radio) {
      radio.addEventListener("change", function () {
        syncKind();
      });
    });

    dialog.addEventListener("mousedown", function (event) {
      if (event.target === dialog) close();
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      var parts = Array.prototype.filter.call(
        sheet.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])'),
        function (node) { return node.offsetParent !== null; }
      );
      if (!parts.length) return;
      var first = parts[0];
      var last = parts[parts.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function kind() {
    var picked = form.querySelector('input[name="fb-kind"]:checked');
    return picked ? picked.value : "bug";
  }

  function syncKind() {
    var request = kind() === "request";
    gameField.hidden = !request;
    linkField.hidden = !request;
    messageLabel.textContent = request ? "Why this one? (optional)" : "What happened?";
    messageBox.placeholder = request
      ? "What would you like to play it on — a Chromebook, a phone?"
      : "What did you click, what did you expect, what did it do?";
    Array.prototype.forEach.call(dialog.querySelectorAll(".fb-kind"), function (label) {
      label.classList.toggle("is-on", label.querySelector("input").checked);
    });
    errorLine.hidden = true;
  }

  function send() {
    var request = kind() === "request";
    var game = gameBox.value.trim();
    var link = linkBox.value.trim();
    var message = messageBox.value.trim();
    var page = window.location.href;

    if (request && game.length < 2) {
      errorLine.textContent = "Which G@M£$ would you like?";
      errorLine.hidden = false;
      gameBox.focus();
      return;
    }
    if (!request && message.length < 8) {
      errorLine.textContent = "Add a sentence about what went wrong, so there is something to act on.";
      errorLine.hidden = false;
      messageBox.focus();
      return;
    }

    var params = new URLSearchParams();
    var title;
    var body;

    if (request) {
      title = "[G@M£$ request] " + firstLine(game, 70);
      body =
        "### G@M£$\n" + game + "\n\n" +
        "### Why\n" + (message || "—") + "\n\n" +
        "### Where to play it\n" + (link || "—") + "\n\n" +
        "---\nRequested from " + page;
      params.set("labels", "game-request");
    } else {
      title = "[Bug] " + firstLine(message, 70);
      body =
        "### What happened\n" + message + "\n\n" +
        "### Page\n" + page + "\n\n" +
        "### Browser\n" + (window.navigator.userAgent || "—");
      params.set("labels", "bug");
    }

    params.set("title", title);
    params.set("body", body);

    var url = NEW_ISSUE + "?" + params.toString();

    try {
      window.open(url, "_blank", "noopener");
    } catch (err) {
      /* caught below by the fallback link */
    }

    errorLine.hidden = true;
    noteLine.hidden = false;
    noteLine.textContent = "Opened GitHub in a new tab. ";
    var again = el("a", null, "Open it again");
    again.href = url;
    again.target = "_blank";
    again.rel = "noopener";
    noteLine.appendChild(again);
    noteLine.appendChild(document.createTextNode(" if the tab did not appear."));
  }

  function open() {
    if (!dialog) build();
    lastFocus = document.activeElement;
    dialog.hidden = false;
    document.body.classList.add("fb-locked");
    noteLine.hidden = true;
    errorLine.hidden = true;
    syncKind();
    var target = kind() === "request" ? gameBox : messageBox;
    target.focus();
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove("fb-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest ? event.target.closest("[data-feedback]") : null;
    if (!trigger) return;
    /* A modified click is a request to open the link, not the dialog. */
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open();
  });

  window.FEEDBACK = { open: open, close: close, issueUrl: NEW_ISSUE };
})();
