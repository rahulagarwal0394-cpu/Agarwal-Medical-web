var http = require("../_lib/http");

module.exports = function(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res);
  http.sendJson(res, 200, { message: "Logged out" }, {
    "Set-Cookie": http.clearAdminCookie()
  });
};
