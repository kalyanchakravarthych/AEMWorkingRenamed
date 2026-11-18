/* VSC Expense Categories (Charge Codes) — in-memory, no backend.
   Toolbar: Search (filter bar) · Create (dialog) · Group Action (selected rows) ·
   Export (xlsx / csv / pdf / png via window.VSC.exporter) · columns · pager.
   Rows: Edit (prefilled dialog) · View details (read-only dialog).
   Default rows are server-rendered; new rows are built with DOM APIs only
   (textContent), so typed text can never inject markup. */
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
        "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    var DEFAULT_GROUP = "All Codes";

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

    function icon(paths) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("width", "13");
        svg.setAttribute("height", "13");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        paths.forEach(function (p) {
            var node = document.createElementNS(SVG_NS, p.tag);
            Object.keys(p.attrs).forEach(function (k) { node.setAttribute(k, p.attrs[k]); });
            svg.appendChild(node);
        });
        return svg;
    }

    function plural(n, word) {
        return n + " " + word + (n === 1 ? "" : "s");
    }

    function compareValues(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }

    function init(root) {
        if (!root || root.__expcatInit) {
            return;
        }
        root.__expcatInit = true;

        function q(sel) {
            return root.querySelector(sel);
        }

        var tbody = q("[data-cmp-expcat-tbody]");
        var table = q(".cmp-expcat__table");
        var emptyMsg = q("[data-cmp-expcat-empty]");
        var status = q("[data-cmp-expcat-status]");
        var selectionText = q("[data-cmp-expcat-selection]");
        var selectAll = q("[data-cmp-expcat-selectall]");

        var searchToggle = q("[data-cmp-expcat-search-toggle]");
        var searchBar = q("#cmp-expcat-search");
        var qInput = q("#cmp-expcat-q");
        var fType = q("#cmp-expcat-ftype");
        var fStatus = q("#cmp-expcat-fstatus");

        var groupBtn = q('[data-cmp-expcat-menu="group"]');
        var pageSelect = q("[data-cmp-expcat-page]");
        var pageCount = q("[data-cmp-expcat-pagecount]");
        var prevBtn = q("[data-cmp-expcat-prev]");
        var nextBtn = q("[data-cmp-expcat-next]");
        var colBtn = q("[data-cmp-expcat-columns-btn]");
        var colPanel = q("#cmp-expcat-columns");

        var modal = q("[data-cmp-expcat-modal]");
        var dialog = modal.querySelector(".cmp-expcat__dialog");
        var dialogTitle = q("[data-cmp-expcat-dialog-title]");
        var form = q("[data-cmp-expcat-form]");
        var formError = q("[data-cmp-expcat-error]");
        var saveBtn = q("[data-cmp-expcat-save]");
        var cancelBtn = q("[data-cmp-expcat-cancel]");
        var multi = form.querySelector("[data-cmp-multiselect]");

        var toast = q('[data-cmp-toast="expcat"]');
        var toastText = toast ? toast.querySelector("[data-cmp-toast-text]") : null;

        var f = {
            type: form.elements.type,
            value: form.elements.value,
            description: form.elements.description,
            advanced: form.elements.advancedDescription,
            parentType: form.elements.parentType,
            parentValue: form.elements.parentValue
        };

        var pageSize = parseInt(root.getAttribute("data-cmp-expcat-page-size"), 10);
        if (!(pageSize > 0)) {
            pageSize = 25;
        }
        var page = 1;
        var mode = "create";
        var editing = null;
        var opener = null;

        /* =====================================================
           Row data
           ===================================================== */
        function rows() {
            return Array.prototype.slice.call(tbody.querySelectorAll("[data-cmp-expcat-row]"));
        }

        function groupsOf(tr) {
            return (tr.getAttribute("data-groups") || "").split("|").filter(Boolean);
        }

        function dataOf(tr) {
            return {
                value: tr.getAttribute("data-value") || "",
                type: tr.getAttribute("data-type") || "",
                description: tr.querySelector('[data-col="description"]').textContent,
                status: tr.getAttribute("data-status") || "Active",
                groups: groupsOf(tr),
                advanced: tr.getAttribute("data-adv") || "",
                parentType: tr.getAttribute("data-ptype") || "",
                parentValue: tr.getAttribute("data-pvalue") || ""
            };
        }

        function writeRow(tr, d) {
            tr.setAttribute("data-value", d.value);
            tr.setAttribute("data-type", d.type);
            tr.setAttribute("data-status", d.status);
            tr.setAttribute("data-groups", d.groups.join("|"));
            tr.setAttribute("data-adv", d.advanced);
            tr.setAttribute("data-ptype", d.parentType);
            tr.setAttribute("data-pvalue", d.parentValue);
            tr.querySelector('[data-col="value"]').textContent = d.value;
            tr.querySelector('[data-col="type"]').textContent = d.type;
            tr.querySelector('[data-col="description"]').textContent = d.description;
            tr.querySelector('[data-col="groups"]').textContent = String(d.groups.length);
            tr.classList.toggle("is-inactive", d.status === "Inactive");
            tr.querySelector("[data-cmp-expcat-rowcheck]").setAttribute("aria-label", "Select " + d.value);
            tr.querySelector("[data-cmp-expcat-edit]").setAttribute("aria-label", "Edit " + d.value);
            tr.querySelector("[data-cmp-expcat-view]").setAttribute("aria-label", "View " + d.value + " details");
        }

        /* Same markup as the HTL row template. */
        function buildRow(d) {
            var tr = el("tr");
            tr.setAttribute("data-cmp-expcat-row", "");
            var tdCheck = el("td", "cmp-expcat__check");
            var check = el("input");
            check.type = "checkbox";
            check.setAttribute("data-cmp-expcat-rowcheck", "");
            tdCheck.appendChild(check);
            tr.appendChild(tdCheck);
            ["value", "type", "description", "groups"].forEach(function (col) {
                var td = el("td", col === "value" ? "cmp-expcat__value" : null);
                td.setAttribute("data-col", col);
                tr.appendChild(td);
            });
            var tdActions = el("td", "cmp-expcat__actions");
            var edit = el("button", "cmp-expcat__icon");
            edit.type = "button";
            edit.setAttribute("data-cmp-expcat-edit", "");
            edit.appendChild(icon([
                { tag: "path", attrs: { d: "M11.3 1.7l3 3-8.6 8.6-3.9.9.9-3.9z", fill: "currentColor" } }
            ]));
            var view = el("button", "cmp-expcat__icon");
            view.type = "button";
            view.setAttribute("data-cmp-expcat-view", "");
            view.appendChild(icon([
                { tag: "rect", attrs: { x: "2.5", y: "1.5", width: "11", height: "13", rx: "1", fill: "none",
                    stroke: "currentColor", "stroke-width": "1.5" } },
                { tag: "path", attrs: { d: "M5 5h6M5 8h6M5 11h4", stroke: "currentColor", "stroke-width": "1.5" } }
            ]));
            tdActions.appendChild(edit);
            tdActions.appendChild(view);
            tr.appendChild(tdActions);
            writeRow(tr, d);
            return tr;
        }

        function insertSorted(tr) {
            var value = tr.getAttribute("data-value");
            var before = null;
            rows().some(function (row) {
                if (row !== tr && compareValues(row.getAttribute("data-value"), value) > 0) {
                    before = row;
                    return true;
                }
                return false;
            });
            tbody.insertBefore(tr, before);
        }

        /* =====================================================
           Filter + pagination + selection
           ===================================================== */
        function matches(tr) {
            var term = qInput.value.trim().toLowerCase();
            var d = dataOf(tr);
            if (term && (d.value + " " + d.description + " " + d.type).toLowerCase().indexOf(term) === -1) {
                return false;
            }
            if (fType.value && d.type !== fType.value) {
                return false;
            }
            if (fStatus.value && d.status !== fStatus.value) {
                return false;
            }
            return true;
        }

        function filtered() {
            return rows().filter(matches);
        }

        function checkedRows() {
            return rows().filter(function (tr) { return tr.querySelector("[data-cmp-expcat-rowcheck]").checked; });
        }

        function updateSelection() {
            var n = checkedRows().length;
            selectionText.textContent = n ? plural(n, "charge code") + " selected" : "No charge codes selected";
            groupBtn.disabled = n === 0;
            var onPage = rows().filter(function (tr) { return !tr.hidden; });
            var checkedOnPage = onPage.filter(function (tr) {
                return tr.querySelector("[data-cmp-expcat-rowcheck]").checked;
            }).length;
            selectAll.checked = onPage.length > 0 && checkedOnPage === onPage.length;
            selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < onPage.length;
            selectAll.disabled = onPage.length === 0;
        }

        function render() {
            var list = filtered();
            var pages = Math.max(1, Math.ceil(list.length / pageSize));
            page = Math.min(Math.max(1, page), pages);
            var start = (page - 1) * pageSize;
            rows().forEach(function (tr) {
                var idx = list.indexOf(tr);
                tr.hidden = idx === -1 || idx < start || idx >= start + pageSize;
            });
            emptyMsg.hidden = list.length > 0;

            if (pageSelect.options.length !== pages) {
                pageSelect.textContent = "";
                for (var i = 1; i <= pages; i++) {
                    var opt = el("option", null, "Page " + i);
                    opt.value = String(i);
                    pageSelect.appendChild(opt);
                }
            }
            pageSelect.value = String(page);
            pageCount.textContent = "of " + pages;
            prevBtn.disabled = page <= 1;
            nextBtn.disabled = page >= pages;
            updateSelection();
            return list;
        }

        function announce(text) {
            status.textContent = "";
            window.setTimeout(function () { status.textContent = text; }, 30);
        }

        function goToRow(tr) {
            var idx = filtered().indexOf(tr);
            if (idx !== -1) {
                page = Math.floor(idx / pageSize) + 1;
            }
            render();
        }

        tbody.addEventListener("change", function (e) {
            if (e.target && e.target.hasAttribute("data-cmp-expcat-rowcheck")) {
                updateSelection();
            }
        });
        selectAll.addEventListener("change", function () {
            rows().forEach(function (tr) {
                if (!tr.hidden) {
                    tr.querySelector("[data-cmp-expcat-rowcheck]").checked = selectAll.checked;
                }
            });
            updateSelection();
        });

        pageSelect.addEventListener("change", function () {
            page = parseInt(pageSelect.value, 10) || 1;
            render();
        });
        prevBtn.addEventListener("click", function () {
            page -= 1;
            render();
            if (prevBtn.disabled) {
                nextBtn.focus();
            }
        });
        nextBtn.addEventListener("click", function () {
            page += 1;
            render();
            if (nextBtn.disabled) {
                prevBtn.focus();
            }
        });

        /* Search bar */
        searchToggle.addEventListener("click", function () {
            var open = searchBar.hidden;
            searchBar.hidden = !open;
            searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
            if (open) {
                qInput.focus();
            }
        });
        function onFilter() {
            page = 1;
            var n = render().length;
            announce(plural(n, "charge code") + " found");
        }
        qInput.addEventListener("input", onFilter);
        fType.addEventListener("change", onFilter);
        fStatus.addEventListener("change", onFilter);
        q("[data-cmp-expcat-clear]").addEventListener("click", function () {
            qInput.value = "";
            fType.value = "";
            fStatus.value = "";
            onFilter();
            qInput.focus();
        });

        /* =====================================================
           Menus (Group Action, Export) — ARIA menu pattern
           ===================================================== */
        var openMenu = null;

        function menuItems(menu) {
            return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
        }

        function closeMenu(focusButton) {
            if (!openMenu) {
                return;
            }
            openMenu.menu.hidden = true;
            openMenu.button.setAttribute("aria-expanded", "false");
            if (focusButton) {
                openMenu.button.focus();
            }
            openMenu = null;
        }

        function openMenuFor(button, focusLast) {
            closeMenu(false);
            closePopover();
            var menu = document.getElementById(button.getAttribute("aria-controls"));
            menu.hidden = false;
            button.setAttribute("aria-expanded", "true");
            openMenu = { button: button, menu: menu };
            var items = menuItems(menu);
            if (items.length) {
                items[focusLast ? items.length - 1 : 0].focus();
            }
        }

        root.querySelectorAll("[data-cmp-expcat-menu]").forEach(function (button) {
            button.addEventListener("click", function (e) {
                e.stopPropagation();
                if (openMenu && openMenu.button === button) {
                    closeMenu(true);
                } else {
                    openMenuFor(button, false);
                }
            });
            button.addEventListener("keydown", function (e) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    openMenuFor(button, e.key === "ArrowUp");
                }
            });
            var menu = document.getElementById(button.getAttribute("aria-controls"));
            menu.addEventListener("keydown", function (e) {
                var items = menuItems(menu);
                var idx = items.indexOf(document.activeElement);
                var target = null;
                if (e.key === "ArrowDown") {
                    target = items[(idx + 1) % items.length];
                } else if (e.key === "ArrowUp") {
                    target = items[(idx - 1 + items.length) % items.length];
                } else if (e.key === "Home") {
                    target = items[0];
                } else if (e.key === "End") {
                    target = items[items.length - 1];
                } else if (e.key === "Escape" || e.key === "Esc") {
                    e.preventDefault();
                    closeMenu(true);
                    return;
                } else if (e.key === "Tab") {
                    closeMenu(false);
                    return;
                }
                if (target) {
                    e.preventDefault();
                    target.focus();
                }
            });
        });

        /* Columns popover */
        function closePopover() {
            if (!colPanel.hidden) {
                colPanel.hidden = true;
                colBtn.setAttribute("aria-expanded", "false");
            }
        }
        colBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            closeMenu(false);
            var open = colPanel.hidden;
            colPanel.hidden = !open;
            colBtn.setAttribute("aria-expanded", open ? "true" : "false");
            if (open) {
                colPanel.querySelector("input").focus();
            }
        });
        colPanel.addEventListener("keydown", function (e) {
            if (e.key === "Escape" || e.key === "Esc") {
                e.preventDefault();
                closePopover();
                colBtn.focus();
            }
        });
        colPanel.addEventListener("change", function (e) {
            var col = e.target.value;
            table.classList.toggle("cmp-expcat__table--hide-" + col, !e.target.checked);
        });

        document.addEventListener("click", function (e) {
            if (openMenu && !openMenu.menu.contains(e.target)) {
                closeMenu(false);
            }
            if (!colPanel.hidden && !colPanel.contains(e.target) && e.target !== colBtn) {
                closePopover();
            }
        });

        /* Group actions */
        root.querySelectorAll("[data-cmp-expcat-group]").forEach(function (item) {
            item.addEventListener("click", function () {
                var action = item.getAttribute("data-cmp-expcat-group");
                var targets = checkedRows();
                closeMenu(true);
                if (!targets.length) {
                    return;
                }
                if (action === "delete") {
                    /* eslint-disable-next-line no-alert */
                    if (!window.confirm("Delete " + plural(targets.length, "charge code") + "?")) {
                        return;
                    }
                    targets.forEach(function (tr) { tr.parentNode.removeChild(tr); });
                    render();
                    announce(plural(targets.length, "charge code") + " deleted");
                    showToast("Success", plural(targets.length, "charge code") + " deleted.");
                    return;
                }
                targets.forEach(function (tr) {
                    var d = dataOf(tr);
                    if (action.indexOf("add:") === 0) {
                        var g = action.slice(4);
                        if (d.groups.indexOf(g) === -1) {
                            d.groups.push(g);
                        }
                    } else if (action === "reset") {
                        d.groups = [DEFAULT_GROUP];
                    } else if (action.indexOf("status:") === 0) {
                        d.status = action.slice(7);
                    }
                    writeRow(tr, d);
                });
                render();
                var msg = plural(targets.length, "charge code") + " updated";
                announce(msg);
                showToast("Success", msg + ".");
            });
        });

        /* Export (visible filter, all pages) */
        root.querySelectorAll("[data-cmp-expcat-export]").forEach(function (item) {
            item.addEventListener("click", function () {
                var format = item.getAttribute("data-cmp-expcat-export");
                closeMenu(true);
                var data = filtered().map(dataOf).map(function (d) {
                    return [d.value, d.type, d.description, String(d.groups.length), d.groups.join(", "), d.status];
                });
                var exporter = window.VSC && window.VSC.exporter;
                var ok = exporter && exporter.download(format, {
                    filename: "charge-codes",
                    title: "Charge Codes",
                    columns: ["Value", "Type", "Description", "Group(s)", "Charge groups", "Status"],
                    rows: data
                });
                announce(ok ? plural(data.length, "charge code") + " exported as " + item.textContent.trim() :
                    "Export is not available");
            });
        });

        /* =====================================================
           Dialog: create / edit / view
           ===================================================== */
        function groupBoxes() {
            return Array.prototype.slice.call(multi.querySelectorAll('input[type="checkbox"]'));
        }

        function fillParentValues(selected) {
            var type = f.parentType.value;
            f.parentValue.textContent = "";
            var first = el("option", null, type ? "Select a parent value" : "Select a parent type first");
            first.value = "";
            f.parentValue.appendChild(first);
            if (type) {
                rows().map(dataOf).filter(function (d) {
                    return d.type === type && (!editing || d.value !== editing.getAttribute("data-value"));
                }).forEach(function (d) {
                    var opt = el("option", null, d.value + " - " + d.description);
                    opt.value = d.value;
                    f.parentValue.appendChild(opt);
                });
            }
            f.parentValue.value = selected || "";
            f.parentValue.disabled = !type || mode === "view";
        }
        f.parentType.addEventListener("change", function () { fillParentValues(""); });

        function clearErrors() {
            formError.hidden = true;
            form.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
            form.querySelectorAll(".cmp-field__err").forEach(function (n) { n.hidden = true; });
        }

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

        function clearFixed(e) {
            if (e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") {
                setError(e.target, "");
                if (!form.querySelector('[aria-invalid="true"]')) {
                    formError.hidden = true;
                }
            }
        }
        form.addEventListener("input", clearFixed);
        form.addEventListener("change", clearFixed);

        function openDialog(newMode, tr) {
            mode = newMode;
            editing = tr || null;
            opener = document.activeElement;
            closeMenu(false);
            closePopover();
            form.reset();
            clearErrors();
            var d = tr ? dataOf(tr) : { value: "", type: "", description: "", status: "Active",
                groups: [DEFAULT_GROUP], advanced: "", parentType: "", parentValue: "" };
            f.type.value = d.type;
            f.value.value = d.value;
            f.description.value = d.description;
            f.advanced.value = d.advanced;
            form.querySelectorAll('input[name="status"]').forEach(function (r) { r.checked = r.value === d.status; });
            groupBoxes().forEach(function (b) { b.checked = d.groups.indexOf(b.value) !== -1; });
            f.parentType.value = d.parentType;

            var readOnly = mode === "view";
            Array.prototype.forEach.call(form.elements, function (n) {
                if (n.tagName !== "BUTTON") {
                    n.disabled = readOnly;
                }
            });
            fillParentValues(d.parentValue);
            multi.dispatchEvent(new CustomEvent("vsc:multiselect-sync"));

            dialogTitle.textContent = mode === "edit" ? "Edit Charge Code" :
                mode === "view" ? "Charge Code Details" : "Create New Charge Code";
            saveBtn.hidden = readOnly;
            cancelBtn.textContent = readOnly ? "Close" : "Cancel";
            modal.hidden = false;
            /* In the AEM editor the page frame is as tall as the page: bring the dialog into view. */
            if (dialog.scrollIntoView) {
                dialog.scrollIntoView({ block: "nearest" });
            }
            (readOnly ? cancelBtn : f.type).focus({ preventScroll: true });
        }

        function closeDialog() {
            modal.hidden = true;
            if (opener && opener.focus && document.documentElement.contains(opener)) {
                opener.focus();
            }
        }

        q("[data-cmp-expcat-create]").addEventListener("click", function () { openDialog("create", null); });
        q("[data-cmp-expcat-close]").addEventListener("click", closeDialog);
        q("[data-cmp-expcat-backdrop]").addEventListener("click", closeDialog);
        cancelBtn.addEventListener("click", closeDialog);

        tbody.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-cmp-expcat-edit], [data-cmp-expcat-view]") : null;
            if (!btn) {
                return;
            }
            var tr = btn.closest("[data-cmp-expcat-row]");
            openDialog(btn.hasAttribute("data-cmp-expcat-edit") ? "edit" : "view", tr);
        });

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (mode === "view") {
                closeDialog();
                return;
            }
            clearErrors();
            var invalid = [];
            var value = f.value.value.trim().toUpperCase();
            var desc = f.description.value.trim();
            var current = editing ? editing.getAttribute("data-value") : null;
            if (!setError(f.type, f.type.value ? "" : "Choose a type.")) {
                invalid.push(f.type);
            }
            var valueMsg = "";
            if (!value) {
                valueMsg = "Enter a value.";
            } else if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(value)) {
                valueMsg = "Use up to 20 letters, numbers, hyphens or underscores.";
            } else if (rows().some(function (tr) {
                return tr.getAttribute("data-value").toUpperCase() === value && tr !== editing;
            })) {
                valueMsg = "The value " + value + " already exists.";
            }
            if (!setError(f.value, valueMsg)) {
                invalid.push(f.value);
            }
            if (!setError(f.description, desc ? "" : "Enter a description.")) {
                invalid.push(f.description);
            }
            if (invalid.length) {
                formError.textContent = "Please fix " + plural(invalid.length, "highlighted field") + ".";
                formError.hidden = false;
                invalid[0].focus();
                return;
            }
            var checkedStatus = form.querySelector('input[name="status"]:checked');
            var groups = groupBoxes().filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
            var d = {
                value: value,
                type: f.type.value,
                description: desc,
                status: checkedStatus ? checkedStatus.value : "Active",
                groups: groups.length ? groups : [DEFAULT_GROUP],
                advanced: f.advanced.value.trim(),
                parentType: f.parentType.value,
                parentValue: f.parentValue.value
            };
            var tr;
            if (editing) {
                tr = editing;
                writeRow(tr, d);
                if (current !== value) {
                    insertSorted(tr);
                }
            } else {
                tr = buildRow(d);
                insertSorted(tr);
            }
            closeDialog();
            goToRow(tr);
            tr.classList.remove("is-new");
            /* Force a reflow so the highlight restarts for repeated saves. */
            tr.getBoundingClientRect();
            tr.classList.add("is-new");
            window.setTimeout(function () { tr.classList.remove("is-new"); }, 4000);
            var msg = editing ? "Charge code successfully updated." : "Charge code successfully added.";
            showToast("Success", msg);
            announce(msg);
        });

        /* =====================================================
           Toast
           ===================================================== */
        var toastTimer = 0;

        function showToast(title, message) {
            if (!toast) {
                return;
            }
            var titleEl = toast.querySelector(".cmp-toast__title");
            if (titleEl && title) {
                titleEl.textContent = title;
            }
            if (toastText) {
                toastText.textContent = message;
            }
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
           Keyboard: Esc + focus trap in the dialog
           ===================================================== */
        document.addEventListener("keydown", function (e) {
            if (modal.hidden) {
                return;
            }
            if (e.key === "Escape" || e.key === "Esc") {
                if (e.defaultPrevented) {
                    return;
                }
                e.preventDefault();
                closeDialog();
                return;
            }
            if (e.key !== "Tab") {
                return;
            }
            var items = Array.prototype.slice.call(dialog.querySelectorAll(FOCUSABLE)).filter(function (n) {
                return n.offsetWidth > 0 || n.offsetHeight > 0;
            });
            if (!items.length) {
                return;
            }
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        /* =====================================================
           Align the panel: from the end of the header's "My spend" tab
           to the right edge of the header's notification bell
           ===================================================== */
        var NAV_ITEMS = ".cmp-header__nav-list > .cmp-header__nav-item, " +
            ".cmp-vscheader__nav-list > .cmp-vscheader__item";
        var alignFrame = 0;

        function align() {
            alignFrame = 0;
            var items = document.querySelectorAll(NAV_ITEMS);
            var tab = items.length > 1 ?
                items[1].querySelector(".cmp-header__nav-link, .cmp-vscheader__nav-link") : null;
            if (!tab || !tab.offsetWidth) {
                root.style.removeProperty("--cmp-expcat-start");
                root.style.removeProperty("--cmp-expcat-end-gap");
                return;
            }
            var box = root.getBoundingClientRect();
            var start = tab.getBoundingClientRect().right -
                (parseFloat(window.getComputedStyle(tab).paddingRight) || 0) - box.left;
            if (start > 0) {
                root.style.setProperty("--cmp-expcat-start", start.toFixed(2) + "px");
            }
            /* End: right edge of the visible bell icon (falls back to the CSS value). */
            var bell = document.querySelector(".cmp-header__notifications-icon");
            if (bell && bell.getBoundingClientRect().width) {
                var contentRight = box.right - (parseFloat(window.getComputedStyle(root).paddingRight) || 0);
                var gap = contentRight - bell.getBoundingClientRect().right;
                if (gap >= 0) {
                    root.style.setProperty("--cmp-expcat-end-gap", gap.toFixed(2) + "px");
                }
            } else {
                root.style.removeProperty("--cmp-expcat-end-gap");
            }
        }

        function scheduleAlign() {
            if (!alignFrame) {
                alignFrame = window.requestAnimationFrame(align);
            }
        }

        window.addEventListener("resize", scheduleAlign);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleAlign);
        }
        if (window.ResizeObserver) {
            var alignObserver = new window.ResizeObserver(scheduleAlign);
            Array.prototype.forEach.call(document.querySelectorAll(NAV_ITEMS), function (item) {
                alignObserver.observe(item);
            });
        }
        align();

        render();
    }

    function safeInit(root) {
        try {
            init(root);
        } catch (err) {
            window.console.warn("VSC Expense Categories could not start", err);
        }
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-expcat]")) {
            safeInit(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-expcat]"), safeInit);
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
