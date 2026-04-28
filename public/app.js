(function() {
  var state = {
    products: [],
    categories: [],
    cart: [],
    category: "all",
    search: ""
  };

  var productGrid = document.getElementById("productGrid");
  var categorySelect = document.getElementById("categorySelect");
  var searchInput = document.getElementById("searchInput");
  var cartButton = document.getElementById("cartButton");
  var cartCount = document.getElementById("cartCount");
  var drawer = document.getElementById("drawer");
  var closeDrawer = document.getElementById("closeDrawer");
  var cartItems = document.getElementById("cartItems");
  var enquiryForm = document.getElementById("enquiryForm");
  var formStatus = document.getElementById("formStatus");
  var billModal = document.getElementById("billModal");
  var closeBill = document.getElementById("closeBill");
  var printBill = document.getElementById("printBill");
  var billMeta = document.getElementById("billMeta");
  var billCustomer = document.getElementById("billCustomer");
  var billItems = document.getElementById("billItems");
  var billTotal = document.getElementById("billTotal");
  var patientType = document.getElementById("patientType");
  var prescriptionRow = document.getElementById("prescriptionRow");
  var prescriptionFile = document.getElementById("prescriptionFile");
  var customerName = document.getElementById("customerName");
  var customerPhone = document.getElementById("customerPhone");
  var customerEmail = document.getElementById("customerEmail");
  var customerCity = document.getElementById("customerCity");
  var customerPincode = document.getElementById("customerPincode");
  var customerNote = document.getElementById("customerNote");
  var rentPincode = document.getElementById("rentPincode");
  var pincodeButton = document.getElementById("pincodeButton");
  var pincodeStatus = document.getElementById("pincodeStatus");
  var pincodeModal = document.getElementById("pincodeModal");
  var modalPincode = document.getElementById("modalPincode");
  var modalPincodeButton = document.getElementById("modalPincodeButton");
  var modalPincodeStatus = document.getElementById("modalPincodeStatus");
  var modalContinue = document.getElementById("modalContinue");
  var pincodeModalClose = document.getElementById("pincodeModalClose");
  var siteHeader = document.querySelector(".site-header");
  var revealObserver = null;
  var MAX_PRESCRIPTION_SIZE = 5 * 1024 * 1024;

  function money(value) {
    if (value === null || typeof value === "undefined") return "-";
    return "₹" + Number(value).toLocaleString("en-IN");
  }

  function secondaryPriceLabel(product) {
    return product.gasPrice ? "Gas refill" : "Rate";
  }

  function payableNow(line) {
    return ((line.gasPrice || line.salePrice || 0) + (line.deposit || 0)) * (line.qty || 1);
  }

  function secondaryPriceValue(product) {
    return product.gasPrice || product.salePrice;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function api(path, options) {
    return fetch(path, options).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw data;
        }
        return data;
      });
    });
  }

  function cleanPincode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 6);
  }

  function setPincodeStatus(message, type) {
    if (!pincodeStatus) return;
    pincodeStatus.textContent = message;
    pincodeStatus.className = "pincode-status " + (type || "");
  }

  function setModalPincodeStatus(message, type) {
    if (!modalPincodeStatus) return;
    modalPincodeStatus.textContent = message;
    modalPincodeStatus.className = "pincode-status " + (type || "");
  }

  function fillPincodeEverywhere(pincode) {
    if (rentPincode) rentPincode.value = pincode;
    if (customerPincode) customerPincode.value = pincode;
    if (modalPincode) modalPincode.value = pincode;
  }

  function renderPincodeResult(data, setter) {
    if (data.rentAvailable) {
      setter("Available in " + data.area + ". " + data.deliveryTime + ".", "ok");
    } else {
      setter("Is PIN code par rent service abhi available nahi hai. Enquiry bhej sakte hain.", "warn");
    }
  }

  function checkPincodeAvailability() {
    var pincode = cleanPincode(rentPincode && rentPincode.value);
    if (rentPincode) rentPincode.value = pincode;
    if (pincode.length !== 6) {
      setPincodeStatus("6 digit PIN code enter karein.", "warn");
      return;
    }

    setPincodeStatus("Checking...", "");
    api("/api/service-area?pincode=" + encodeURIComponent(pincode))
      .then(function(data) {
        renderPincodeResult(data, setPincodeStatus);
        fillPincodeEverywhere(pincode);
      })
      .catch(function() {
        setPincodeStatus("PIN code check nahi ho paaya. Server restart karke try karein.", "warn");
      });
  }

  function checkModalPincodeAvailability() {
    var pincode = cleanPincode(modalPincode && modalPincode.value);
    if (modalPincode) modalPincode.value = pincode;
    if (pincode.length !== 6) {
      setModalPincodeStatus("6 digit PIN code enter karein.", "warn");
      return;
    }

    setModalPincodeStatus("Checking...", "");
    api("/api/service-area?pincode=" + encodeURIComponent(pincode))
      .then(function(data) {
        renderPincodeResult(data, setModalPincodeStatus);
        fillPincodeEverywhere(pincode);
        try {
          sessionStorage.setItem("agarwalPincodeChecked", "1");
        } catch (err) {}
      })
      .catch(function() {
        setModalPincodeStatus("PIN code check nahi ho paaya. Server restart karke try karein.", "warn");
      });
  }

  function closePincodeModal() {
    if (!pincodeModal) return;
    pincodeModal.classList.remove("open");
    try {
      sessionStorage.setItem("agarwalPincodeChecked", "1");
    } catch (err) {}
  }

  function initPincodeModal() {
    if (!pincodeModal) return;
    var alreadyChecked = false;
    try {
      alreadyChecked = sessionStorage.getItem("agarwalPincodeChecked") === "1";
    } catch (err) {}
    if (!alreadyChecked) {
      pincodeModal.classList.add("open");
      window.setTimeout(function() {
        modalPincode && modalPincode.focus();
      }, 180);
    } else {
      pincodeModal.classList.remove("open");
    }
  }

  function loadProducts() {
    var params = [
      "category=" + encodeURIComponent(state.category),
      "search=" + encodeURIComponent(state.search)
    ].join("&");

    api("/api/products?" + params)
      .then(function(data) {
        state.products = data.products || [];
        state.categories = data.categories || [];
        renderCategories();
        renderProducts();
      })
      .catch(function() {
        productGrid.innerHTML = '<div class="empty-state">Products load nahi ho paaye. Server dobara start karke refresh karein.</div>';
      });
  }

  function renderCategories() {
    if (categorySelect.options.length > 1) return;
    state.categories.forEach(function(category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });
  }

  function renderProducts() {
    if (!state.products.length) {
      productGrid.innerHTML = '<div class="empty-state">Is filter mein product nahi mila.</div>';
      return;
    }

    productGrid.innerHTML = state.products.map(function(product) {
      var highlights = product.highlights.map(function(item) {
        return "<li>" + escapeHtml(item) + "</li>";
      }).join("");

      return [
        '<article class="product-card reveal">',
          '<div class="product-image">',
            '<img src="' + escapeHtml(product.image || "/assets/products/oxygen-cylinder-10l.png") + '" alt="' + escapeHtml(product.name) + '">',
          "</div>",
          '<div class="product-top">',
            '<div>',
              '<h3>' + escapeHtml(product.name) + "</h3>",
              '<div class="meta">' + escapeHtml(product.category) + " · " + escapeHtml(product.availability) + "</div>",
            "</div>",
            '<span class="badge">' + escapeHtml(product.badge) + "</span>",
          "</div>",
          '<p class="meta">' + escapeHtml(product.audience) + "</p>",
          '<div class="price-row">',
            '<div class="price"><span>Rent / day</span><strong>' + money(product.rentPrice) + "</strong></div>",
            '<div class="price"><span>' + secondaryPriceLabel(product) + '</span><strong>' + money(secondaryPriceValue(product)) + "</strong></div>",
            '<div class="price"><span>Security deposit</span><strong>' + money(product.deposit) + "</strong></div>",
          "</div>",
          '<ul class="highlights">' + highlights + "</ul>",
          '<div class="card-actions"><button type="button" data-add="' + product.id + '">Enquire</button></div>',
        "</article>"
      ].join("");
    }).join("");
    prepareProductReveals();
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i += 1) {
      if (state.products[i].id === id) return state.products[i];
    }
    return null;
  }

  function addToCart(id) {
    var product = findProduct(id);
    if (!product) return;
    var existing = state.cart.filter(function(line) {
      return line.id === id;
    })[0];
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        qty: 1,
        rentPrice: product.rentPrice,
        salePrice: product.salePrice,
        gasPrice: product.gasPrice,
        deposit: product.deposit
      });
    }
    updateCart();
    pulseCart();
    openDrawer();
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCart();
  }

  function updateCart() {
    var total = state.cart.reduce(function(sum, line) {
      return sum + line.qty;
    }, 0);
    cartCount.textContent = total;
    if (!state.cart.length) {
      cartItems.innerHTML = '<div class="empty-state">Cart empty hai.</div>';
      return;
    }
    cartItems.innerHTML = state.cart.map(function(line, index) {
      var priceParts = [];
      if (line.rentPrice) priceParts.push("Rent " + money(line.rentPrice) + " / day");
      if (line.gasPrice) priceParts.push("Gas refill " + money(line.gasPrice));
      if (!line.gasPrice && line.salePrice) priceParts.push("Rate " + money(line.salePrice));
      if (line.deposit) priceParts.push("Deposit " + money(line.deposit));
      var payableTotal = payableNow(line);
      var price = priceParts.join(" · ");
      return [
        '<div class="cart-line">',
          '<div>',
            '<strong>' + escapeHtml(line.name) + "</strong>",
            '<small>Qty ' + line.qty + " · " + price + "</small>",
            '<small>Total payable now: ' + money(payableTotal) + "</small>",
          "</div>",
          '<button class="remove-line" type="button" data-remove="' + index + '" aria-label="Remove item">x</button>',
        "</div>"
      ].join("");
    }).join("");
  }

  function renderBill(enquiry) {
    var items = enquiry.items || [];
    var createdAt = enquiry.createdAt ? new Date(enquiry.createdAt) : new Date();
    var total = items.reduce(function(sum, item) {
      return sum + payableNow(item);
    }, 0);

    billMeta.innerHTML = [
      '<div><span>Bill / Enquiry ID</span><strong>' + escapeHtml(enquiry.id) + "</strong></div>",
      '<div><span>Date</span><strong>' + escapeHtml(createdAt.toLocaleString("en-IN")) + "</strong></div>"
    ].join("");

    billCustomer.innerHTML = [
      '<div><span>Customer</span><strong>' + escapeHtml(enquiry.name) + "</strong></div>",
      '<div><span>Phone</span><strong>' + escapeHtml(enquiry.phone) + "</strong></div>",
      '<div><span>Email</span><strong>' + escapeHtml(enquiry.email || "-") + "</strong></div>",
      '<div><span>PIN Code</span><strong>' + escapeHtml(enquiry.pincode || "-") + "</strong></div>"
    ].join("");

    if (!items.length) {
      billItems.innerHTML = '<tr><td colspan="6">General enquiry</td></tr>';
    } else {
      billItems.innerHTML = items.map(function(item) {
        return [
          "<tr>",
            "<td>" + escapeHtml(item.name) + "</td>",
            "<td>" + escapeHtml(item.qty || 1) + "</td>",
            "<td>" + money(item.rentPrice) + "</td>",
            "<td>" + money(item.gasPrice || item.salePrice) + "</td>",
            "<td>" + money(item.deposit) + "</td>",
            "<td><strong>" + money(payableNow(item)) + "</strong></td>",
          "</tr>"
        ].join("");
      }).join("");
    }

    billTotal.innerHTML = "<span>Total payable now: " + money(total) + "</span>";
    billModal.classList.add("open");
    billModal.setAttribute("aria-hidden", "false");
  }

  function closeBillModal() {
    billModal.classList.remove("open");
    billModal.setAttribute("aria-hidden", "true");
  }

  function pulseCart() {
    cartButton.classList.remove("cart-pop");
    void cartButton.offsetWidth;
    cartButton.classList.add("cart-pop");
  }

  function openDrawer() {
    drawer.className = "drawer open";
    drawer.setAttribute("aria-hidden", "false");
  }

  function hideDrawer() {
    drawer.className = "drawer";
    drawer.setAttribute("aria-hidden", "true");
  }

  function formToObject(form) {
    var data = {};
    Array.prototype.slice.call(new FormData(form).entries()).forEach(function(entry) {
      if (typeof File === "undefined" || !(entry[1] instanceof File)) {
        data[entry[0]] = entry[1];
      }
    });
    data.name = customerName ? customerName.value.trim() : data.name;
    data.phone = customerPhone ? customerPhone.value.trim() : data.phone;
    data.email = customerEmail ? customerEmail.value.trim() : data.email;
    data.city = customerCity ? customerCity.value.trim() : data.city;
    data.pincode = customerPincode ? cleanPincode(customerPincode.value) : cleanPincode(data.pincode);
    data.patientType = patientType ? patientType.value : data.patientType;
    data.note = customerNote ? customerNote.value.trim() : data.note;
    return data;
  }

  function isDoctorReferral() {
    return patientType && patientType.value === "Doctor referral";
  }

  function updatePrescriptionRequirement() {
    if (!prescriptionRow || !prescriptionFile) return;
    if (isDoctorReferral()) {
      prescriptionRow.classList.remove("is-hidden");
    } else {
      prescriptionRow.classList.add("is-hidden");
      prescriptionFile.value = "";
    }
  }

  function readPrescriptionUpload() {
    return new Promise(function(resolve, reject) {
      if (!isDoctorReferral()) {
        resolve(null);
        return;
      }

      var file = prescriptionFile.files && prescriptionFile.files[0];
      if (!file) {
        reject(new Error("Doctor referral ke liye prescription upload karein."));
        return;
      }
      if (file.size > MAX_PRESCRIPTION_SIZE) {
        reject(new Error("Prescription file 5MB se chhoti honi chahiye."));
        return;
      }
      if (!/^image\//.test(file.type) && file.type !== "application/pdf") {
        reject(new Error("Prescription image ya PDF format mein upload karein."));
        return;
      }

      var reader = new FileReader();
      reader.onload = function() {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result
        });
      };
      reader.onerror = function() {
        reject(new Error("Prescription file read nahi ho paayi."));
      };
      reader.readAsDataURL(file);
    });
  }

  function prepareProductReveals() {
    Array.prototype.slice.call(document.querySelectorAll(".product-card.reveal")).forEach(function(card, index) {
      card.style.setProperty("--reveal-delay", Math.min(index * 55, 330) + "ms");
      observeReveal(card);
    });
  }

  function observeReveal(element) {
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      element.classList.add("is-visible");
      return;
    }
    revealObserver.observe(element);
  }

  function initScrollReveals() {
    if (!("IntersectionObserver" in window)) {
      Array.prototype.slice.call(document.querySelectorAll(".reveal")).forEach(function(element) {
        element.classList.add("is-visible");
      });
      return;
    }

    revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px"
    });

    Array.prototype.slice.call(document.querySelectorAll(".catalog-section, .doctor-band, .support-section article")).forEach(function(element, index) {
      element.classList.add("reveal");
      element.style.setProperty("--reveal-delay", Math.min(index * 70, 280) + "ms");
      observeReveal(element);
    });
  }

  function updateHeaderShadow() {
    if (!siteHeader) return;
    if (window.pageYOffset > 12) {
      siteHeader.classList.add("scrolled");
    } else {
      siteHeader.classList.remove("scrolled");
    }
  }

  function createRipple(event) {
    var target = event.target.closest("button, .primary-action, .secondary-action");
    if (!target) return;
    var bounds = target.getBoundingClientRect();
    var ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = (event.clientX - bounds.left) + "px";
    ripple.style.top = (event.clientY - bounds.top) + "px";
    target.appendChild(ripple);
    window.setTimeout(function() {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 650);
  }

  function initMicroInteractions() {
    document.addEventListener("click", createRipple);
    window.addEventListener("scroll", updateHeaderShadow);
    updateHeaderShadow();
  }

  searchInput.addEventListener("input", function(event) {
    state.search = event.target.value;
    loadProducts();
  });

  categorySelect.addEventListener("change", function(event) {
    state.category = event.target.value;
    loadProducts();
  });

  patientType.addEventListener("change", updatePrescriptionRequirement);
  pincodeButton.addEventListener("click", checkPincodeAvailability);
  rentPincode.addEventListener("input", function(event) {
    event.target.value = cleanPincode(event.target.value);
    setPincodeStatus("", "");
  });
  rentPincode.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      checkPincodeAvailability();
    }
  });
  customerPincode.addEventListener("input", function(event) {
    event.target.value = cleanPincode(event.target.value);
  });
  modalPincodeButton.addEventListener("click", checkModalPincodeAvailability);
  modalPincode.addEventListener("input", function(event) {
    event.target.value = cleanPincode(event.target.value);
    setModalPincodeStatus("", "");
  });
  modalPincode.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      checkModalPincodeAvailability();
    }
  });
  modalContinue.addEventListener("click", closePincodeModal);
  pincodeModalClose.addEventListener("click", closePincodeModal);

  productGrid.addEventListener("click", function(event) {
    var button = event.target.closest("button[data-add]");
    if (!button) return;
    addToCart(button.getAttribute("data-add"));
  });

  cartButton.addEventListener("click", openDrawer);
  closeDrawer.addEventListener("click", hideDrawer);
  closeBill.addEventListener("click", closeBillModal);
  printBill.addEventListener("click", function() {
    window.print();
  });
  billModal.addEventListener("click", function(event) {
    if (event.target === billModal) closeBillModal();
  });
  drawer.addEventListener("click", function(event) {
    if (event.target === drawer) hideDrawer();
  });

  document.querySelector("[data-open-enquiry]").addEventListener("click", openDrawer);

  cartItems.addEventListener("click", function(event) {
    var button = event.target.closest("button[data-remove]");
    if (!button) return;
    removeFromCart(Number(button.getAttribute("data-remove")));
  });

  enquiryForm.addEventListener("submit", function(event) {
    event.preventDefault();

    var payload = formToObject(enquiryForm);
    if (!payload.name || payload.name.length < 2) {
      formStatus.textContent = "Name fill karein.";
      customerName && customerName.focus();
      return;
    }
    if (!payload.phone || payload.phone.length < 8) {
      formStatus.textContent = "Phone number fill karein.";
      customerPhone && customerPhone.focus();
      return;
    }
    if (!payload.pincode || payload.pincode.length !== 6) {
      formStatus.textContent = "6 digit PIN code fill karein.";
      customerPincode && customerPincode.focus();
      return;
    }

    payload.items = state.cart;
    formStatus.textContent = "Sending...";

    readPrescriptionUpload()
      .then(function(prescription) {
        if (prescription) {
          payload.prescription = prescription;
        }
        return api("/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      })
      .then(function(data) {
        formStatus.textContent = "Enquiry saved: " + data.enquiry.id;
        renderBill(data.enquiry);
        state.cart = [];
        updateCart();
        enquiryForm.reset();
        updatePrescriptionRequirement();
      })
      .catch(function(error) {
        var message = error && error.errors ? error.errors.join(", ") : error.message || "Enquiry submit nahi hui.";
        formStatus.textContent = message;
      });
  });

  updateCart();
  updatePrescriptionRequirement();
  initPincodeModal();
  initScrollReveals();
  initMicroInteractions();
  loadProducts();
}());
