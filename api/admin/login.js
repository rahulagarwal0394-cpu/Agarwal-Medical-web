var http = require("../_lib/http");

module.exports = async function(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res);
  try {
    var payload = await http.parseBody(req);
    var expectedUsername = process.env.ADMIN_USERNAME || "rahul";
    var expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (String(payload.username || "").trim().toLowerCase() !== expectedUsername.toLowerCase() || String(payload.password || "") !== expectedPassword) {
      http.sendJson(res, 401, { error: "Invalid username or password" });
      return;
    }

    http.sendJson(res, 200, { message: "Logged in" }, {
      "Set-Cookie": http.createAdminCookie(expectedUsername)
    });
  } catch (err) {
    http.sendJson(res, 400, { error: err.message || "Login failed" });
  }
};
