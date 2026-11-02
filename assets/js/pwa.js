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
