var http = require("../_lib/http");
var store = require("../_lib/store");

module.exports = async function(req, res) {
  if (req.method !== "DELETE") return http.methodNotAllowed(res);
  if (!http.requireAdmin(req, res)) return;

  try {
    var enquiryId = req.query && req.query.id;
    var db = await store.readDb();
    var deleted = null;
    db.enquiries = (db.enquiries || []).filter(function(enquiry) {
      if (enquiry.id === enquiryId) {
        deleted = enquiry;
        return false;
      }
      return true;
    });

    if (!deleted) {
      http.sendJson(res, 404, { error: "Enquiry not found" });
      return;
    }

    await store.writeDb(db);
    http.sendJson(res, 200, { deleted: deleted.id, message: "Enquiry deleted" });
  } catch (err) {
    http.sendJson(res, 500, { error: "Enquiry delete failed" });
  }
};
