/* VSC Code Expenses — list + coding panel + image linking (in-memory, no backend).
   List: Show / Filters / Find, Select all, Code selected expenses.
   Panel: summary + receipt (Manage), Coding / Details tabs, Spend Wizard,
   Expense template, split allocation, Cost Center / GL Account / Project pickers,
   description, Complete / Update / Reset.
   Image Linking: Linked Images / Image Library, Upload, Upload via Email,
   zoom, rotate, link / unlink, delete.
   All text is written with textContent; uploaded files are read locally only. */
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
        "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    var MAX_UPLOAD = 10 * 1024 * 1024;

    var CATS = {
        supplies: "Other Supplies", airline: "Airlines", professional: "Professional Services",
        transport: "Ground Transportation", restaurant: "Restaurants", office: "Office",
        other: "Other", car: "Auto Rentals"
    };
    var SUGGEST = {
        supplies: ["FIN", "500050"], airline: ["OPN", "500090"], professional: ["FIN", "500090"],
        transport: ["OPN", "500090"], restaurant: ["OPN", "500030"], office: ["FIN", "500050"],
        other: ["FIN", "500070"], car: ["OPN", "500090"]
    };
    var DIMS = {
        cc: { label: "Cost Center", options: [["FIN", "Finance"], ["HUR", "Human Resources"],
            ["ITI", "IT Integration"], ["LDV", "Learning & Development"], ["OPN", "Operations"],
            ["PROD", "Product"]] },
        gl: { label: "GL Account", options: [["500030", "Meals - Individual"], ["500040", "Memberships/Associations"],
            ["500050", "Office Supplies"], ["500060", "Printing & Copying"], ["500070", "Retail/Other Supplies"],
            ["500080", "Salaries Expense"], ["500090", "Services"], ["500110", "Technology <$5000"],
            ["500120", "Technology >$5000"]] },
        pr: { label: "Project", options: [["P100", "Website Refresh"], ["P200", "ERP Upgrade"],
            ["P300", "Office Move"]] }
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

    /* eslint-disable-next-line no-unused-vars */
    function useIcon(name, w, h) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h || w));
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        var use = document.createElementNS(SVG_NS, "use");
        use.setAttribute("href", "#cx-ico-" + name);
        svg.appendChild(use);
        return svg;
    }

    function nameOf(dim, code) {
        var found = DIMS[dim].options.filter(function (o) { return o[0] === code; })[0];
        return found ? found[1] : "";
    }

    function money(n) {
        return (Math.round(Number(n) * 100) / 100).toFixed(2);
    }

    function parseMoney(v) {
        var s = String(v || "").replace(/,/g, "").trim();
        return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
    }

    function parseUsDate(v) {
        var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || "");
        return m ? new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])) : null;
    }

    function parseIso(v) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    }

    function xml(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /* Illustrative receipt image (SVG data URI) for the demo data. */
    function receiptImage(merchant, amount, date) {
        var lines = ["Receipt #: 7749204", "Date: " + date, "Merchandise Purchase   $" + amount,
            "Subtotal", "Sales Tax", "Total   $" + amount, "Visa ************0006"];
        var body = lines.map(function (t, i) {
            return '<text x="18" y="' + (78 + i * 18) + '" font-size="11">' + xml(t) + "</text>";
        }).join("");
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300">' +
            '<rect width="240" height="300" fill="#b9956b"/>' +
            '<rect x="10" y="8" width="220" height="284" fill="#fbfaf6"/>' +
            '<g font-family="Courier New, monospace" fill="#333"><text x="120" y="40" font-size="15" ' +
            'text-anchor="middle" font-weight="bold">' + xml(merchant.toUpperCase().slice(0, 22)) + "</text>" +
            body + '<text x="120" y="270" font-size="10" text-anchor="middle">Thank you!</text></g></svg>';
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    function trap(container, e) {
        var items = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (n) {
            return (n.offsetWidth > 0 || n.offsetHeight > 0) && !n.closest("[hidden]");
        });
        if (!items.length) {
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
        if (!root || root.__codeexpInit) {
            return;
        }
        root.__codeexpInit = true;

        function q(sel) {
            return root.querySelector(sel);
        }
        function qa(sel) {
            return Array.prototype.slice.call(root.querySelectorAll(sel));
        }

        var list = q("[data-cmp-codeexp-list]");
        var emptyMsg = q("[data-cmp-codeexp-empty]");
        var status = q("[data-cmp-codeexp-status]");
        var showSel = q("#cx-show");
        var findInput = q("#cx-find");
        var filtersBtn = q("[data-cmp-codeexp-filters-btn]");
        var filtersPop = q("#cx-filters");
        var filtersLabel = q("[data-cmp-codeexp-filters-label]");
        var fCat = q("#cx-f-cat");
        var fRcpt = q("#cx-f-rcpt");
        var fFrom = q("#cx-f-from");
        var fTo = q("#cx-f-to");
        var selectAllBtn = q("[data-cmp-codeexp-selectall]");
        var codeSelBtn = q("[data-cmp-codeexp-codesel]");

        var panel = q("[data-cmp-codeexp-panel]");
        var ptitle = q("[data-cmp-codeexp-ptitle]");
        var form = q("[data-cmp-codeexp-form]");
        var formError = q("[data-cmp-codeexp-error]");
        var doneMsg = q("[data-cmp-codeexp-done]");
        var completeBtn = q("[data-cmp-codeexp-complete]");
        var updateBtn = q("[data-cmp-codeexp-update]");
        var desc = q("#cx-desc");
        var count = q("[data-cmp-codeexp-count]");
        var manageBtn = q("[data-cmp-codeexp-manage]");
        var managePop = q("#cx-manage");
        var rcptSel = q("#cx-rcpt");
        var tplBtn = q("[data-cmp-codeexp-tplbtn]");
        var tplMenu = q("#cx-tplmenu");
        var picker = q("[data-cmp-codeexp-picker]");
        var pickerTitle = q("[data-cmp-codeexp-picker-title]");
        var pickerQ = q("#cx-picker-q");
        var pickerList = q("[data-cmp-codeexp-options]");
        var pickerEmpty = q("[data-cmp-codeexp-options-empty]");

        var modal = q("[data-cmp-codeexp-modal]");
        var dialog = modal.querySelector(".cmp-codeexp__dialog");
        var fileInput = q("[data-cmp-codeexp-file]");
        var imgPop = q("[data-cmp-codeexp-imgpop]");
        var dstatus = q("[data-cmp-codeexp-dstatus]");

        var toast = q('[data-cmp-toast="codeexp"]');
        var toastText = toast ? toast.querySelector("[data-cmp-toast-text]") : null;

        var state = {};
        var images = [];
        var imgSeq = 2;
        var current = null;
        var opener = null;
        var dialogOpener = null;
        var pickerCtx = null;
        var imgCtx = null;
        var queue = [];

        /* ---------- data ---------- */
        function items() {
            return Array.prototype.slice.call(list.querySelectorAll("[data-cmp-codeexp-item]"));
        }

        function itemById(id) {
            return list.querySelector('[data-cmp-codeexp-item][data-id="' + id + '"]');
        }

        function info(li) {
            return {
                id: li.getAttribute("data-id"),
                merchant: li.getAttribute("data-merchant"),
                amount: li.getAttribute("data-amount"),
                date: li.getAttribute("data-date"),
                cat: li.getAttribute("data-cat")
            };
        }

        function blank(d) {
            return {
                splits: [{ amount: money(d.amount), taxCode: "N/A", tax: "0.00", cc: "FIN", gl: "", pr: "" }],
                description: "Purchase " + d.merchant,
                receiptAttached: "N/A",
                done: false
            };
        }

        function clone(o) {
            return JSON.parse(JSON.stringify(o));
        }

        function linkedTo(id) {
            return images.filter(function (img) { return img.linkedTo === id; });
        }

        items().forEach(function (li, i) {
            var d = info(li);
            var s = blank(d);
            state[d.id] = { saved: s, draft: clone(s) };
            if (li.getAttribute("data-receipt") === "yes") {
                images.push({ id: "img-" + d.id, name: i === 0 ? "IMG001.jpg" : "RCPT-" + d.id.toUpperCase() + ".jpg",
                    src: receiptImage(d.merchant, d.amount, d.date), rotate: 0, linkedTo: d.id });
            }
        });
        var first = items()[0];
        if (first) {
            var f0 = info(first);
            images.push({ id: "img-lib-1", name: "IMG002.jpg", src: receiptImage(f0.merchant, f0.amount, f0.date),
                rotate: 0, linkedTo: null });
        }

        /* Every page load starts from the original list (nothing is stored).
           Remove data saved by an earlier version of this component. */
        try {
            window.localStorage.removeItem("vsc-codeexp:" + window.location.pathname + ":" +
                (root.id || "default"));
        } catch (err) {
            /* Storage unavailable: nothing to clean up. */
        }

        function announce(el2, text) {
            el2.textContent = "";
            window.setTimeout(function () { el2.textContent = text; }, 30);
        }

        var toastTimer = 0;
        function showToast(message) {
            if (!toast) {
                return;
            }
            toastText.textContent = message;
            toast.hidden = false;
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(function () { toast.hidden = true; }, 8000);
        }
        if (toast) {
            toast.querySelector("[data-cmp-toast-close]").addEventListener("click", function () {
                window.clearTimeout(toastTimer);
                toast.hidden = true;
            });
        }

        /* =====================================================
           List: Show / Filters / Find
           ===================================================== */
        function activeFilters() {
            return [fCat.value, fRcpt.value, fFrom.value, fTo.value].filter(Boolean).length;
        }

        function matches(li) {
            var d = info(li);
            var done = state[d.id].saved.done;
            var hasRcpt = linkedTo(d.id).length > 0;
            var show = showSel.value;
            if (show === "My expenses" && done) {
                return false;
            }
            if (show === "Completed expenses" && !done) {
                return false;
            }
            if (show === "Missing receipts" && hasRcpt) {
                return false;
            }
            if (fCat.value && CATS[d.cat] !== fCat.value) {
                return false;
            }
            if (fRcpt.value === "Attached" && !hasRcpt) {
                return false;
            }
            if (fRcpt.value === "Missing" && hasRcpt) {
                return false;
            }
            var when = parseUsDate(d.date);
            var from = parseIso(fFrom.value);
            var to = parseIso(fTo.value);
            if (when && from && when < from) {
                return false;
            }
            if (when && to && when > to) {
                return false;
            }
            var term = findInput.value.trim().toLowerCase();
            if (term && (d.merchant + " " + d.amount + " " + d.date + " " + CATS[d.cat]).toLowerCase()
                .indexOf(term) === -1) {
                return false;
            }
            return true;
        }

        function renderList(announceIt) {
            var shown = 0;
            items().forEach(function (li) {
                var ok = matches(li);
                li.hidden = !ok;
                if (ok) {
                    shown += 1;
                }
                var id = li.getAttribute("data-id");
                li.querySelector("[data-cmp-codeexp-rcpt]").hidden = linkedTo(id).length > 0;
                li.setAttribute("data-done", state[id].saved.done ? "true" : "false");
            });
            emptyMsg.hidden = shown > 0;
            var n = activeFilters();
            filtersLabel.textContent = n ? n + " applied" : "Default";
            updateSelection();
            if (announceIt) {
                announce(status, shown + " expense" + (shown === 1 ? "" : "s") + " shown");
            }
        }

        function checked() {
            return items().filter(function (li) {
                return !li.hidden && li.querySelector("[data-cmp-codeexp-check]").checked;
            });
        }

        function updateSelection() {
            var visible = items().filter(function (li) { return !li.hidden; });
            var n = checked().length;
            codeSelBtn.disabled = n === 0;
            var all = visible.length > 0 && n === visible.length;
            selectAllBtn.setAttribute("aria-pressed", all ? "true" : "false");
            selectAllBtn.textContent = all ? "Clear selection" : "Select all";
        }

        showSel.addEventListener("change", function () { renderList(true); });
        findInput.addEventListener("input", function () { renderList(false); });
        findInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                renderList(true);
            }
        });
        q("[data-cmp-codeexp-find-btn]").addEventListener("click", function () { renderList(true); });

        function setPop(btn, pop, open) {
            pop.hidden = !open;
            btn.setAttribute("aria-expanded", open ? "true" : "false");
        }

        filtersBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var open = filtersPop.hidden;
            setPop(filtersBtn, filtersPop, open);
            if (open) {
                fCat.focus();
            }
        });
        q("[data-cmp-codeexp-filters-apply]").addEventListener("click", function () {
            setPop(filtersBtn, filtersPop, false);
            filtersBtn.focus();
            renderList(true);
        });
        q("[data-cmp-codeexp-filters-clear]").addEventListener("click", function () {
            fCat.value = "";
            fRcpt.value = "";
            fFrom.value = "";
            fTo.value = "";
            renderList(true);
        });

        list.addEventListener("change", function (e) {
            if (e.target.hasAttribute("data-cmp-codeexp-check")) {
                updateSelection();
            }
        });
        selectAllBtn.addEventListener("click", function () {
            var visible = items().filter(function (li) { return !li.hidden; });
            var all = checked().length === visible.length && visible.length > 0;
            visible.forEach(function (li) { li.querySelector("[data-cmp-codeexp-check]").checked = !all; });
            updateSelection();
            announce(status, all ? "Selection cleared" : visible.length + " expenses selected");
        });
        codeSelBtn.addEventListener("click", function () {
            queue = checked().map(function (li) { return li.getAttribute("data-id"); });
            if (queue.length) {
                openPanel(queue.shift(), codeSelBtn);
            }
        });

        list.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-cmp-codeexp-open]") : null;
            if (btn) {
                queue = [];
                openPanel(btn.closest("[data-cmp-codeexp-item]").getAttribute("data-id"), btn);
            }
        });

        /* =====================================================
           Panel
           ===================================================== */
        function fieldsFor(n) {
            return { amount: q("#cx-amt-" + n), code: q("#cx-code-" + n), tax: q("#cx-tax-" + n),
                block: q('[data-cmp-codeexp-split="' + n + '"]') };
        }

        function setText(key, value) {
            qa('[data-cx="' + key + '"]').forEach(function (n) { n.textContent = value; });
        }

        function renderSummary() {
            var d = info(itemById(current));
            var s = state[current];
            var linked = linkedTo(current);
            ptitle.textContent = d.merchant;
            setText("merchant", d.merchant);
            setText("amount", money(d.amount) + " USD");
            setText("date", d.date);
            setText("catname", CATS[d.cat]);
            setText("receipt", linked.length ? linked.length + " linked (" + linked.map(function (i) {
                return i.name;
            }).join(", ") + ")" : "Missing");
            setText("state", s.saved.done ? "Submitted for approval" : "Awaiting coding");
            var use = q('[data-cx="catico"] use');
            if (use) {
                use.setAttribute("href", "#cx-ico-" + d.cat);
            }
            var img = q("[data-cmp-codeexp-thumbimg]");
            img.hidden = !linked.length;
            q("[data-cmp-codeexp-nothumb]").hidden = linked.length > 0;
            if (linked.length) {
                img.src = linked[0].src;
            }
            q("[data-cmp-codeexp-thumblabel]").textContent = linked.length ?
                "Receipt image " + linked[0].name + ", open image linking" : "No receipt linked, open image linking";
        }

        function renderCells(n) {
            var split = state[current].draft.splits[n - 1];
            var block = fieldsFor(n).block;
            var readOnly = state[current].saved.done;
            ["cc", "gl", "pr"].forEach(function (dim) {
                var cell = block.querySelector('[data-dim="' + dim + '"] [data-cmp-codeexp-cell]');
                cell.textContent = "";
                var label = DIMS[dim].label;
                if (split[dim]) {
                    var name = nameOf(dim, split[dim]);
                    var change = el("button", "cmp-codeexp__chip");
                    change.type = "button";
                    change.disabled = readOnly;
                    change.setAttribute("aria-label", label + ": " + split[dim] + " " + name + ". Change");
                    change.setAttribute("data-pick", dim);
                    change.appendChild(el("span", "cmp-codeexp__code", split[dim]));
                    change.appendChild(el("span", "cmp-codeexp__codename", name));
                    var clear = el("button", "cmp-codeexp__clear");
                    clear.type = "button";
                    clear.disabled = readOnly;
                    clear.setAttribute("aria-label", "Remove " + label + " " + split[dim]);
                    clear.setAttribute("data-clear", dim);
                    clear.appendChild(el("span", null, "×"));
                    clear.firstChild.setAttribute("aria-hidden", "true");
                    cell.appendChild(change);
                    cell.appendChild(clear);
                } else {
                    var add = el("button", "cmp-codeexp__add" + (dim === "gl" ? " cmp-codeexp__add--required" : ""));
                    add.type = "button";
                    add.disabled = readOnly;
                    add.setAttribute("data-pick", dim);
                    add.setAttribute("aria-label", "Choose " + label + (dim === "gl" ? " (required)" : ""));
                    add.appendChild(el("span", null, "+"));
                    add.firstChild.setAttribute("aria-hidden", "true");
                    cell.appendChild(add);
                }
            });
        }

        function fillForm() {
            var s = state[current];
            var d = s.draft;
            [1, 2].forEach(function (n) {
                var fl = fieldsFor(n);
                var sp = d.splits[n - 1];
                fl.block.hidden = !sp;
                if (sp) {
                    fl.amount.value = sp.amount;
                    fl.code.value = sp.taxCode;
                    fl.tax.value = sp.tax;
                    renderCells(n);
                }
            });
            desc.value = d.description;
            rcptSel.value = d.receiptAttached;
            updateCount();
            clearErrors();
            var readOnly = s.saved.done;
            Array.prototype.forEach.call(form.elements, function (n) {
                if (n !== completeBtn && n.tagName !== "BUTTON") {
                    n.disabled = readOnly;
                }
            });
            qa("[data-cmp-codeexp-split-btn], [data-cmp-codeexp-unsplit], [data-cmp-codeexp-wizard], " +
                "[data-cmp-codeexp-tplbtn], [data-cmp-codeexp-reset]").forEach(function (b) { b.disabled = readOnly; });
            completeBtn.disabled = readOnly;
            doneMsg.hidden = !readOnly;
            setDirty(false);
        }

        function readForm() {
            var d = state[current].draft;
            [1, 2].forEach(function (n) {
                var sp = d.splits[n - 1];
                if (sp) {
                    var fl = fieldsFor(n);
                    sp.amount = fl.amount.value.trim();
                    sp.taxCode = fl.code.value;
                    sp.tax = fl.tax.value.trim();
                }
            });
            d.description = desc.value;
            d.receiptAttached = rcptSel.value;
        }

        function setDirty(dirty) {
            updateBtn.disabled = !dirty || state[current].saved.done;
        }

        function openPanel(id, from) {
            if (current && current !== id) {
                markRow(current, false);
            }
            current = id;
            opener = from || null;
            state[id].draft = clone(state[id].saved);
            closePops();
            selectTab(q("#cx-tab-coding"), false);
            renderSummary();
            fillForm();
            panel.hidden = false;
            root.classList.add("cmp-codeexp--open");
            markRow(id, true);
            ptitle.focus();
        }

        function markRow(id, on) {
            var li = itemById(id);
            if (!li) {
                return;
            }
            li.classList.toggle("is-current", on);
            li.querySelector("[data-cmp-codeexp-open]").setAttribute("aria-expanded", on ? "true" : "false");
        }

        function closePanel() {
            closePops();
            panel.hidden = true;
            root.classList.remove("cmp-codeexp--open");
            if (current) {
                markRow(current, false);
            }
            var back = opener && document.documentElement.contains(opener) && !opener.closest("[hidden]") ?
                opener : null;
            current = null;
            if (back) {
                back.focus();
            } else {
                var heading = q("#cmp-codeexp-title");
                heading.setAttribute("tabindex", "-1");
                heading.focus();
            }
        }

        q("[data-cmp-codeexp-close]").addEventListener("click", closePanel);

        /* Tabs (ARIA tabs pattern) */
        function selectTab(tab, focus) {
            tab.parentNode.querySelectorAll('[role="tab"]').forEach(function (t) {
                var on = t === tab;
                t.setAttribute("aria-selected", on ? "true" : "false");
                t.tabIndex = on ? 0 : -1;
                var tp = document.getElementById(t.getAttribute("aria-controls"));
                if (tp) {
                    tp.hidden = !on;
                }
            });
            if (focus) {
                tab.focus();
            }
        }

        function tabKeys(e) {
            var tabs = Array.prototype.slice.call(e.currentTarget.querySelectorAll('[role="tab"]'));
            var i = tabs.indexOf(document.activeElement);
            var next = null;
            if (e.key === "ArrowRight") {
                next = tabs[(i + 1) % tabs.length];
            } else if (e.key === "ArrowLeft") {
                next = tabs[(i - 1 + tabs.length) % tabs.length];
            } else if (e.key === "Home") {
                next = tabs[0];
            } else if (e.key === "End") {
                next = tabs[tabs.length - 1];
            }
            if (next) {
                e.preventDefault();
                selectTab(next, true);
            }
        }

        qa('[role="tablist"]').forEach(function (tl) {
            tl.addEventListener("keydown", tabKeys);
            tl.addEventListener("click", function (e) {
                var tab = e.target.closest ? e.target.closest('[role="tab"]') : null;
                if (tab) {
                    selectTab(tab, false);
                }
            });
        });

        /* Form changes */
        form.addEventListener("input", function (e) {
            if (!current) {
                return;
            }
            if (e.target === desc) {
                updateCount();
            }
            if (e.target.getAttribute("aria-invalid") === "true") {
                setError(e.target, "");
            }
            readForm();
            setDirty(true);
        });
        form.addEventListener("change", function () {
            if (current) {
                readForm();
                setDirty(true);
            }
        });

        function updateCount() {
            var left = 500 - desc.value.length;
            count.textContent = left + " character" + (left === 1 ? "" : "s") + " left";
        }
        desc.setAttribute("aria-describedby", (desc.getAttribute("aria-describedby") || "") + " cx-desc-count");

        /* Split */
        q("[data-cmp-codeexp-split-btn]").addEventListener("click", function () {
            readForm();
            var d = state[current].draft;
            if (d.splits.length > 1) {
                fieldsFor(2).amount.focus();
                return;
            }
            var total = parseMoney(itemById(current).getAttribute("data-amount"));
            var half = Math.floor(total * 50) / 100;
            d.splits[0].amount = money(total - half);
            d.splits.push({ amount: money(half), taxCode: "N/A", tax: "0.00", cc: d.splits[0].cc, gl: "", pr: "" });
            var saved = state[current].saved.done;
            fillForm();
            setDirty(!saved);
            fieldsFor(2).amount.focus();
            announce(status, "Allocation 2 added. Amounts split 50/50.");
        });
        q("[data-cmp-codeexp-unsplit]").addEventListener("click", function () {
            readForm();
            var d = state[current].draft;
            d.splits = [d.splits[0]];
            d.splits[0].amount = money(itemById(current).getAttribute("data-amount"));
            fillForm();
            setDirty(true);
            fieldsFor(1).amount.focus();
            announce(status, "Allocation 2 removed.");
        });

        /* Spend Wizard + Expense template */
        function applyCoding(cc, gl, pr, source) {
            readForm();
            state[current].draft.splits.forEach(function (sp) {
                sp.cc = cc;
                sp.gl = gl;
                if (pr !== undefined) {
                    sp.pr = pr;
                }
            });
            [1, 2].forEach(function (n) {
                if (state[current].draft.splits[n - 1]) {
                    renderCells(n);
                }
            });
            setDirty(true);
            announce(status, source + " applied: Cost Center " + cc + " " + nameOf("cc", cc) +
                ", GL Account " + gl + " " + nameOf("gl", gl) + ".");
        }

        q("[data-cmp-codeexp-wizard]").addEventListener("click", function () {
            var s = SUGGEST[itemById(current).getAttribute("data-cat")] || ["FIN", "500070"];
            applyCoding(s[0], s[1], undefined, "Suggested coding");
        });

        function menuItems() {
            return Array.prototype.slice.call(tplMenu.querySelectorAll('[role="menuitem"]'));
        }
        function setMenu(open, focusFirst) {
            setPop(tplBtn, tplMenu, open);
            if (open && focusFirst) {
                menuItems()[0].focus();
            }
        }
        tplBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            setMenu(tplMenu.hidden, true);
        });
        tplBtn.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setMenu(true, true);
            }
        });
        tplMenu.addEventListener("keydown", function (e) {
            var its = menuItems();
            var i = its.indexOf(document.activeElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                its[(i + (e.key === "ArrowDown" ? 1 : -1) + its.length) % its.length].focus();
            } else if (e.key === "Escape" || e.key === "Esc") {
                e.preventDefault();
                e.stopPropagation();
                setMenu(false);
                tplBtn.focus();
            } else if (e.key === "Tab") {
                setMenu(false);
            }
        });
        tplMenu.querySelectorAll("[data-cmp-codeexp-tpl]").forEach(function (it) {
            it.addEventListener("click", function () {
                var p = it.getAttribute("data-cmp-codeexp-tpl").split("|");
                setMenu(false);
                tplBtn.focus();
                applyCoding(p[0], p[1], p[2], "Template " + it.textContent.trim());
            });
        });

        /* Code pickers */
        function renderOptions() {
            var term = pickerQ.value.trim().toLowerCase();
            var dim = pickerCtx.dim;
            var suggested = dim === "gl" ? (SUGGEST[itemById(current).getAttribute("data-cat")] || [])[1] : null;
            pickerList.textContent = "";
            var shown = 0;
            DIMS[dim].options.forEach(function (o) {
                if (term && (o[0] + " " + o[1]).toLowerCase().indexOf(term) === -1) {
                    return;
                }
                shown += 1;
                var li = el("li");
                var b = el("button", "cmp-codeexp__option");
                b.type = "button";
                b.setAttribute("data-code", o[0]);
                b.appendChild(el("span", "cmp-codeexp__code", o[0]));
                b.appendChild(el("span", "cmp-codeexp__codename", o[1]));
                if (o[0] === suggested) {
                    var star = el("span", "cmp-codeexp__star", "★");
                    star.setAttribute("aria-hidden", "true");
                    b.appendChild(star);
                    b.appendChild(el("span", "cmp-visually-hidden", ", suggested"));
                }
                li.appendChild(b);
                pickerList.appendChild(li);
            });
            pickerEmpty.hidden = shown > 0;
        }

        function openPicker(anchor, n, dim) {
            closePops();
            pickerCtx = { anchor: anchor, n: n, dim: dim };
            pickerTitle.textContent = "Choose " + DIMS[dim].label;
            pickerQ.value = "";
            renderOptions();
            picker.hidden = false;
            var pr = panel.getBoundingClientRect();
            var ar = anchor.getBoundingClientRect();
            picker.style.top = (ar.bottom - pr.top + panel.scrollTop + 4) + "px";
            picker.style.left = Math.max(8, Math.min(ar.left - pr.left, pr.width - picker.offsetWidth - 8)) + "px";
            pickerQ.focus();
        }

        function closePicker(restore) {
            if (picker.hidden) {
                return;
            }
            picker.hidden = true;
            if (restore && pickerCtx && document.documentElement.contains(pickerCtx.anchor)) {
                pickerCtx.anchor.focus();
            }
            pickerCtx = null;
        }

        pickerQ.addEventListener("input", renderOptions);
        picker.addEventListener("keydown", function (e) {
            var opts = Array.prototype.slice.call(pickerList.querySelectorAll("button"));
            var i = opts.indexOf(document.activeElement);
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (opts.length) {
                    opts[Math.min(i + 1, opts.length - 1)].focus();
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (i <= 0) {
                    pickerQ.focus();
                } else {
                    opts[i - 1].focus();
                }
            } else if (e.key === "Escape" || e.key === "Esc") {
                e.preventDefault();
                e.stopPropagation();
                closePicker(true);
            } else if (e.key === "Enter" && document.activeElement === pickerQ && opts.length) {
                e.preventDefault();
                opts[0].click();
            }
        });
        pickerList.addEventListener("click", function (e) {
            var b = e.target.closest ? e.target.closest("[data-code]") : null;
            if (!b || !pickerCtx) {
                return;
            }
            var ctx = pickerCtx;
            readForm();
            state[current].draft.splits[ctx.n - 1][ctx.dim] = b.getAttribute("data-code");
            closePicker(false);
            renderCells(ctx.n);
            setDirty(true);
            setError(null, "", ctx.n);
            var again = fieldsFor(ctx.n).block.querySelector('[data-dim="' + ctx.dim + '"] [data-pick]');
            if (again) {
                again.focus();
            }
        });

        q(".cmp-codeexp__splits").addEventListener("click", function (e) {
            var pick = e.target.closest ? e.target.closest("[data-pick]") : null;
            var clear = e.target.closest ? e.target.closest("[data-clear]") : null;
            var block = e.target.closest ? e.target.closest("[data-cmp-codeexp-split]") : null;
            if (!block) {
                return;
            }
            var n = Number(block.getAttribute("data-cmp-codeexp-split"));
            if (pick) {
                e.stopPropagation();
                openPicker(pick, n, pick.getAttribute("data-pick"));
            } else if (clear) {
                var dim = clear.getAttribute("data-clear");
                readForm();
                state[current].draft.splits[n - 1][dim] = "";
                renderCells(n);
                setDirty(true);
                block.querySelector('[data-dim="' + dim + '"] [data-pick]').focus();
                announce(status, DIMS[dim].label + " removed");
            }
        });

        /* Validation + Complete / Update / Reset */
        function clearErrors() {
            formError.hidden = true;
            form.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
            form.querySelectorAll(".cmp-field__err, [data-cmp-codeexp-split-err]").forEach(function (n) {
                n.hidden = true;
            });
        }

        function setError(input, message, n) {
            if (!input) {
                var box = fieldsFor(n).block.querySelector("[data-cmp-codeexp-split-err]");
                box.textContent = message;
                box.hidden = !message;
                return !message;
            }
            var err = document.getElementById(input.id + "-err");
            if (message) {
                input.setAttribute("aria-invalid", "true");
            } else {
                input.removeAttribute("aria-invalid");
            }
            if (err) {
                err.textContent = message;
                err.hidden = !message;
            }
            return !message;
        }

        function validate(full) {
            clearErrors();
            readForm();
            var d = state[current].draft;
            var total = parseMoney(itemById(current).getAttribute("data-amount"));
            var invalid = [];
            var sum = 0;
            d.splits.forEach(function (sp, i) {
                var fl = fieldsFor(i + 1);
                var amt = parseMoney(sp.amount);
                if (!setError(fl.amount, isNaN(amt) || amt <= 0 ? "Enter an amount greater than 0, e.g. 45.99." : "")) {
                    invalid.push(fl.amount);
                } else {
                    sum += amt;
                }
                var tax = parseMoney(sp.tax || "0");
                if (!setError(fl.tax, isNaN(tax) || (!isNaN(amt) && tax > amt) ?
                    "Enter a tax amount up to the allocation amount." : "")) {
                    invalid.push(fl.tax);
                }
                if (full) {
                    var missing = [];
                    if (!sp.cc) {
                        missing.push("Cost Center");
                    }
                    if (!sp.gl) {
                        missing.push("GL Account");
                    }
                    if (!setError(null, missing.length ? "Choose " + missing.join(" and ") + "." : "", i + 1)) {
                        invalid.push(fl.block.querySelector("[data-pick]"));
                    }
                }
            });
            if (!invalid.length && Math.round(sum * 100) !== Math.round(total * 100)) {
                setError(fieldsFor(1).amount, "Allocations must add up to " + money(total) + " USD (now " +
                    money(sum) + ").");
                invalid.push(fieldsFor(1).amount);
            }
            if (invalid.length) {
                formError.textContent = "Please fix the highlighted coding before continuing.";
                formError.hidden = false;
                invalid[0].focus();
                return false;
            }
            return true;
        }

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!current || state[current].saved.done || !validate(true)) {
                return;
            }
            var s = state[current];
            s.draft.done = true;
            s.saved = clone(s.draft);
            var name = itemById(current).getAttribute("data-merchant");
            var nextId = null;
            while (queue.length && !nextId) {
                var cand = queue.shift();
                if (!state[cand].saved.done) {
                    nextId = cand;
                }
            }
            var nextRow = null;
            var all = items();
            var idx = all.indexOf(itemById(current));
            for (var k = idx + 1; k < all.length && !nextRow; k++) {
                if (!all[k].hidden && !state[all[k].getAttribute("data-id")].saved.done) {
                    nextRow = all[k];
                }
            }
            showToast("Expense coded and submitted for approval.");
            announce(status, name + " submitted for approval and removed from the list.");
            if (nextId) {
                renderList(false);
                openPanel(nextId, opener);
                return;
            }
            /* Close the side panel, then drop the completed row from the list. */
            opener = nextRow ? nextRow.querySelector("[data-cmp-codeexp-open]") : null;
            closePanel();
            renderList(false);
        });

        updateBtn.addEventListener("click", function () {
            if (!validate(false)) {
                return;
            }
            var s = state[current];
            s.saved = clone(s.draft);
            setDirty(false);
            renderSummary();
            showToast("Expense coding saved.");
        });

        q("[data-cmp-codeexp-reset]").addEventListener("click", function () {
            state[current].draft = clone(state[current].saved);
            fillForm();
            announce(status, "Changes reset.");
        });

        /* Manage menu */
        manageBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var open = managePop.hidden;
            closePops();
            setPop(manageBtn, managePop, open);
            if (open) {
                managePop.querySelector("button").focus();
            }
        });
        q("[data-cmp-codeexp-library]").addEventListener("click", function () {
            setPop(manageBtn, managePop, false);
            openDialog("library", manageBtn);
        });
        q("[data-cmp-codeexp-thumb]").addEventListener("click", function (e) {
            openDialog("linked", e.currentTarget);
        });

        function closePops() {
            if (!filtersPop.hidden) {
                setPop(filtersBtn, filtersPop, false);
            }
            if (!managePop.hidden) {
                setPop(manageBtn, managePop, false);
            }
            if (!tplMenu.hidden) {
                setMenu(false);
            }
            closePicker(false);
        }

        document.addEventListener("click", function (e) {
            [[filtersBtn, filtersPop], [manageBtn, managePop], [tplBtn, tplMenu]].forEach(function (pair) {
                if (!pair[1].hidden && !pair[1].contains(e.target) && !pair[0].contains(e.target)) {
                    setPop(pair[0], pair[1], false);
                }
            });
            if (!picker.hidden && !picker.contains(e.target)) {
                closePicker(false);
            }
        });

        /* =====================================================
           Image Linking dialog
           ===================================================== */
        function renderImages() {
            var lists = { linked: q("[data-cmp-codeexp-linked]"), library: q("[data-cmp-codeexp-library-list]") };
            lists.linked.textContent = "";
            lists.library.textContent = "";
            var counts = { linked: 0, library: 0 };
            images.forEach(function (img) {
                var where = img.linkedTo === current ? "linked" : (img.linkedTo ? null : "library");
                if (!where) {
                    return;
                }
                counts[where] += 1;
                var li = el("li", "cmp-codeexp__imgitem");
                var b = el("button", "cmp-codeexp__imgbtn");
                b.type = "button";
                b.setAttribute("data-img", img.id);
                b.setAttribute("aria-label", img.name + (where === "linked" ? ", linked" : ", not linked") +
                    ". Image actions");
                var im = el("img");
                im.src = img.src;
                im.alt = "";
                im.width = 240;
                im.height = 300;
                im.style.transform = "rotate(" + img.rotate + "deg)";
                b.appendChild(im);
                var cap = el("span", "cmp-codeexp__imgname", img.name);
                cap.setAttribute("aria-hidden", "true");
                b.appendChild(cap);
                if (where === "linked") {
                    var ok = el("span", "cmp-codeexp__imgok", "✓");
                    ok.setAttribute("aria-hidden", "true");
                    b.appendChild(ok);
                }
                li.appendChild(b);
                lists[where].appendChild(li);
            });
            q("[data-cmp-codeexp-linked-empty]").hidden = counts.linked > 0;
            q("[data-cmp-codeexp-library-empty]").hidden = counts.library > 0;
        }

        function openDialog(tab, from) {
            if (!current) {
                return;
            }
            closePops();
            dialogOpener = from || document.activeElement;
            var d = info(itemById(current));
            q("[data-cmp-codeexp-dmeta]").textContent = "Big Bank 1: " + d.date.replace(/^0/, "") +
                "  Amount: $" + money(d.amount) + " USD";
            renderImages();
            selectTab(q(tab === "library" ? "#cx-itab-library" : "#cx-itab-linked"), false);
            modal.hidden = false;
            if (dialog.scrollIntoView) {
                dialog.scrollIntoView({ block: "nearest" });
            }
            q(tab === "library" ? "#cx-itab-library" : "#cx-itab-linked").focus({ preventScroll: true });
        }

        function closeImgPop(restore) {
            if (imgPop.hidden) {
                return;
            }
            imgPop.hidden = true;
            var back = imgCtx && dialog.querySelector('[data-img="' + imgCtx.id + '"]');
            imgCtx = null;
            if (restore && back) {
                back.focus();
            }
        }

        function closeDialog() {
            closeImgPop(false);
            modal.hidden = true;
            renderSummary();
            renderList(false);
            if (dialogOpener && document.documentElement.contains(dialogOpener)) {
                dialogOpener.focus();
            }
        }

        q("[data-cmp-codeexp-dclose]").addEventListener("click", closeDialog);
        q("[data-cmp-codeexp-backdrop]").addEventListener("click", closeDialog);

        q("[data-cmp-codeexp-upload]").addEventListener("click", function () { fileInput.click(); });
        fileInput.addEventListener("change", function () {
            var files = Array.prototype.slice.call(fileInput.files || []);
            var added = 0;
            var rejected = 0;
            var pending = files.length;
            function doneOne() {
                pending -= 1;
                if (pending === 0) {
                    renderImages();
                    selectTab(q("#cx-itab-library"), false);
                    announce(dstatus, added + " receipt" + (added === 1 ? "" : "s") + " added to the Image Library" +
                        (rejected ? ", " + rejected + " skipped (images up to 10 MB only)" : "") + ".");
                }
            }
            files.forEach(function (file) {
                if (!/^image\//.test(file.type) || file.size > MAX_UPLOAD) {
                    rejected += 1;
                    doneOne();
                    return;
                }
                var reader = new FileReader();
                reader.addEventListener("load", function () {
                    imgSeq += 1;
                    images.push({ id: "img-up-" + imgSeq, name: file.name, src: String(reader.result),
                        rotate: 0, linkedTo: null });
                    added += 1;
                    doneOne();
                });
                reader.addEventListener("error", function () {
                    rejected += 1;
                    doneOne();
                });
                reader.readAsDataURL(file);
            });
            fileInput.value = "";
        });

        var emailBtn = q("[data-cmp-codeexp-email]");
        emailBtn.addEventListener("click", function () {
            var infoBox = q("[data-cmp-codeexp-emailinfo]");
            infoBox.hidden = !infoBox.hidden;
            emailBtn.setAttribute("aria-expanded", infoBox.hidden ? "false" : "true");
        });

        dialog.addEventListener("click", function (e) {
            var b = e.target.closest ? e.target.closest("[data-img]") : null;
            if (!b) {
                return;
            }
            var img = images.filter(function (i) { return i.id === b.getAttribute("data-img"); })[0];
            if (!img) {
                return;
            }
            imgCtx = img;
            q("[data-cmp-codeexp-imgname]").textContent = img.name;
            imgPop.querySelector('[data-cmp-codeexp-img="link"]').textContent = img.linkedTo ? "Unlink" : "Link";
            var zoom = imgPop.querySelector('[data-cmp-codeexp-img="zoom"]');
            zoom.setAttribute("aria-pressed", b.parentNode.classList.contains("is-zoomed") ? "true" : "false");
            imgPop.hidden = false;
            var dr = dialog.getBoundingClientRect();
            var br = b.getBoundingClientRect();
            imgPop.style.top = Math.max(8, br.top - dr.top + dialog.scrollTop + br.height * 0.55) + "px";
            imgPop.style.left = Math.min(br.right - dr.left - 24, dr.width - imgPop.offsetWidth - 8) + "px";
            zoom.focus();
        });

        q("[data-cmp-codeexp-imgclose]").addEventListener("click", function () { closeImgPop(true); });

        imgPop.addEventListener("click", function (e) {
            var act = e.target.closest ? e.target.closest("[data-cmp-codeexp-img]") : null;
            if (!act || !imgCtx) {
                return;
            }
            var a = act.getAttribute("data-cmp-codeexp-img");
            var img = imgCtx;
            var btn = dialog.querySelector('[data-img="' + img.id + '"]');
            if (a === "zoom") {
                var z = btn.parentNode.classList.toggle("is-zoomed");
                act.setAttribute("aria-pressed", z ? "true" : "false");
                announce(dstatus, img.name + (z ? " enlarged" : " reduced"));
            } else if (a === "left" || a === "right") {
                img.rotate = (img.rotate + (a === "left" ? -90 : 90) + 360) % 360;
                btn.querySelector("img").style.transform = "rotate(" + img.rotate + "deg)";
                announce(dstatus, img.name + " rotated " + (a === "left" ? "left" : "right"));
                } else if (a === "link") {
                var linking = !img.linkedTo;
                img.linkedTo = linking ? current : null;
                if (linking && state[current]) {
                    state[current].draft.receiptAttached = "Yes";
                    state[current].saved.receiptAttached = "Yes";
                    rcptSel.value = "Yes";
                }
                closeImgPop(false);
                if (linking) {
                    /* Linked: close Image Linking and go back to the coding form. */
                    closeDialog();
                    selectTab(q("#cx-tab-coding"), false);
                    announce(status, img.name + " linked to this expense. Receipt attached.");
                } else {
                    renderImages();
                    selectTab(q("#cx-itab-library"), true);
                    announce(dstatus, img.name + " moved to the Image Library");
                }
                } else if (a === "delete") {
                images = images.filter(function (i) { return i !== img; });
                closeImgPop(false);
                renderImages();
                dialog.querySelector('.cmp-codeexp__dtabs [aria-selected="true"]').focus();
                announce(dstatus, img.name + " deleted");
                }
        });

        /* =====================================================
           Keyboard: Esc + focus trap
           ===================================================== */
        document.addEventListener("keydown", function (e) {
            var esc = e.key === "Escape" || e.key === "Esc";
            if (!modal.hidden) {
                if (esc) {
                    e.preventDefault();
                    if (!imgPop.hidden) {
                        closeImgPop(true);
                    } else {
                        closeDialog();
                    }
                } else if (e.key === "Tab") {
                    trap(dialog, e);
                }
                return;
            }
            if (!esc || e.defaultPrevented) {
                return;
            }
            if (!filtersPop.hidden) {
                setPop(filtersBtn, filtersPop, false);
                filtersBtn.focus();
            } else if (!managePop.hidden) {
                setPop(manageBtn, managePop, false);
                manageBtn.focus();
            } else if (!picker.hidden) {
                closePicker(true);
            } else if (!panel.hidden && panel.contains(document.activeElement)) {
                closePanel();
            }
        });

        renderList(false);
    }

    function safeInit(root) {
        try {
            init(root);
        } catch (err) {
            window.console.warn("VSC Code Expenses could not start", err);
        }
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-codeexp]")) {
            safeInit(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-codeexp]"), safeInit);
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
