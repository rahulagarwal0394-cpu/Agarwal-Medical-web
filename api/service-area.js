var http = require("./_lib/http");
var store = require("./_lib/store");
var business = require("./_lib/business");

module.exports = async function(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res);
  try {
    var db = await store.readDb();
    var result = business.lookupServiceArea(db, req.query && req.query.pincode);
    if (!result.pincode || result.pincode.length !== 6) {
      http.sendJson(res, 422, { errors: ["Valid 6 digit PIN code is required"] });
      return;
    }
    http.sendJson(res, 200, result);
  } catch (err) {
    http.sendJson(res, 500, { error: "PIN code check failed" });
  }
};
