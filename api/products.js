var http = require("./_lib/http");
var store = require("./_lib/store");

module.exports = async function(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res);
  try {
    var db = await store.readDb();
    var query = req.query || {};
    var products = (db.products || []).slice(0);

    if (query.mode && query.mode !== "all") {
      products = products.filter(function(product) {
        return product.mode && product.mode.indexOf(query.mode) !== -1;
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

    http.sendJson(res, 200, { products: products, categories: db.categories || [] });
  } catch (err) {
    http.sendJson(res, 500, { error: "Products load failed" });
  }
};
