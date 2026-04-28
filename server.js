var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");
var crypto = require("crypto");

var PORT = process.env.PORT || 3000;
var ROOT = __dirname;
var PUBLIC_DIR = path.join(ROOT, "public");
var ASSETS_DIR = path.join(ROOT, "assets");
var DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "db.json");
var PRESCRIPTION_DIR = path.join(path.dirname(DB_PATH), "prescriptions");
var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
var MAX_BODY_CHARS = 8 * 1024 * 1024;
var ADMIN_USERNAME = process.env.ADMIN_USERNAME || "rahul";
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
var ADMIN_COOKIE = "agarwal_admin";
var ADMIN_SESSION_MS = 24 * 60 * 60 * 1000;
var adminSessions = {};

var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
}

function sendJson(res, status, payload, extraHeaders) {
  var headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  Object.keys(extraHeaders || {}).forEach(function(key) {
    headers[key] = extraHeaders[key];
  });
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function collectBody(req, callback) {
  var body = "";
  req.on("data", function(chunk) {
    body += chunk;
    if (body.length > MAX_BODY_CHARS) {
      req.connection.destroy();
    }
  });
  req.on("end", function() {
    callback(body);
  });
}

function parseCookies(req) {
  var cookies = {};
  String(req.headers.cookie || "").split(";").forEach(function(pair) {
    var index = pair.indexOf("=");
    if (index === -1) return;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  });
  return cookies;
}

function createAdminToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getAdminToken(req) {
  return parseCookies(req)[ADMIN_COOKIE];
}

function isAdminAuthenticated(req) {
  var token = getAdminToken(req);
  var session = token && adminSessions[token];
  if (!session) return false;
  if (Date.now() - session.createdAt > ADMIN_SESSION_MS) {
    delete adminSessions[token];
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (isAdminAuthenticated(req)) return true;
  sendJson(res, 401, { error: "Admin login required" });
  return false;
}

function isInside(parent, child) {
  var relative = path.relative(parent, child);
  return relative && relative.indexOf("..") !== 0 && !path.isAbsolute(relative);
}

function serveFile(res, baseDir, requestPath) {
  var cleanPath = requestPath.split("?")[0];
  if (cleanPath === "/" || cleanPath === "") {
    cleanPath = "/index.html";
  }

  var filePath = path.normalize(path.join(baseDir, cleanPath));
  if (!isInside(baseDir, filePath) && filePath !== path.join(baseDir, "index.html")) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      sendError(res, 404, "Not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

function servePrescription(res, fileName) {
  ensureDir(PRESCRIPTION_DIR);
  var cleanName = path.basename(fileName || "");
  var filePath = path.join(PRESCRIPTION_DIR, cleanName);

  if (!cleanName || !isInside(PRESCRIPTION_DIR, filePath)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      sendError(res, 404, "Prescription not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Disposition": "inline; filename=\"" + cleanName.replace(/"/g, "") + "\""
    });
    res.end(data);
  });
}

function validateEnquiry(payload) {
  var errors = [];
  var name = payload.name || payload.customerName;
  var phone = payload.phone || payload.customerPhone;
  var email = String(payload.email || payload.customerEmail || "").trim();
  var pincode = normalizePincode(payload.pincode || payload.customerPincode);
  if (!name || String(name).trim().length < 2) errors.push("Name is required");
  if (!phone || String(phone).trim().length < 8) errors.push("Phone number is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email is required");
  if (!pincode || pincode.length !== 6) errors.push("Valid 6 digit PIN code is required");
  if (String(payload.patientType || "") === "Doctor referral" && !payload.prescription) {
    errors.push("Prescription upload is required for doctor referral");
  }
  return errors;
}

function normalizePincode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function lookupServiceArea(db, pincode) {
  var cleanPincode = normalizePincode(pincode);
  var areas = db.serviceAreas || [];
  for (var i = 0; i < areas.length; i += 1) {
    if (areas[i].pincode === cleanPincode) {
      return {
        pincode: cleanPincode,
        area: areas[i].area,
        rentAvailable: !!areas[i].rentAvailable,
        deliveryTime: areas[i].deliveryTime || "Contact for timing"
      };
    }
  }
  return {
    pincode: cleanPincode,
    area: "",
    rentAvailable: false,
    deliveryTime: "",
    message: "Rent service is not marked available for this PIN code"
  };
}

function extensionForMime(mimeType, fileName) {
  var lowerName = String(fileName || "").toLowerCase();
  if (mimeType === "application/pdf" || lowerName.lastIndexOf(".pdf") === lowerName.length - 4) return ".pdf";
  if (mimeType === "image/png" || lowerName.lastIndexOf(".png") === lowerName.length - 4) return ".png";
  if (mimeType === "image/webp" || lowerName.lastIndexOf(".webp") === lowerName.length - 5) return ".webp";
  if (mimeType === "image/jpeg" || lowerName.lastIndexOf(".jpg") === lowerName.length - 4 || lowerName.lastIndexOf(".jpeg") === lowerName.length - 5) return ".jpg";
  return "";
}

function savePrescription(enquiryId, upload) {
  if (!upload) return null;
  var match = String(upload.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid prescription upload");
  }

  var mimeType = match[1];
  var ext = extensionForMime(mimeType, upload.name);
  if (!ext) {
    throw new Error("Prescription must be an image or PDF");
  }

  var buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Prescription file must be under 5MB");
  }

  ensureDir(PRESCRIPTION_DIR);
  var fileName = enquiryId + "-prescription" + ext;
  var filePath = path.join(PRESCRIPTION_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    originalName: String(upload.name || "prescription" + ext),
    type: mimeType,
    size: buffer.length,
    path: path.relative(ROOT, filePath)
  };
}

function deletePrescriptionFile(prescription) {
  if (!prescription || !prescription.path) return;
  var cleanName = path.basename(String(prescription.path));
  var filePath = path.join(PRESCRIPTION_DIR, cleanName);
  if (!cleanName || !isInside(PRESCRIPTION_DIR, filePath)) return;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function handleApi(req, res, parsedUrl) {
  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/session") {
    sendJson(res, 200, { authenticated: isAdminAuthenticated(req) });
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/admin/login") {
    collectBody(req, function(body) {
      var payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (err) {
        sendError(res, 400, "Invalid JSON");
        return;
      }

      if (String(payload.username || "").trim().toLowerCase() !== ADMIN_USERNAME.toLowerCase() || String(payload.password || "") !== ADMIN_PASSWORD) {
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }

      var token = createAdminToken();
      adminSessions[token] = { createdAt: Date.now() };
      sendJson(res, 200, { message: "Logged in" }, {
        "Set-Cookie": ADMIN_COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400"
      });
    });
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/admin/logout") {
    var token = getAdminToken(req);
    if (token) delete adminSessions[token];
    sendJson(res, 200, { message: "Logged out" }, {
      "Set-Cookie": ADMIN_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname.indexOf("/api/prescriptions/") === 0) {
    if (!requireAdmin(req, res)) return;
    servePrescription(res, decodeURIComponent(parsedUrl.pathname.replace("/api/prescriptions/", "")));
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/company") {
    var companyDb = readDb();
    sendJson(res, 200, companyDb.company);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/service-area") {
    var areaDb = readDb();
    var areaResult = lookupServiceArea(areaDb, parsedUrl.query && parsedUrl.query.pincode);
    if (!areaResult.pincode || areaResult.pincode.length !== 6) {
      sendJson(res, 422, { errors: ["Valid 6 digit PIN code is required"] });
      return;
    }
    sendJson(res, 200, areaResult);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/products") {
    var db = readDb();
    var query = parsedUrl.query || {};
    var products = db.products.slice(0);

    if (query.mode && query.mode !== "all") {
      products = products.filter(function(product) {
        return product.mode.indexOf(query.mode) !== -1;
      });
    }
    if (query.category && query.category !== "all") {
      products = products.filter(function(product) {
        return product.category === query.category;
      });
    }
    if (query.search) {
      var needle = String(query.search).toLowerCase();
      products = products.filter(function(product) {
        return (
          product.name.toLowerCase().indexOf(needle) !== -1 ||
          product.category.toLowerCase().indexOf(needle) !== -1 ||
          product.audience.toLowerCase().indexOf(needle) !== -1
        );
      });
    }
    sendJson(res, 200, { products: products, categories: db.categories });
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/enquiries") {
    if (!requireAdmin(req, res)) return;
    var enquiryDb = readDb();
    sendJson(res, 200, { enquiries: enquiryDb.enquiries });
    return;
  }

  if (req.method === "DELETE" && parsedUrl.pathname.indexOf("/api/enquiries/") === 0) {
    if (!requireAdmin(req, res)) return;
    var enquiryId = decodeURIComponent(parsedUrl.pathname.replace("/api/enquiries/", ""));
    var deleteDb = readDb();
    var deleted = null;
    deleteDb.enquiries = (deleteDb.enquiries || []).filter(function(enquiry) {
      if (enquiry.id === enquiryId) {
        deleted = enquiry;
        return false;
      }
      return true;
    });

    if (!deleted) {
      sendError(res, 404, "Enquiry not found");
      return;
    }

    try {
      deletePrescriptionFile(deleted.prescription);
      writeDb(deleteDb);
    } catch (err) {
      sendError(res, 500, "Enquiry delete failed");
      return;
    }

    sendJson(res, 200, { deleted: deleted.id, message: "Enquiry deleted" });
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/enquiries") {
    collectBody(req, function(body) {
      var payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (err) {
        sendError(res, 400, "Invalid JSON");
        return;
      }

      var errors = validateEnquiry(payload);
      if (errors.length) {
        sendJson(res, 422, { errors: errors });
        return;
      }

      var db = readDb();
      var enquiryId = "ENQ-" + Date.now();
      var pincode = normalizePincode(payload.pincode || payload.customerPincode);
      var serviceArea = lookupServiceArea(db, pincode);
      var prescription = null;
      try {
        prescription = savePrescription(enquiryId, payload.prescription);
      } catch (err) {
        sendJson(res, 422, { errors: [err.message] });
        return;
      }

      var enquiry = {
        id: enquiryId,
        name: String(payload.name || payload.customerName).trim(),
        phone: String(payload.phone || payload.customerPhone).trim(),
        email: String(payload.email || payload.customerEmail || "").trim(),
        city: String(payload.city || payload.customerCity || "").trim(),
        pincode: pincode,
        serviceArea: serviceArea,
        patientType: String(payload.patientType || "Home patient").trim(),
        note: String(payload.note || "").trim(),
        items: payload.items || [],
        prescription: prescription,
        status: "New",
        createdAt: new Date().toISOString()
      };
      db.enquiries.unshift(enquiry);
      writeDb(db);
      sendJson(res, 201, { enquiry: enquiry, message: "Enquiry received" });
    });
    return;
  }

  sendError(res, 404, "API route not found");
}

var server = http.createServer(function(req, res) {
  var parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname.indexOf("/api/") === 0) {
    handleApi(req, res, parsedUrl);
    return;
  }

  if (parsedUrl.pathname.indexOf("/assets/") === 0) {
    serveFile(res, ASSETS_DIR, parsedUrl.pathname.replace("/assets", ""));
    return;
  }

  serveFile(res, PUBLIC_DIR, parsedUrl.pathname);
});

server.listen(PORT, function() {
  console.log("Agarwal Medical running at http://localhost:" + PORT);
});
