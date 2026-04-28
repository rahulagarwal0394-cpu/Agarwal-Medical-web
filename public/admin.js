(function() {
  var state = {
    enquiries: [],
    search: "",
    patient: "all"
  };

  var rows = document.getElementById("enquiryRows");
  var searchInput = document.getElementById("adminSearch");
  var patientFilter = document.getElementById("patientFilter");
  var refreshButton = document.getElementById("refreshButton");
  var logoutButton = document.getElementById("logoutButton");
  var totalCount = document.getElementById("totalCount");
  var doctorCount = document.getElementById("doctorCount");
  var rxCount = document.getElementById("rxCount");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function prescriptionLink(prescription) {
    if (!prescription || !prescription.path) return '<span class="muted-text">No</span>';
    var fileName = String(prescription.path).split(/[\\/]/).pop();
    return '<a class="admin-link" href="/api/prescriptions/' + encodeURIComponent(fileName) + '" target="_blank" rel="noopener">View</a>';
  }

  function productsText(items) {
    if (!items || !items.length) return "General enquiry";
    return items.map(function(item) {
      return item.name + (item.qty ? " x " + item.qty : "");
    }).join(", ");
  }

  function serviceAreaText(serviceArea) {
    if (!serviceArea) return "";
    var label = serviceArea.rentAvailable ? "Rent available" : "Rent not available";
    var area = serviceArea.area ? " - " + serviceArea.area : "";
    return '<small>' + escapeHtml(label + area) + "</small>";
  }

  function enquiryHaystack(enquiry) {
    return [
      enquiry.id,
      enquiry.name,
      enquiry.phone,
      enquiry.email,
      enquiry.city,
      enquiry.pincode,
      enquiry.serviceArea && enquiry.serviceArea.area,
      enquiry.patientType,
      enquiry.note,
      productsText(enquiry.items)
    ].join(" ").toLowerCase();
  }

  function filteredEnquiries() {
    return state.enquiries.filter(function(enquiry) {
      var patientMatch = state.patient === "all" || enquiry.patientType === state.patient;
      var searchMatch = !state.search || enquiryHaystack(enquiry).indexOf(state.search.toLowerCase()) !== -1;
      return patientMatch && searchMatch;
    });
  }

  function renderStats() {
    totalCount.textContent = state.enquiries.length;
    doctorCount.textContent = state.enquiries.filter(function(item) {
      return item.patientType === "Doctor referral";
    }).length;
    rxCount.textContent = state.enquiries.filter(function(item) {
      return item.prescription && item.prescription.path;
    }).length;
  }

  function renderRows() {
    var data = filteredEnquiries();
    renderStats();

    if (!data.length) {
      rows.innerHTML = '<tr><td colspan="7">No enquiries found.</td></tr>';
      return;
    }

    rows.innerHTML = data.map(function(enquiry) {
      return [
        "<tr>",
          "<td>",
            '<strong>' + escapeHtml(enquiry.name) + "</strong>",
            '<small>' + escapeHtml(enquiry.phone) + (enquiry.city ? " · " + escapeHtml(enquiry.city) : "") + "</small>",
            '<small>Email: ' + escapeHtml(enquiry.email || "-") + "</small>",
            '<small>PIN: ' + escapeHtml(enquiry.pincode || "-") + "</small>",
            '<small>' + escapeHtml(enquiry.id) + "</small>",
          "</td>",
          '<td><span class="status-pill">' + escapeHtml(enquiry.patientType || "Home patient") + "</span></td>",
          "<td>" + escapeHtml(productsText(enquiry.items)) + serviceAreaText(enquiry.serviceArea) + "</td>",
          "<td>" + escapeHtml(enquiry.note || "-") + "</td>",
          "<td>" + prescriptionLink(enquiry.prescription) + "</td>",
          "<td>" + escapeHtml(formatDate(enquiry.createdAt)) + "</td>",
          '<td><button class="delete-enquiry" type="button" data-delete="' + escapeHtml(enquiry.id) + '">Delete</button></td>',
        "</tr>"
      ].join("");
    }).join("");
  }

  function redirectToLogin() {
    window.location.href = "/admin-login.html";
  }

  function ensureAdminSession() {
    return fetch("/api/admin/session")
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (!data.authenticated) {
          redirectToLogin();
          return false;
        }
        return true;
      })
      .catch(function() {
        redirectToLogin();
        return false;
      });
  }

  function loadEnquiries() {
    rows.innerHTML = '<tr><td colspan="7">Loading enquiries...</td></tr>';
    fetch("/api/enquiries")
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) throw data;
          return data;
        });
      })
      .then(function(data) {
        state.enquiries = data.enquiries || [];
        renderRows();
      })
      .catch(function() {
        redirectToLogin();
      });
  }

  function deleteEnquiry(id) {
    var enquiry = state.enquiries.filter(function(item) {
      return item.id === id;
    })[0];
    var label = enquiry ? enquiry.name + " (" + enquiry.phone + ")" : id;
    if (!window.confirm("Delete enquiry: " + label + "?")) return;

    fetch("/api/enquiries/" + encodeURIComponent(id), {
      method: "DELETE"
    })
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) throw data;
          return data;
        });
      })
      .then(function() {
        state.enquiries = state.enquiries.filter(function(item) {
          return item.id !== id;
        });
        renderRows();
      })
      .catch(function(error) {
        if (error && error.error === "Admin login required") {
          redirectToLogin();
          return;
        }
        var message = error && error.error ? error.error : "Enquiry delete nahi ho paayi.";
        window.alert(message);
      });
  }

  searchInput.addEventListener("input", function(event) {
    state.search = event.target.value;
    renderRows();
  });

  patientFilter.addEventListener("change", function(event) {
    state.patient = event.target.value;
    renderRows();
  });

  refreshButton.addEventListener("click", loadEnquiries);
  logoutButton.addEventListener("click", function() {
    fetch("/api/admin/logout", { method: "POST" }).then(redirectToLogin).catch(redirectToLogin);
  });

  rows.addEventListener("click", function(event) {
    var button = event.target.closest("button[data-delete]");
    if (!button) return;
    deleteEnquiry(button.getAttribute("data-delete"));
  });

  ensureAdminSession().then(function(authenticated) {
    if (authenticated) loadEnquiries();
  });
}());
