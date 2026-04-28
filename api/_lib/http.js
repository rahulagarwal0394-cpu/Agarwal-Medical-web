var crypto = require("crypto");

var ADMIN_COOKIE = "agarwal_admin";
var ADMIN_SESSION_MS = 24 * 60 * 60 * 1000;

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

function parseBody(req) {
  return new Promise(function(resolve, reject) {
    var body = "";
    req.on("data", function(chunk) {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", function() {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
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

function adminSecret() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
}

function sign(value) {
  return crypto.createHmac("sha256", adminSecret()).update(value).digest("hex");
}

function createAdminCookie(username) {
  var expires = Date.now() + ADMIN_SESSION_MS;
  var payload = username + "." + expires;
  var token = Buffer.from(payload).toString("base64url") + "." + sign(payload);
  return ADMIN_COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400";
}

function clearAdminCookie() {
  return ADMIN_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function isAdminAuthenticated(req) {
  var token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return false;
  var parts = token.split(".");
  if (parts.length !== 2) return false;

  var payload;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch (err) {
    return false;
  }

  if (sign(payload) !== parts[1]) return false;
  var payloadParts = payload.split(".");
  var expires = Number(payloadParts[payloadParts.length - 1]);
  return expires && Date.now() < expires;
}

function requireAdmin(req, res) {
  if (isAdminAuthenticated(req)) return true;
  sendJson(res, 401, { error: "Admin login required" });
  return false;
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: "Method not allowed" });
}

module.exports = {
  clearAdminCookie: clearAdminCookie,
  createAdminCookie: createAdminCookie,
  isAdminAuthenticated: isAdminAuthenticated,
  methodNotAllowed: methodNotAllowed,
  parseBody: parseBody,
  requireAdmin: requireAdmin,
  sendJson: sendJson
};
