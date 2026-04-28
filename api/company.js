var http = require("./_lib/http");
var store = require("./_lib/store");

module.exports = async function(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res);
  try {
    var db = await store.readDb();
    http.sendJson(res, 200, db.company);
  } catch (err) {
    http.sendJson(res, 500, { error: "Company load failed" });
  }
};
