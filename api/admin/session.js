var http = require("../_lib/http");

module.exports = function(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res);
  http.sendJson(res, 200, { authenticated: http.isAdminAuthenticated(req) });
};
