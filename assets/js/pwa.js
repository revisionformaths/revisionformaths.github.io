(function () {
  "use strict";
  var installButton = document.querySelector("[data-install]");
  var installPrompt = null;
  if (installButton) {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault(); installPrompt = event; installButton.hidden = false;
    });
    installButton.addEventListener("click", function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.finally(function () { installPrompt = null; installButton.hidden = true; });
    });
    window.addEventListener("appinstalled", function () { installButton.hidden = true; });
  }
  if (!("serviceWorker" in navigator) || (location.protocol !== "https:" && location.hostname !== "localhost")) return;
  var workerUrl = new URL("sw.js", location.href);
  navigator.serviceWorker.register(workerUrl.href, { scope: new URL("./", location.href).pathname }).catch(function () {});
  function send(type, path) {
    return navigator.serviceWorker.ready.then(function (registration) {
      var worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      if (!worker) throw new Error("Offline support is not ready yet. Reload and try again.");
      return new Promise(function (resolve, reject) {
        var channel = new MessageChannel();
        var timer = setTimeout(function () { reject(new Error("No response from offline storage")); }, 180000);
        channel.port1.onmessage = function (event) { clearTimeout(timer); event.data && event.data.ok ? resolve(event.data) : reject(new Error(event.data && event.data.error || "Offline storage failed")); };
        worker.postMessage({ type: type, path: path }, [channel.port2]);
      });
    });
  }
  window.ClassroomOffline = {
    save: function (path) { return send("CACHE_GAME", path); },
    remove: function (path) { return send("REMOVE_GAME", path); },
    check: function (path) { return send("CHECK_GAME", path); },
    clearAll: function () { return send("CLEAR_GAMES", ""); }
  };
  /* Save every file at once.

     The library is 129 files and they are all served from this origin, so a
     browser that has them can open the site with the network off - or with a
     filter answering in its place. The worker holds the copies; this only asks
     for them one at a time and says how far it has got. */
  var saveAll = document.querySelector("[data-save-all]");
  var saveAllStatus = document.querySelector("[data-save-all-status]");
  function sayAll(text) { if (saveAllStatus) saveAllStatus.textContent = text; }

  if (saveAll) {
    saveAll.addEventListener("click", function () {
      var files = (window.LOCAL_GAMES || []).map(function (entry) { return entry.file; }).filter(Boolean);
      if (!files.length) { sayAll("The list of files has not loaded; reload and try again."); return; }
      var label = saveAll.querySelector("span") || saveAll;
      var total = files.length;
      var kept = 0, failed = 0, index = 0;
      saveAll.disabled = true;
      label.textContent = "Saving...";
      sayAll("Starting: 0 of " + total);

      function done() {
        saveAll.disabled = false;
        label.textContent = "Save all for offline";
        if (!failed) {
          sayAll("All " + total + " files are on this device. This page now opens with the network off.");
        } else {
          sayAll(
            (total - failed) + " of " + total + " files are on this device. " +
            failed + " could not be saved - usually this browser has run out of space. " +
            "Files already open offline; the rest still need the network."
          );
        }
      }

      function step() {
        if (index >= total) { done(); return; }
        var file = files[index];
        index += 1;
        send("CHECK_GAME", file).then(function (result) {
          if (result && result.cached) { kept += 1; return; }
          return send("CACHE_GAME", file).then(function () { kept += 1; }, function () { failed += 1; });
        }, function () { failed += 1; }).then(function () {
          sayAll("Saved " + kept + " of " + total + (failed ? " · " + failed + " failed" : ""));
          step();
        });
      }

      step();
    });
    if (navigator.storage && navigator.storage.persist) {
      // Ask the browser not to throw the copies away when space gets tight.
      navigator.storage.persist().catch(function () {});
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-clear-offline]"), function (button) {
    button.addEventListener("click", function () {
      if (!window.confirm("Remove all locally downloaded G@M£$ files from this browser? Saved picks and history will not be changed.")) return;
      button.disabled = true;
      send("CLEAR_GAMES", "").then(function () { window.alert("Offline G@M£$ downloads cleared from this browser."); })
        .catch(function (error) { window.alert(error.message); })
        .finally(function () { button.disabled = false; });
    });
  });
}());
