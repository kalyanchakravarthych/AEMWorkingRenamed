/* VSC Virtual Cards — list + "Add virtual cards" 3-step drawer (in-memory, no backend).
   Step 1 Details → Step 2 Employees → Step 3 Review + blocked merchant groups → Create.
   - The default row is server-rendered; new rows are built with DOM APIs
     (textContent only), so typed input can never inject markup.
   - Drawer and "Select employees" are modal dialogs: focus moves in, Tab is
     trapped, Esc closes, focus returns to the opener.
   - Errors: inline per field (aria-invalid + aria-describedby) plus an alert. */
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
        "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    var CURRENCY_CODES = { "US Dollar": "USD", "Euro": "EUR", "British Pound": "GBP" };
    var PAYMENT_TYPES = {
        "Single use virtual card": "Single-use",
        "Multi-use virtual card": "Multi-use",
        "Recurring virtual card": "Recurring"
    };

    /* ---------- helpers ---------- */
    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined && text !== null) {
            node.textContent = text;
        }
        return node;
    }

    function svgPath(d, size) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 12 12");
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2.25");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        return svg;
    }

    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function toIso(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function parseIso(value) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    }

    function toDisplay(value) {
        var d = parseIso(value);
        return d ? pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + "/" + d.getFullYear() : "";
    }

    function addMonths(d, months) {
        return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
    }

    function initialsOf(name) {
        return name.split(/\s+/).filter(Boolean).map(function (p) { return p.charAt(0); })
            .join("").slice(0, 2).toUpperCase();
    }

    function money(value) {
        return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function focusables(container) {
        return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (n) {
            return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement;
        });
    }

    function trapTab(container, e) {
        if (e.key !== "Tab") {
            return;
        }
        var items = focusables(container);
        if (!items.length) {
            e.preventDefault();
            return;
        }
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    /* ---------- component ---------- */
    function init(root) {
        if (!root || root.__vclistInit) {
            return;
        }
        root.__vclistInit = true;

        function q(sel) {
            return root.querySelector(sel);
        }

        var tbody = q('[data-cmp-tbody="vclist"]');
        var emptyMsg = q("[data-cmp-vclist-empty]");
        var status = q("[data-cmp-vclist-status]");
        var searchInput = q("#cmp-vclist-search");
        var findInput = q("#cmp-vclist-find");
        var findBtn = q("[data-cmp-vclist-find-btn]");
        var addTrigger = q("[data-cmp-vclist-add-trigger]");

        var drawer = q("[data-cmp-vclist-drawer]");
        var panel = drawer.querySelector(".cmp-drawer__panel");
        var form = q("[data-cmp-vcwiz-form]");
        var steps = Array.prototype.slice.call(root.querySelectorAll("[data-cmp-wizard-step]"));
        var backBtn = q("[data-cmp-vcwiz-back]");
        var nextBtn = q("[data-cmp-vcwiz-next]");
        var createBtn = q("[data-cmp-vcwiz-create]");
        var cancelBtn = q("[data-cmp-vcwiz-cancel]");
        var backLink = q("[data-cmp-vcwiz-back-link]");

        var empAdd = q("[data-cmp-vcemp-add]");
        var empModal = q("[data-cmp-vcemp-modal]");
        var empDialog = empModal.querySelector(".cmp-vcemp-modal__dialog");
        var empTbody = q('[data-cmp-tbody="vcemp"]');
        var empTableWrap = q(".cmp-vcwiz__emp-table");
        var empEmpty = q("[data-cmp-vcemp-empty]");
        var empSummary = q("[data-cmp-vcemp-summary]");

        var toast = q('[data-cmp-toast="vclist"]');
        var toastText = toast ? toast.querySelector("[data-cmp-toast-text]") : null;
        var toastClose = toast ? toast.querySelector("[data-cmp-toast-close]") : null;

        var f = {
            description: form.elements.description,
            spendLimit: form.elements.spendLimit,
            startDate: form.elements.startDate,
            endDate: form.elements.endDate,
            currency: form.elements.currency,
            spendType: form.elements.spendType
        };

        var currentStep = 1;
        var opener = null;
        var empOpener = null;
        var selected = [];
        var data = {};

        /* =====================================================
           List: search / find
           ===================================================== */
        function rows() {
            return Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        }

        function applySearch(term, announce) {
            var needle = (term || "").trim().toLowerCase();
            var shown = 0;
            rows().forEach(function (tr) {
                var match = !needle || tr.textContent.toLowerCase().indexOf(needle) !== -1;
                tr.hidden = !match;
                if (match) {
                    shown += 1;
                }
            });
            emptyMsg.hidden = shown > 0;
            if (announce) {
                status.textContent = shown + " virtual card" + (shown === 1 ? "" : "s") + " found";
            }
        }

        searchInput.addEventListener("input", function () {
            applySearch(searchInput.value, false);
        });
        findBtn.addEventListener("click", function () {
            applySearch(findInput.value, true);
        });
        findInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                applySearch(findInput.value, true);
            }
        });

        tbody.addEventListener("click", function (e) {
            var link = e.target.closest ? e.target.closest(".cmp-vclist__detail") : null;
            if (link && link.getAttribute("href") === "#") {
                e.preventDefault();
            }
        });

        function buildRow(r) {
            var tr = el("tr");
            var tdAvatar = el("td");
            var avatar = el("span", "cmp-avatar", r.initials);
            avatar.setAttribute("aria-hidden", "true");
            tdAvatar.appendChild(avatar);

            var tdStatus = el("td");
            var pill = el("span", "cmp-pill cmp-pill--active");
            pill.appendChild(el("span", "cmp-pill__label", "Active"));
            tdStatus.appendChild(pill);

            var tdDetail = el("td", "cmp-vclist__details");
            var link = el("a", "cmp-vclist__detail");
            link.href = "#";
            link.setAttribute("aria-label", "View " + r.name + " virtual card details");
            link.appendChild(svgPath("M4 1.5L8.5 6 4 10.5", 11));
            tdDetail.appendChild(link);

            tr.appendChild(tdAvatar);
            tr.appendChild(el("td", "cmp-vclist__name", r.name));
            tr.appendChild(el("td", null, r.description));
            tr.appendChild(tdStatus);
            tr.appendChild(el("td", null, r.type));
            tr.appendChild(el("td", null, r.dateRange));
            tr.appendChild(el("td", "cmp-vclist__limit", r.limit));
            tr.appendChild(tdDetail);
            return tr;
        }

        function insertRow(tr, name) {
            var before = null;
            rows().some(function (row) {
                var cell = row.querySelector(".cmp-vclist__name");
                if (cell && cell.textContent.localeCompare(name, undefined, { sensitivity: "base" }) > 0) {
                    before = row;
                    return true;
                }
                return false;
            });
            tbody.insertBefore(tr, before);
        }

        /* =====================================================
           Drawer (modal dialog)
           ===================================================== */
        function placeDrawer() {
            /* Start below the site header, as in the Figma. */
            var header = document.querySelector(".cmp-header, .cmp-vscheader");
            var top = 0;
            if (header) {
                top = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
            }
            drawer.style.setProperty("--cmp-vclist-drawer-top", top + "px");
        }

        function resetWizard() {
            form.reset();
            var today = new Date();
            var max = toIso(addMonths(today, 36));
            f.startDate.value = toIso(today);
            f.endDate.value = toIso(addMonths(today, 1));
            f.startDate.min = toIso(today);
            f.startDate.max = max;
            f.endDate.min = toIso(today);
            f.endDate.max = max;
            form.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
            form.querySelectorAll(".cmp-field__err, [data-cmp-vcwiz-error]").forEach(function (n) { n.hidden = true; });
            root.querySelectorAll("[data-cmp-mccsel] input").forEach(function (c) { c.checked = false; });
            selected = [];
            data = {};
            renderEmployees();
        }

        function openDrawer() {
            opener = document.activeElement;
            resetWizard();
            placeDrawer();
            drawer.hidden = false;
            setStep(1, false);
            f.description.focus();
        }

        function closeDrawer() {
            closeEmpModal(false);
            drawer.hidden = true;
            if (opener && opener.focus) {
                opener.focus();
            }
        }

        function setStep(n, moveFocus) {
            currentStep = n;
            drawer.setAttribute("data-step", String(n));
            steps.forEach(function (s) {
                s.hidden = Number(s.getAttribute("data-cmp-wizard-step")) !== n;
            });
            backBtn.hidden = n !== 2;
            nextBtn.hidden = n === 3;
            createBtn.hidden = n !== 3;
            cancelBtn.hidden = n !== 3;
            panel.scrollTop = 0;
            if (moveFocus) {
                var title = root.querySelector("#cmp-vcwiz-step" + n + "-title");
                if (title) {
                    title.setAttribute("tabindex", "-1");
                    title.focus();
                }
            }
        }

        addTrigger.addEventListener("click", openDrawer);
        q("[data-cmp-vclist-close]").addEventListener("click", closeDrawer);
        q("[data-cmp-vclist-backdrop]").addEventListener("click", closeDrawer);
        cancelBtn.addEventListener("click", closeDrawer);
        window.addEventListener("resize", function () {
            if (!drawer.hidden) {
                placeDrawer();
            }
        });

        /* Date picker buttons (dateinput component) */
        root.querySelectorAll("[data-cmp-date-picker]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var input = document.getElementById(btn.getAttribute("data-cmp-date-picker"));
                if (!input) {
                    return;
                }
                input.focus();
                if (typeof input.showPicker === "function") {
                    try {
                        input.showPicker();
                    } catch (err) {
                        /* Picker not allowed here; the focused input still accepts typing. */
                    }
                }
            });
        });

        /* =====================================================
           Validation
           ===================================================== */
        function setError(input, message) {
            var err = document.getElementById(input.id + "-err");
            if (message) {
                input.setAttribute("aria-invalid", "true");
                if (err) {
                    err.textContent = message;
                    err.hidden = false;
                }
            } else {
                input.removeAttribute("aria-invalid");
                if (err) {
                    err.hidden = true;
                }
            }
            return !message;
        }

        /* Clear a field's error as soon as the user corrects it. */
        form.addEventListener("input", function (e) {
            if (e.target && e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") {
                setError(e.target, "");
            }
        });
        form.addEventListener("change", function (e) {
            if (e.target && e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") {
                setError(e.target, "");
            }
        });

        function stepAlert(n, message) {
            var box = root.querySelector('[data-cmp-vcwiz-error="' + n + '"]');
            if (!box) {
                return;
            }
            box.textContent = message || "";
            box.hidden = !message;
        }

        function validateDetails() {
            var invalid = [];
            var today = parseIso(toIso(new Date()));
            var maxEnd = addMonths(today, 36);
            var desc = f.description.value.trim();
            var amount = f.spendLimit.value.replace(/,/g, "").trim();
            var start = parseIso(f.startDate.value);
            var end = parseIso(f.endDate.value);

            if (!setError(f.description, desc ? "" : "Enter a description.")) {
                invalid.push(f.description);
            }
            var amountOk = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
            if (!setError(f.spendLimit, amountOk ? "" : "Enter a spend limit greater than 0, for example 250.00.")) {
                invalid.push(f.spendLimit);
            }
            if (!setError(f.startDate, start ? "" : "Enter a start date.")) {
                invalid.push(f.startDate);
            }
            var endMsg = "";
            if (!end) {
                endMsg = "Enter an end date.";
            } else if (start && end < start) {
                endMsg = "The end date must be on or after the start date.";
            } else if (end > maxEnd) {
                endMsg = "The end date must be within 3 years from today.";
            }
            if (!setError(f.endDate, endMsg)) {
                invalid.push(f.endDate);
            }
            [f.currency, f.spendType].forEach(function (sel) {
                if (!setError(sel, sel.value ? "" : "Please choose an option.")) {
                    invalid.push(sel);
                }
            });

            if (invalid.length) {
                stepAlert(1, "Please fix " + invalid.length + " highlighted field" +
                    (invalid.length === 1 ? "" : "s") + ".");
                invalid[0].focus();
                return false;
            }
            stepAlert(1, "");
            data = {
                description: desc,
                amount: Number(amount),
                currency: f.currency.value,
                currencyCode: CURRENCY_CODES[f.currency.value] || "USD",
                startDate: f.startDate.value,
                endDate: f.endDate.value,
                spendType: f.spendType.value,
                paymentType: PAYMENT_TYPES[f.spendType.value] || "Single-use"
            };
            return true;
        }

        function fillSummary() {
            var values = {
                description: data.description,
                spendLimit: money(data.amount) + " " + data.currencyCode,
                dateRange: toDisplay(data.startDate) + " - " + toDisplay(data.endDate),
                paymentType: data.paymentType,
                spendType: data.spendType
            };
            root.querySelectorAll("[data-cmp-vcsum]").forEach(function (node) {
                node.textContent = values[node.getAttribute("data-cmp-vcsum")] || "";
            });
        }

        /* =====================================================
           Employees
           ===================================================== */
        function renderEmployees() {
            empTbody.textContent = "";
            empSummary.textContent = "";
            selected.forEach(function (emp) {
                var tr = el("tr");
                var tdName = el("td");
                var holder = el("span", "cmp-vcwiz__emp");
                var avatar = el("span", "cmp-avatar", initialsOf(emp.name));
                avatar.setAttribute("aria-hidden", "true");
                holder.appendChild(avatar);
                holder.appendChild(el("span", null, emp.name));
                tdName.appendChild(holder);

                var tdAction = el("td", "cmp-vcwiz__emp-action");
                var remove = el("button", "cmp-btn cmp-vcwiz__outline cmp-vcwiz__remove");
                remove.type = "button";
                remove.setAttribute("aria-label", "Remove " + emp.name);
                remove.appendChild(svgPath("M2.5 2.5l7 7M9.5 2.5l-7 7", 9));
                remove.appendChild(el("span", null, "Remove"));
                remove.addEventListener("click", function () {
                    selected = selected.filter(function (s) { return s.id !== emp.id; });
                    renderEmployees();
                    status.textContent = emp.name + " removed";
                    empAdd.focus();
                });
                tdAction.appendChild(remove);

                tr.appendChild(tdName);
                tr.appendChild(el("td", null, emp.id));
                tr.appendChild(tdAction);
                empTbody.appendChild(tr);

                var li = el("li", "cmp-vcwiz__emp");
                var av2 = el("span", "cmp-avatar", initialsOf(emp.name));
                av2.setAttribute("aria-hidden", "true");
                li.appendChild(av2);
                li.appendChild(el("span", null, emp.name));
                empSummary.appendChild(li);
            });
            var none = selected.length === 0;
            empTableWrap.hidden = none;
            empEmpty.hidden = !none;
            if (!none) {
                stepAlert(2, "");
            }
        }

        function openEmpModal() {
            empOpener = document.activeElement;
            empModal.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                cb.checked = selected.some(function (s) { return s.id === cb.value; });
            });
            empModal.hidden = false;
            var first = empModal.querySelector('input[type="checkbox"]');
            if (first) {
                first.focus();
            }
        }

        function closeEmpModal(restore) {
            if (empModal.hidden) {
                return;
            }
            empModal.hidden = true;
            if (restore !== false && empOpener && empOpener.focus) {
                empOpener.focus();
            }
        }

        empAdd.addEventListener("click", openEmpModal);
        q("[data-cmp-vcemp-close]").addEventListener("click", function () { closeEmpModal(true); });
        q("[data-cmp-vcemp-cancel]").addEventListener("click", function () { closeEmpModal(true); });
        q("[data-cmp-vcemp-backdrop]").addEventListener("click", function () { closeEmpModal(true); });
        q("[data-cmp-vcemp-confirm]").addEventListener("click", function () {
            selected = [];
            empModal.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
                selected.push({ id: cb.value, name: cb.getAttribute("data-name") || cb.value });
            });
            renderEmployees();
            status.textContent = selected.length + " employee" + (selected.length === 1 ? "" : "s") + " selected";
            closeEmpModal(true);
        });

        /* =====================================================
           Navigation + create
           ===================================================== */
        nextBtn.addEventListener("click", function () {
            if (currentStep === 1) {
                if (validateDetails()) {
                    fillSummary();
                    setStep(2, true);
                }
            } else if (currentStep === 2) {
                if (!selected.length) {
                    stepAlert(2, "Select at least one employee to receive the virtual card.");
                    empAdd.focus();
                    return;
                }
                setStep(3, true);
            }
        });
        backBtn.addEventListener("click", function () {
            setStep(1, true);
        });
        backLink.addEventListener("click", function () {
            setStep(2, true);
        });

        var toastTimer = 0;

        function showToast(message) {
            if (!toast) {
                return;
            }
            if (toastText && message) {
                toastText.textContent = message;
            }
            toast.hidden = false;
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(function () { toast.hidden = true; }, 8000);
        }

        if (toastClose) {
            toastClose.addEventListener("click", function () {
                window.clearTimeout(toastTimer);
                toast.hidden = true;
            });
        }

        createBtn.addEventListener("click", function () {
            var snapshot = data;
            var people = selected.slice();
            closeDrawer();
            showToast("Virtual card is being created. This may take some time.");
            /* Creation is not instant; the card appears in the list shortly after. */
            window.setTimeout(function () {
                people.forEach(function (emp) {
                    insertRow(buildRow({
                        initials: initialsOf(emp.name),
                        name: emp.name,
                        description: snapshot.description,
                        type: snapshot.paymentType,
                        dateRange: toDisplay(snapshot.startDate) + " - " + toDisplay(snapshot.endDate),
                        limit: money(snapshot.amount) + " Spend limit (" + snapshot.currencyCode + ")"
                    }), emp.name);
                });
                applySearch(searchInput.value, false);
                status.textContent = people.length + " virtual card" + (people.length === 1 ? "" : "s") +
                    " added to the list";
            }, 1500);
        });

        /* =====================================================
           Keyboard: Esc + focus trap
           ===================================================== */
        document.addEventListener("keydown", function (e) {
            if (drawer.hidden) {
                return;
            }
            if (e.key === "Escape" || e.key === "Esc") {
                e.preventDefault();
                if (!empModal.hidden) {
                    closeEmpModal(true);
                } else {
                    closeDrawer();
                }
                return;
            }
            trapTab(empModal.hidden ? panel : empDialog, e);
        });

        renderEmployees();
    }

    function safeInit(root) {
        try {
            init(root);
        } catch (err) {
            window.console.warn("VSC Virtual Cards could not start", err);
        }
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-vclist]")) {
            safeInit(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-vclist]"), safeInit);
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
