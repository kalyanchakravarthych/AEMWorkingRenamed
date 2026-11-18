/* VSC Transactions — updates the dashboard numbers for the chosen Show / Recent Periods.
   Demo data below mirrors the Figma (May 2026 = 1 transaction, 1.00 USD debit).
   Replace DATA with a service call when a backend is available. */
(function () {
    "use strict";

    var DATA = {
        "All requests": {
            "05/01/2026 to 05/31/2026": { total: 1, coding: 0, pending: 0, txns: 1, debit: "1.00", credit: "0.00" },
            "04/01/2026 to 04/30/2026": { total: 6, coding: 2, pending: 1, txns: 6, debit: "842.17", credit: "25.00" },
            "03/01/2026 to 03/31/2026": { total: 4, coding: 0, pending: 3, txns: 4, debit: "1,120.40", credit: "0.00" }
        },
        "My requests": {
            "05/01/2026 to 05/31/2026": { total: 1, coding: 0, pending: 0, txns: 1, debit: "1.00", credit: "0.00" },
            "04/01/2026 to 04/30/2026": { total: 3, coding: 1, pending: 1, txns: 3, debit: "412.35", credit: "0.00" },
            "03/01/2026 to 03/31/2026": { total: 2, coding: 0, pending: 2, txns: 2, debit: "615.20", credit: "0.00" }
        }
    };

    function init(root) {
        if (!root || root.__vtxnInit) {
            return;
        }
        root.__vtxnInit = true;

        var scope = root.querySelector("#cmp-vtxn-scope");
        var period = root.querySelector("#cmp-vtxn-period");
        var range = root.querySelector("[data-cmp-vtxn-range]");
        var status = root.querySelector("[data-cmp-vtxn-status]");
        if (!scope || !period) {
            return;
        }

        function set(key, value) {
            var node = root.querySelector('[data-cmp-vtxn="' + key + '"]');
            if (node) {
                node.textContent = String(value);
            }
        }

        function arc(key, value, total) {
            var path = root.querySelector('[data-cmp-vtxn-arc="' + key + '"]');
            if (path) {
                var pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
                path.setAttribute("stroke-dasharray", (pct > 0 ? pct.toFixed(1) : "0") + " 100");
            }
        }

        function render(announce) {
            var group = DATA[scope.value] || DATA["All requests"];
            var d = group[period.value];
            if (!d) {
                return;
            }
            range.textContent = period.value;
            ["total", "coding", "pending", "txns", "debit", "credit"].forEach(function (k) { set(k, d[k]); });
            arc("coding", d.coding, d.total);
            arc("pending", d.pending, d.total);
            if (announce) {
                status.textContent = scope.value + ", " + period.value + ": " + d.txns + " transaction" +
                    (d.txns === 1 ? "" : "s") + ", " + d.coding + " coding required, " + d.pending +
                    " pending approval.";
            }
        }

        scope.addEventListener("change", function () { render(true); });
        period.addEventListener("change", function () { render(true); });
        render(false);
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-vtxn]")) {
            init(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-vtxn]"), init);
        }
    }

    function boot() {
        scan(document);
        /* AEM editor re-renders components after edits; enhance the new markup. */
        if (window.MutationObserver) {
            new window.MutationObserver(function (records) {
                records.forEach(function (record) {
                    Array.prototype.forEach.call(record.addedNodes, function (node) {
                        if (node.nodeType === 1) {
                            scan(node);
                        }
                    });
                });
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
