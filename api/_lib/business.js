var path = require("path");
var crypto = require("crypto");

var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

  var fileName = enquiryId + "-prescription" + ext;
  return {
    originalName: String(upload.name || "prescription" + ext),
    type: mimeType,
    size: buffer.length,
    path: "prescriptions/" + fileName,
    fileName: fileName,
    dataUrl: upload.dataUrl
  };
}

function cleanPrescriptionForList(prescription) {
  if (!prescription) return null;
  return {
    originalName: prescription.originalName,
    type: prescription.type,
    size: prescription.size,
    path: prescription.path,
    fileName: prescription.fileName || path.basename(String(prescription.path || ""))
  };
}

function cleanEnquiry(enquiry) {
  var copy = {};
  Object.keys(enquiry || {}).forEach(function(key) {
    copy[key] = enquiry[key];
  });
  copy.prescription = cleanPrescriptionForList(enquiry.prescription);
  return copy;
}

function createEnquiry(db, payload) {
  var enquiryId = "ENQ-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex");
  var pincode = normalizePincode(payload.pincode || payload.customerPincode);
  return {
    id: enquiryId,
    name: String(payload.name || payload.customerName).trim(),
    phone: String(payload.phone || payload.customerPhone).trim(),
    email: String(payload.email || payload.customerEmail || "").trim(),
    city: String(payload.city || payload.customerCity || "").trim(),
    pincode: pincode,
    serviceArea: lookupServiceArea(db, pincode),
    patientType: String(payload.patientType || "Home patient").trim(),
    note: String(payload.note || "").trim(),
    items: payload.items || [],
    prescription: savePrescription(enquiryId, payload.prescription),
    status: "New",
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  cleanEnquiry: cleanEnquiry,
  createEnquiry: createEnquiry,
  lookupServiceArea: lookupServiceArea,
  normalizePincode: normalizePincode,
  validateEnquiry: validateEnquiry
};
