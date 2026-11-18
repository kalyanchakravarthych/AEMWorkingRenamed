/* VSC Card Listing — Cards page behaviour (no backend, in-memory only).
   - Filter dropdown (status) and Create card split button
   - Employee search drawer + Create Card form drawer
   - Submit → new row inserted alphabetically + success toast
   - Row selection count + "Update cards" state
   - Pagination: drives a "VSC Pagination" component placed after the
     listing (or the one whose "Controls" field names this listing's ID).
     Rows per page comes from data-cmp-cardlist-page-size (dialog, default 2).
   The default rows are rendered by HTL; this script only enhances them.
   New rows are built with DOM APIs (textContent), never innerHTML, so
   form input can't inject markup. */
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";

    /* ---------- Employee catalog for autosuggest ---------- */
    var EMPLOYEES = [
        { id: "deverett01", firstName: "Daniel", lastName: "Everett", initials: "DE",
            cardholderName: "Daniel Everett", companyName: "Acme Corp", workPhone: "daneverett01",
            addressLine1: "5032 Hawks Nest Lane", city: "St. Louis", state: "MO", zip: "12345" },
        { id: "jsmith02", firstName: "Jane", lastName: "Smith", initials: "JS",
            cardholderName: "Jane Smith", companyName: "Acme Corp", workPhone: "jsmith02",
            addressLine1: "123 Main St", city: "Boston", state: "MA", zip: "02108" },
        { id: "rtaylor03", firstName: "Rebecca", lastName: "Taylor", initials: "RT",
            cardholderName: "Rebecca Taylor", companyName: "Acme Corp", workPhone: "rtaylor03",
            addressLine1: "88 Oak Avenue", city: "Austin", state: "TX", zip: "73301" }
    ];

    var rowUid = 0;

    /* ---------- DOM helpers ---------- */
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

    function chevronSvg() {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 12 12");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "12");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", "M4 1l5 5-5 5");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.75");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        return svg;
    }

    /* Same markup as the HTL rows in cardlisting.html. */
    function buildRow(r) {
        rowUid += 1;
        var checkId = "cmp-row-new-" + rowUid;
        var tr = el("tr");
        tr.setAttribute("data-cmp-status", r.status);

        var tdCheck = el("td");
        var label = el("label", "cmp-visually-hidden", "Select " + r.name);
        label.setAttribute("for", checkId);
        var check = el("input");
        check.type = "checkbox";
        check.id = checkId;
        check.setAttribute("data-cmp-rowcheck", "");
        tdCheck.appendChild(label);
        tdCheck.appendChild(check);

        var tdHolder = el("td");
        var holder = el("div", "cmp-cardlist__holder");
        var avatar = el("span", "cmp-avatar", r.initials);
        avatar.setAttribute("aria-hidden", "true");
        var name = el("span", "cmp-cardlist__name");
        name.appendChild(el("span", "cmp-cardlist__fullname", r.name));
        name.appendChild(el("span", "cmp-cardlist__sub", r.sub));
        holder.appendChild(avatar);
        holder.appendChild(name);
        tdHolder.appendChild(holder);

        var tdStatus = el("td");
        var pill = el("span", "cmp-pill cmp-pill--" + r.status.toLowerCase());
        pill.appendChild(el("span", "cmp-pill__label", r.status));
        tdStatus.appendChild(pill);

        var tdDetail = el("td", "cmp-cardlist__details-col");
        var link = el("a", "cmp-cardlist__detail");
        link.href = "#";
        link.setAttribute("aria-label", "View " + r.name + " details");
        link.appendChild(chevronSvg());
        tdDetail.appendChild(link);

        tr.appendChild(tdCheck);
        tr.appendChild(tdHolder);
        tr.appendChild(el("td", null, r.account));
        tr.appendChild(el("td", "cmp-cardlist__num", r.limit));
        tr.appendChild(el("td", null, r.type));
        tr.appendChild(tdStatus);
        tr.appendChild(el("td", null, r.updated));
        tr.appendChild(tdDetail);
        return tr;
    }

    function rowName(tr) {
        var n = tr.querySelector(".cmp-cardlist__fullname");
        return n ? n.textContent.trim() : "";
    }

    function todayString() {
        var d = new Date();
        var mm = String(d.getMonth() + 1);
        var dd = String(d.getDate());
        return (mm.length < 2 ? "0" + mm : mm) + "/" + (dd.length < 2 ? "0" + dd : dd) + "/" + d.getFullYear();
    }

    /* ---------- Component ---------- */
    function init(root) {
        if (!root || root.__cardlistInit) {
            return;
        }
        root.__cardlistInit = true;

        function q(sel) {
            return root.querySelector(sel);
        }

        var createTrigger = q("[data-cmp-create-trigger]");
        var createMenu = q("#cmp-cardlist-create-menu");
        var createOptions = root.querySelectorAll("[data-cmp-create-option]");

        var filterTrigger = q("[data-cmp-filter-trigger]");
        var filterPanel = q("#cmp-cardlist-filter-panel");
        var filterLabel = q("[data-cmp-filter-label]");
        var filterOpts = root.querySelectorAll("[data-cmp-filter-opt]");
        var filterClear = q("[data-cmp-filter-clear]");
        var filterApply = q("[data-cmp-filter-apply]");

        var empDrawer = q("[data-cmp-empsearch-drawer]");
        var empClose = q("[data-cmp-empsearch-close]");
        var empInput = q("[data-cmp-empsearch-input]");
        var empResults = q("[data-cmp-empsearch-results]");

        var cardDrawer = q("[data-cmp-createcard-drawer]");
        var cardClose = q("[data-cmp-createcard-close]");
        var cardForm = q("[data-cmp-createcard-form]");
        var cardError = q("[data-cmp-form-error]");

        var tbody = q('[data-cmp-tbody="cardlist"]');
        var emptyMsg = q("[data-cmp-cardlist-empty]");
        var selectAll = q("[data-cmp-selectall]");
        var selectionCount = q("[data-cmp-selection-count]");
        var updateCards = q("[data-cmp-update-cards]");

        var toast = q("[data-cmp-toast]");
        var toastText = q("[data-cmp-toast-text]");
        var toastClose = q("[data-cmp-toast-close]");

        var charCount = q("[data-cmp-charcount]");
        var commentsField = q("#cf-comments");

        if (!tbody) {
            return;
        }

        /* =====================================================
           Filtering + pagination
           ===================================================== */
        var pageSize = parseInt(root.getAttribute("data-cmp-cardlist-page-size"), 10);
        if (!(pageSize > 0)) {
            pageSize = 2;
        }
        var page = 1;
        var activeStatuses = Array.prototype.slice.call(filterOpts)
            .filter(function (o) { return o.checked; })
            .map(function (o) { return o.value; });
        var pager = null;

        function allRows() {
            return Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        }

        function matchingRows() {
            return allRows().filter(function (tr) {
                var st = tr.getAttribute("data-cmp-status") || "";
                return activeStatuses.length === 0 || activeStatuses.indexOf(st) !== -1;
            });
        }

        function pageCount(count) {
            return Math.max(1, Math.ceil(count / pageSize));
        }

        /* The pager linked to this listing: one naming our ID, otherwise the
           first unclaimed pager after the listing in document order. */
        function findPager() {
            var pagers = Array.prototype.slice.call(document.querySelectorAll("[data-cmp-pager]"));
            var id = root.id;
            var named = pagers.filter(function (p) {
                return id && p.getAttribute("data-cmp-pager-for") === id;
            });
            if (named.length) {
                return named[0];
            }
            var following = pagers.filter(function (p) {
                var free = !p.getAttribute("data-cmp-pager-for") && (!p.__vscPagerOwner || p.__vscPagerOwner === root);
                /* eslint-disable-next-line no-bitwise */
                return free && (root.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
            });
            return following.length ? following[0] : null;
        }

        function onPagerChange(e) {
            var requested = e.detail && e.detail.page;
            if (typeof requested === "number") {
                page = requested;
                render();
            }
        }

        function linkPager() {
            var found = findPager();
            if (found === pager) {
                return;
            }
            if (pager) {
                pager.removeEventListener("vsc:pager-change", onPagerChange);
                pager.__vscPagerOwner = null;
            }
            pager = found;
            if (pager) {
                pager.__vscPagerOwner = root;
                pager.addEventListener("vsc:pager-change", onPagerChange);
            }
        }

        function updateSelectAllState() {
            var onPage = allRows().filter(function (tr) { return !tr.hidden; })
                .map(function (tr) { return tr.querySelector("[data-cmp-rowcheck]"); })
                .filter(Boolean);
            var checked = onPage.filter(function (c) { return c.checked; }).length;
            selectAll.checked = onPage.length > 0 && checked === onPage.length;
            selectAll.indeterminate = checked > 0 && checked < onPage.length;
            selectAll.disabled = onPage.length === 0;
        }

        function render() {
            linkPager();
            var matches = matchingRows();
            var paged = !!pager;
            var pages = paged ? pageCount(matches.length) : 1;
            page = Math.min(Math.max(1, page), pages);
            var start = (page - 1) * pageSize;
            var end = start + pageSize;

            allRows().forEach(function (tr) {
                var idx = matches.indexOf(tr);
                tr.hidden = idx === -1 || (paged && (idx < start || idx >= end));
            });
            if (emptyMsg) {
                emptyMsg.hidden = matches.length > 0;
            }
            if (pager) {
                pager.setAttribute("data-cmp-pager-page", String(page));
                pager.setAttribute("data-cmp-pager-pages", String(pages));
                pager.dispatchEvent(new CustomEvent("vsc:pager-render", { detail: { page: page, pages: pages } }));
            }
            updateSelectAllState();
        }

        /* A pager added later (e.g. dropped in the AEM editor) links itself. */
        document.addEventListener("vsc:pager-ready", function () {
            if (document.documentElement.contains(root)) {
                render();
            }
        });

        /* =====================================================
           Create card split button (ARIA menu)
           ===================================================== */
        function menuItems() {
            return Array.prototype.slice.call(createMenu.querySelectorAll('[role="menuitem"]'));
        }

        function toggleCreateMenu(show) {
            var open = show !== undefined ? show : createMenu.hasAttribute("hidden");
            if (open) {
                createMenu.removeAttribute("hidden");
                createTrigger.setAttribute("aria-expanded", "true");
                var items = menuItems();
                if (items.length) {
                    items[0].focus();
                }
            } else {
                createMenu.setAttribute("hidden", "");
                createTrigger.setAttribute("aria-expanded", "false");
            }
        }

        createTrigger.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleCreateMenu();
        });
        createTrigger.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                toggleCreateMenu(true);
            }
        });
        createMenu.addEventListener("keydown", function (e) {
            var items = menuItems();
            var idx = items.indexOf(document.activeElement);
            if (e.key === "ArrowDown") {
                e.preventDefault();
                items[(idx + 1) % items.length].focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length].focus();
            } else if (e.key === "Home") {
                e.preventDefault();
                items[0].focus();
            } else if (e.key === "End") {
                e.preventDefault();
                items[items.length - 1].focus();
            } else if (e.key === "Escape") {
                toggleCreateMenu(false);
                createTrigger.focus();
            } else if (e.key === "Tab") {
                toggleCreateMenu(false);
            }
        });

        createOptions.forEach(function (opt) {
            opt.addEventListener("click", function () {
                var choice = opt.getAttribute("data-cmp-create-option");
                toggleCreateMenu(false);
                if (choice === "existing") {
                    openEmployeeDrawer();
                } else {
                    clearForm();
                    openCardDrawer();
                }
            });
        });

        /* =====================================================
           Filter dropdown
           ===================================================== */
        function setFilterOpen(open) {
            filterPanel.hidden = !open;
            filterTrigger.setAttribute("aria-expanded", open ? "true" : "false");
        }

        filterTrigger.addEventListener("click", function (e) {
            e.stopPropagation();
            setFilterOpen(filterPanel.hidden);
        });
        filterPanel.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                setFilterOpen(false);
                filterTrigger.focus();
            }
        });
        if (filterClear) {
            filterClear.addEventListener("click", function () {
                filterOpts.forEach(function (o) { o.checked = false; });
            });
        }
        if (filterApply) {
            filterApply.addEventListener("click", function () {
                activeStatuses = Array.prototype.slice.call(filterOpts)
                    .filter(function (o) { return o.checked; })
                    .map(function (o) { return o.value; });
                var n = activeStatuses.length;
                filterLabel.textContent = n === 0 ? "No filters applied" :
                    n + " filter" + (n === 1 ? "" : "s") + " applied";
                setFilterOpen(false);
                filterTrigger.focus();
                page = 1;
                render();
            });
        }

        document.addEventListener("click", function (e) {
            if (!createMenu.hidden && !createMenu.contains(e.target) && !createTrigger.contains(e.target)) {
                toggleCreateMenu(false);
            }
            if (!filterPanel.hidden && !filterPanel.contains(e.target) && !filterTrigger.contains(e.target)) {
                setFilterOpen(false);
            }
        });

        /* =====================================================
           Drawers
           ===================================================== */
        var lastFocused = null;

        function openDrawer(drawer) {
            lastFocused = document.activeElement;
            drawer.removeAttribute("hidden");
            document.body.style.overflow = "hidden";
            drawer.querySelector(".cmp-drawer__panel").focus();
        }

        function closeDrawer(drawer) {
            drawer.setAttribute("hidden", "");
            document.body.style.overflow = "";
            if (lastFocused && lastFocused.focus) {
                lastFocused.focus();
            }
        }

        function openEmployeeDrawer() {
            openDrawer(empDrawer);
            empInput.value = "";
            empResults.textContent = "";
            empInput.setAttribute("aria-expanded", "false");
        }

        function closeEmployeeDrawer() {
            closeDrawer(empDrawer);
        }

        function openCardDrawer() {
            openDrawer(cardDrawer);
        }

        function closeCardDrawer() {
            closeDrawer(cardDrawer);
        }

        empClose.addEventListener("click", closeEmployeeDrawer);
        empDrawer.querySelector(".cmp-drawer__backdrop").addEventListener("click", closeEmployeeDrawer);
        cardClose.addEventListener("click", closeCardDrawer);
        cardDrawer.querySelector(".cmp-drawer__backdrop").addEventListener("click", closeCardDrawer);

        empInput.addEventListener("input", function () {
            var term = empInput.value.trim().toLowerCase();
            empResults.textContent = "";
            if (!term) {
                empInput.setAttribute("aria-expanded", "false");
                return;
            }
            var matches = EMPLOYEES.filter(function (emp) {
                return emp.firstName.toLowerCase().indexOf(term) !== -1 ||
                    emp.lastName.toLowerCase().indexOf(term) !== -1 ||
                    emp.id.toLowerCase().indexOf(term) !== -1;
            });
            matches.forEach(function (emp) {
                var full = emp.firstName + " " + emp.lastName;
                var li = el("li", "cmp-empsel__item");
                li.setAttribute("role", "option");
                li.setAttribute("aria-selected", "false");
                var avatar = el("span", "cmp-avatar", emp.initials);
                avatar.setAttribute("aria-hidden", "true");
                var meta = el("div", "cmp-empsel__meta");
                meta.appendChild(el("span", "cmp-empsel__name", full));
                meta.appendChild(el("span", "cmp-empsel__sub", emp.id));
                var btn = el("button", "cmp-btn cmp-btn--text", "Select");
                btn.type = "button";
                btn.setAttribute("aria-label", "Select " + full);
                btn.addEventListener("click", function () {
                    closeEmployeeDrawer();
                    prefillForm(emp);
                    openCardDrawer();
                });
                li.appendChild(avatar);
                li.appendChild(meta);
                li.appendChild(btn);
                empResults.appendChild(li);
            });
            empInput.setAttribute("aria-expanded", matches.length > 0 ? "true" : "false");
        });

        /* =====================================================
           Create Card form
           ===================================================== */
        function field(name) {
            return cardForm.querySelector('[name="' + name + '"]');
        }

        function clearForm() {
            cardForm.reset();
            cardError.setAttribute("hidden", "");
            cardForm.querySelectorAll(".cmp-field__err").forEach(function (p) { p.setAttribute("hidden", ""); });
            cardForm.querySelectorAll('[aria-invalid="true"]').forEach(function (f) {
                f.removeAttribute("aria-invalid");
            });
            if (charCount) {
                charCount.textContent = "500";
            }
        }

        function prefillForm(emp) {
            clearForm();
            ["firstName", "lastName", "cardholderName", "workPhone", "addressLine1", "city", "state", "zip"]
                .forEach(function (name) {
                    field(name).value = emp[name];
                });
        }

        if (commentsField && charCount) {
            commentsField.addEventListener("input", function () {
                charCount.textContent = String(500 - commentsField.value.length);
            });
        }

        function setFieldError(f, invalid) {
            var errId = f.getAttribute("aria-errormessage");
            var errP = errId ? document.getElementById(errId) : null;
            if (invalid) {
                f.setAttribute("aria-invalid", "true");
                if (errP) {
                    errP.removeAttribute("hidden");
                }
            } else {
                f.removeAttribute("aria-invalid");
                if (errP) {
                    errP.setAttribute("hidden", "");
                }
            }
        }

        cardForm.addEventListener("submit", function (e) {
            e.preventDefault();
            cardError.setAttribute("hidden", "");
            var firstInvalid = null;
            cardForm.querySelectorAll("[required]").forEach(function (f) {
                var invalid = !f.value || f.value.trim() === "";
                setFieldError(f, invalid);
                if (invalid && !firstInvalid) {
                    firstInvalid = f;
                }
            });
            if (firstInvalid) {
                cardError.textContent = "Please fix the highlighted fields.";
                cardError.removeAttribute("hidden");
                firstInvalid.focus();
                return;
            }

            var first = field("firstName").value.trim();
            var last = field("lastName").value.trim();
            var holderName = field("cardholderName").value.trim();
            var amount = parseFloat(field("creditLimit").value || "0");
            var digits = field("workPhone").value.replace(/[^0-9]/g, "").slice(-4);

            var tr = buildRow({
                initials: (first.charAt(0) + last.charAt(0)).toUpperCase(),
                name: holderName,
                sub: digits || "0001",
                account: "Corporate account",
                limit: (isNaN(amount) ? 0 : amount).toLocaleString("en-US",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD",
                type: "Corporate card",
                status: "Active",
                updated: todayString()
            });

            /* Insert alphabetically by cardholder name. */
            var before = null;
            allRows().some(function (row) {
                if (rowName(row).localeCompare(holderName, undefined, { numeric: true, sensitivity: "base" }) > 0) {
                    before = row;
                    return true;
                }
                return false;
            });
            tbody.insertBefore(tr, before);

            /* Show the page that contains the new card. */
            var idx = matchingRows().indexOf(tr);
            if (idx !== -1) {
                page = Math.floor(idx / pageSize) + 1;
            }
            render();
            updateSelectionCount();

            closeCardDrawer();
            showToast("Card created for " + holderName + ".");
        });

        /* =====================================================
           Selection
           ===================================================== */
        function updateSelectionCount() {
            var count = tbody.querySelectorAll("[data-cmp-rowcheck]:checked").length;
            selectionCount.textContent = count + " card" + (count === 1 ? "" : "s") + " selected";
            updateCards.disabled = count === 0;
            updateSelectAllState();
        }

        tbody.addEventListener("change", function (e) {
            if (e.target && e.target.hasAttribute("data-cmp-rowcheck")) {
                updateSelectionCount();
            }
        });

        selectAll.addEventListener("change", function () {
            allRows().forEach(function (tr) {
                var c = tr.querySelector("[data-cmp-rowcheck]");
                if (c && !tr.hidden) {
                    c.checked = selectAll.checked;
                }
            });
            updateSelectionCount();
        });

        /* =====================================================
           Toast
           ===================================================== */
        var toastTimer = 0;

        function showToast(msg) {
            if (toastText) {
                toastText.textContent = msg;
            }
            toast.removeAttribute("hidden");
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(function () { toast.setAttribute("hidden", ""); }, 5000);
        }

        if (toastClose) {
            toastClose.addEventListener("click", function () {
                window.clearTimeout(toastTimer);
                toast.setAttribute("hidden", "");
            });
        }

        document.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") {
                return;
            }
            if (!empDrawer.hasAttribute("hidden")) {
                closeEmployeeDrawer();
            } else if (!cardDrawer.hasAttribute("hidden")) {
                closeCardDrawer();
            }
        });

        render();
        updateSelectionCount();
    }

    function safeInit(root) {
        try {
            init(root);
        } catch (err) {
            /* Keep other components on the page working. */
            window.console.warn("VSC Card Listing could not start", err);
        }
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-cardlist]")) {
            safeInit(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-cardlist]"), safeInit);
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
