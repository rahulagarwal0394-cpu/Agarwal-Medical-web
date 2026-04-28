var http = require("./_lib/http");
var store = require("./_lib/store");
var business = require("./_lib/business");

module.exports = async function(req, res) {
  try {
    if (req.method === "GET") {
      if (!http.requireAdmin(req, res)) return;
      var readDb = await store.readDb();
      var enquiries = (readDb.enquiries || []).map(business.cleanEnquiry);
      http.sendJson(res, 200, { enquiries: enquiries });
      return;
    }

    if (req.method === "POST") {
      var payload = await http.parseBody(req);
      var errors = business.validateEnquiry(payload);
      if (errors.length) {
        http.sendJson(res, 422, { errors: errors });
        return;
      }

      var db = await store.readDb();
      db.enquiries = db.enquiries || [];
      var enquiry = business.createEnquiry(db, payload);
      db.enquiries.unshift(enquiry);
      await store.writeDb(db);
      http.sendJson(res, 201, { enquiry: business.cleanEnquiry(enquiry), message: "Enquiry received" });
      return;
    }

    http.methodNotAllowed(res);
  } catch (err) {
    http.sendJson(res, 500, { error: err.message || "Enquiry request failed" });
  }
};
