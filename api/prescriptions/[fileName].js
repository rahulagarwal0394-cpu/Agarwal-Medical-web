var path = require("path");
var http = require("../_lib/http");
var store = require("../_lib/store");

module.exports = async function(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res);
  if (!http.requireAdmin(req, res)) return;

  try {
    var fileName = path.basename(String(req.query && req.query.fileName || ""));
    var db = await store.readDb();
    var found = null;
    (db.enquiries || []).some(function(enquiry) {
      var prescription = enquiry.prescription;
      if (!prescription) return false;
      var storedName = prescription.fileName || path.basename(String(prescription.path || ""));
      if (storedName === fileName) {
        found = prescription;
        return true;
      }
      return false;
    });

    if (!found || !found.dataUrl) {
      http.sendJson(res, 404, { error: "Prescription not found" });
      return;
    }

    var match = String(found.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      http.sendJson(res, 404, { error: "Prescription not found" });
      return;
    }

    var buffer = Buffer.from(match[2], "base64");
    res.writeHead(200, {
      "Content-Type": found.type || match[1] || "application/octet-stream",
      "Content-Disposition": "inline; filename=\"" + fileName.replace(/"/g, "") + "\"",
      "Cache-Control": "no-store"
    });
    res.end(buffer);
  } catch (err) {
    http.sendJson(res, 500, { error: "Prescription load failed" });
  }
};
