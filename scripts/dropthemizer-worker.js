//dropthemizer-worker.js
self.addEventListener("message", function(e) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            self.postMessage(this.responseText);
        }
    };
    xhttp.open("GET", "/api/optimize/?url=" + e.data, true);
    xhttp.send();
});