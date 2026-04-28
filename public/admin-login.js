(function() {
  var form = document.getElementById("adminLoginForm");
  var username = document.getElementById("adminUsername");
  var password = document.getElementById("adminPassword");
  var status = document.getElementById("loginStatus");

  function api(path, options) {
    return fetch(path, options).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) throw data;
        return data;
      });
    });
  }

  api("/api/admin/session")
    .then(function(data) {
      if (data.authenticated) {
        window.location.href = "/admin.html";
      }
    })
    .catch(function() {});

  form.addEventListener("submit", function(event) {
    event.preventDefault();
    status.textContent = "Logging in...";
    api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value
      })
    })
      .then(function() {
        window.location.href = "/admin.html";
      })
      .catch(function(error) {
        status.textContent = error && error.error ? error.error : "Login failed.";
      });
  });
}());
