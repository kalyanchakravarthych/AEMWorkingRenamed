/* VSC Guided Journey — demo tour across the Spend Clarity pages.
   - Chapters menu (bottom left): jump to any chapter (navigates when needed).
   - Each step shows a popover (Back / Next), an optional yellow hotspot ring on the
     target, and runs idempotent "prepare" actions on the existing components so the
     screen matches the Figma (open menus and drawers, fill the demo employee, submit).
   - Progress lives in sessionStorage for the browser tab, so the journey continues
     on the next page. Esc or the close button ends the journey.
   - Popovers are non-modal dialogs: focus moves to them, they are announced, and the
     page underneath stays usable (hotspots can be clicked). */
(function () {
    "use strict";

    var KEY = "vsc-tour";
    var DEMO = {
        search: "Everett",
        addressLine2: "(09) 4994991",
        creditLimit: "2000",
        authStrategy: "Cash Blocked",
        name: "Daniel Everett"
    };

    function q(sel, root) {
        return (root || document).querySelector(sel);
    }

    function visible(el) {
        return !!el && !el.closest("[hidden]") && el.getClientRects().length > 0;
    }

    function setValue(input, value) {
        if (input && input.value !== value) {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    /* ---------- actions on the existing Card Listing component ---------- */
    function cardlist() {
        return q("[data-cmp-cardlist]");
    }

    function closeCardUi() {
        var root = cardlist();
        if (!root) {
            return;
        }
        ["[data-cmp-empsearch-drawer]", "[data-cmp-createcard-drawer]"].forEach(function (sel) {
            var d = q(sel, root);
            if (d && !d.hidden) {
                var close = d.querySelector("[data-cmp-empsearch-close], [data-cmp-createcard-close]");
                if (close) {
                    close.click();
                }
            }
        });
    }

    function setCreateMenu(open) {
        var root = cardlist();
        var menu = root && q("#cmp-cardlist-create-menu", root);
        var trigger = root && q("[data-cmp-create-trigger]", root);
        if (menu && trigger && menu.hidden === open) {
            trigger.click();
        }
    }

    function ensureEmployeeSearch() {
        var root = cardlist();
        if (!root) {
            return;
        }
        var drawer = q("[data-cmp-empsearch-drawer]", root);
        var card = q("[data-cmp-createcard-drawer]", root);
        if (card && !card.hidden) {
            q("[data-cmp-createcard-close]", card).click();
        }
        if (drawer && drawer.hidden) {
            setCreateMenu(true);
            var opt = q('[data-cmp-create-option="existing"]', root);
            if (opt) {
                opt.click();
            }
        }
        setValue(q("[data-cmp-empsearch-input]", root), DEMO.search);
    }

    function ensureCardForm(full) {
        var root = cardlist();
        if (!root) {
            return;
        }
        var card = q("[data-cmp-createcard-drawer]", root);
        if (card && card.hidden) {
            ensureEmployeeSearch();
            var select = q('[data-cmp-empsearch-results] button[aria-label="Select ' + DEMO.name + '"]', root);
            if (!select) {
                select = q("[data-cmp-empsearch-results] button", root);
            }
            if (select) {
                select.click();
            }
        }
        var form = q("[data-cmp-createcard-form]", root);
        if (!form) {
            return;
        }
        setValue(form.elements.addressLine2, DEMO.addressLine2);
        if (full) {
            setValue(form.elements.creditLimit, DEMO.creditLimit);
            setValue(form.elements.authStrategy, DEMO.authStrategy);
        }
    }

    function hasDemoRow() {
        var root = cardlist();
        var names = root ? root.querySelectorAll(".cmp-cardlist__fullname") : [];
        return Array.prototype.some.call(names, function (n) {
            return n.textContent.trim() === DEMO.name;
        });
    }

    function submitCard() {
        var root = cardlist();
        if (!root) {
            return;
        }
        if (hasDemoRow()) {
            closeCardUi();
            return;
        }
        ensureCardForm(true);
        var form = q("[data-cmp-createcard-form]", root);
        if (form && typeof form.requestSubmit === "function") {
            form.requestSubmit();
        } else if (form) {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
    }

    function demoRow() {
        var root = cardlist();
        var hit = null;
        if (root) {
            Array.prototype.some.call(root.querySelectorAll(".cmp-cardlist__fullname"), function (n) {
                if (n.textContent.trim() === DEMO.name) {
                    hit = n.closest("tr");
                    return true;
                }
                return false;
            });
        }
        return hit;
    }


    /* ---------- actions on the existing Virtual Cards component ---------- */
    var VC = {
        desc: "Ad hoc office supplies purchase", spend: "250.00", start: "2026-06-25", end: "2026-07-25",
        currency: "US Dollar", spendType: "Single use virtual card", employee: "AMILLER01", name: "Alex Miller"
    };

    function vcRoot() {
        return q("[data-cmp-vclist]");
    }

    function vcDrawer() {
        var root = vcRoot();
        return root ? q("[data-cmp-vclist-drawer]", root) : null;
    }

    function vcStep() {
        var d = vcDrawer();
        return d && !d.hidden ? Number(d.getAttribute("data-step")) || 1 : 0;
    }

    function vcCloseDrawer() {
        var d = vcDrawer();
        if (d && !d.hidden) {
            var close = q("[data-cmp-vclist-close]", d);
            if (close) {
                close.click();
            }
        }
    }

    function vcNext() {
        var d = vcDrawer();
        var btn = d ? q("[data-cmp-vcwiz-next]", d) : null;
        if (btn && visible(btn)) {
            btn.click();
        }
    }

    function selectByText(select, text) {
        if (!select) {
            return;
        }
        var opt = Array.prototype.filter.call(select.options, function (o) {
            return o.text.trim() === text || o.value === text;
        })[0];
        if (opt) {
            setValue(select, opt.value);
        }
    }

    function vcEnsureDetails() {
        var root = vcRoot();
        if (!root) {
            return;
        }
        if (!vcStep()) {
            var add = q("[data-cmp-vclist-add-trigger]", root);
            if (add) {
                add.click();
            }
        }
        if (vcStep() === 1) {
            setValue(q("#vcf-desc", root), VC.desc);
            setValue(q("#vcf-spend", root), VC.spend);
            setValue(q("#vcf-start", root), VC.start);
            setValue(q("#vcf-end", root), VC.end);
            selectByText(q("#vcf-currency", root), VC.currency);
            selectByText(q("#vcf-spendtype", root), VC.spendType);
        }
    }

    function vcEnsureEmployees() {
        vcEnsureDetails();
        if (vcStep() === 1) {
            vcNext();
        }
        var root = vcRoot();
        if (vcStep() !== 2 || !root) {
            return;
        }
        var empty = q("[data-cmp-vcemp-empty]", root);
        if (empty && !empty.hidden) {
            var add = q("[data-cmp-vcemp-add]", root);
            if (add) {
                add.click();
            }
            var box = q('[data-cmp-vcemp-modal] input[value="' + VC.employee + '"]', root);
            if (box && !box.checked) {
                box.click();
            }
            var ok = q("[data-cmp-vcemp-confirm]", root);
            if (ok) {
                ok.click();
            }
        }
    }

    function vcEnsureReview() {
        vcEnsureEmployees();
        if (vcStep() === 2) {
            vcNext();
        }
    }

    function vcRow() {
        var root = vcRoot();
        var hit = null;
        if (root) {
            Array.prototype.some.call(root.querySelectorAll(".cmp-vclist__name"), function (n) {
                if (n.textContent.trim() === VC.name) {
                    hit = n.closest("tr");
                    return true;
                }
                return false;
            });
        }
        return hit;
    }

    var vcCreated = false;

    function vcCreate() {
        var root = vcRoot();
        if (!root || vcRow() || vcCreated) {
            vcCloseDrawer();
            return;
        }
        if (vcStep() !== 3) {
            vcEnsureReview();
        }
        var create = q("[data-cmp-vcwiz-create]", root);
        if (create && visible(create)) {
            vcCreated = true;
            create.click();
        }
    }

    /* ---------- actions on the existing Expense Categories component ---------- */
    var EC = { type: "GL Account", value: "500050", desc: "Office Supplies" };

    function ecRoot() {
        return q("[data-cmp-expcat]");
    }

    function ecCloseDialog() {
        var root = ecRoot();
        var modal = root ? q("[data-cmp-expcat-modal]", root) : null;
        if (modal && !modal.hidden) {
            var cancel = q("[data-cmp-expcat-cancel]", modal) || q("[data-cmp-expcat-close]", modal);
            if (cancel) {
                cancel.click();
            }
        }
    }

    function ecHasRow() {
        var root = ecRoot();
        return !!root && !!q('[data-cmp-expcat-row][data-value="' + EC.value + '"]', root);
    }

    function ecEnsureDialog() {
        var root = ecRoot();
        if (!root || ecHasRow()) {
            return;
        }
        var modal = q("[data-cmp-expcat-modal]", root);
        if (modal && modal.hidden) {
            var create = q("[data-cmp-expcat-create]", root);
            if (create) {
                create.click();
            }
        }
        selectByText(q("#ecf-type", root), EC.type);
        setValue(q("#ecf-value", root), EC.value);
        setValue(q("#ecf-desc", root), EC.desc);
    }

    function ecSave() {
        var root = ecRoot();
        if (!root) {
            return;
        }
        if (ecHasRow()) {
            ecCloseDialog();
            return;
        }
        ecEnsureDialog();
        var save = q("[data-cmp-expcat-save]", root);
        if (save) {
            save.click();
        }
    }

    /* ---------- actions on the existing Code Expenses component ---------- */
    var CX = { id: "e01", gl: "500050", library: "IMG002.jpg" };

    function cxRoot() {
        return q("[data-cmp-codeexp]");
    }

    function cxModal() {
        var root = cxRoot();
        return root ? q("[data-cmp-codeexp-modal]", root) : null;
    }

    function cxCloseDialog() {
        var m = cxModal();
        if (m && !m.hidden) {
            q("[data-cmp-codeexp-dclose]", m).click();
        }
    }

    function cxCloseManage() {
        var root = cxRoot();
        var pop = root ? q("#cx-manage", root) : null;
        if (pop && !pop.hidden) {
            q("[data-cmp-codeexp-manage]", root).click();
        }
    }

    function cxEnsurePanel() {
        var root = cxRoot();
        if (!root) {
            return;
        }
        var row = q('[data-cmp-codeexp-item][data-id="' + CX.id + '"]', root);
        var panel = q("[data-cmp-codeexp-panel]", root);
        if (row && !row.hidden && panel && (panel.hidden || !row.classList.contains("is-current"))) {
            q("[data-cmp-codeexp-open]", row).click();
        }
    }

    function cxClosePanel() {
        cxCloseDialog();
        var root = cxRoot();
        var panel = root ? q("[data-cmp-codeexp-panel]", root) : null;
        if (panel && !panel.hidden) {
            q("[data-cmp-codeexp-close]", root).click();
        }
    }

    function cxPickGl(keepOpen) {
        var root = cxRoot();
        var cell = root ? q('[data-cmp-codeexp-split="1"] [data-dim="gl"]', root) : null;
        if (!cell || cell.querySelector("[data-clear]")) {
            return;
        }
        var pick = q("[data-pick]", cell);
        if (pick) {
            pick.click();
        }
        if (!keepOpen) {
            var opt = q('[data-cmp-codeexp-options] [data-code="' + CX.gl + '"]', root);
            if (opt) {
                opt.click();
            }
        }
    }

    function cxEnsureDialog(tab) {
        var root = cxRoot();
        var m = cxModal();
        if (!root || !m) {
            return;
        }
        cxCloseManage();
        if (m.hidden) {
            q("[data-cmp-codeexp-thumb]", root).click();
        }
        var t = q(tab === "library" ? "#cx-itab-library" : "#cx-itab-linked", root);
        if (t && t.getAttribute("aria-selected") !== "true") {
            t.click();
        }
    }

    function cxLibraryImage() {
        var root = cxRoot();
        var btns = root ? root.querySelectorAll("[data-cmp-codeexp-library-list] [data-img]") : [];
        return Array.prototype.filter.call(btns, function (b) {
            return (b.getAttribute("aria-label") || "").indexOf(CX.library) === 0;
        })[0] || btns[0] || null;
    }

    function cxEnsureImageActions() {
        cxEnsurePanel();
        cxEnsureDialog("library");
        var root = cxRoot();
        var pop = root ? q("[data-cmp-codeexp-imgpop]", root) : null;
        var img = cxLibraryImage();
        if (pop && pop.hidden && img) {
            img.click();
        }
    }

    function cxLinkAndReturn() {
        cxEnsurePanel();
        var root = cxRoot();
        var m = cxModal();
        if (!root) {
            return;
        }
        var pop = q("[data-cmp-codeexp-imgpop]", root);
        if (m && !m.hidden && pop && !pop.hidden) {
            var link = q('[data-cmp-codeexp-img="link"]', root);
            if (link && link.textContent.trim() === "Link") {
                link.click();
            }
        }
        cxCloseDialog();
        var coding = q("#cx-tab-coding", root);
        if (coding && coding.getAttribute("aria-selected") !== "true") {
            coding.click();
        }
        cxPickGl(false);
    }

    function cxComplete() {
        var root = cxRoot();
        var btn = root ? q("[data-cmp-codeexp-complete]", root) : null;
        if (btn && visible(btn) && !btn.disabled) {
            btn.click();
        }
    }

    /* Popovers for steps inside a drawer sit outside it (left of the panel), as in the Figma. */
    var DRAWER = ".cmp-drawer:not([hidden]) .cmp-drawer__panel";

    /* ---------- journey definition ---------- */
    var STEPS = [
        { id: "welcome", chapter: "start", page: "home", center: true, title: "Spend Clarity for Enterprise",
            subtitle: "Take Control of Company Spend",
            text: ["Transform how your business manages spend with a platform that brings visibility and " +
                "control together, so you can manage cards, transactions, and expenses with confidence."],
            next: "Start Demo", back: false },
        { id: "hotspots", chapter: "start", page: "home", target: "nav:Cards",
            place: "bottom", ring: true,
            text: ["Click on hotspots or the ", { b: "Next" }, " button to proceed through the demo"],
            back: false, hint: "Use the chapters menu to quickly navigate through the features in this demo",
            hotspotNext: true },
        { id: "cards-intro", chapter: "cards", page: "cards", center: true, title: "Create and Manage Commercial Cards",
            text: ["Administrators can create and manage commercial card programs, assign cards to employees, and " +
                "apply spend controls such as transaction limits and merchant restrictions, helping maintain " +
                "control over company spend."], back: false,
            prepare: function () { setCreateMenu(false); closeCardUi(); } },
        { id: "create-card", chapter: "cards", page: "cards", target: "[data-cmp-create-trigger]", place: "left",
            ring: true,
            text: ["Clicking ", { b: "Create card" }, " opens the new card setup flow"],
            prepare: function () { closeCardUi(); setCreateMenu(false); } },
        { id: "existing", chapter: "cards", page: "cards", target: '[data-cmp-create-option="existing"]', place: "left",
            ring: true,
            text: ["Select ", { b: "Create card for existing employee" }, " to create a card for an employee"],
            prepare: function () { closeCardUi(); setCreateMenu(true); } },
        { id: "search", chapter: "cards", page: "cards", outside: DRAWER, target: "[data-cmp-empsearch-results] button",
            place: "left", ring: true,
            text: ["User can search by name or ID and selects an employee to assign the card"],
            prepare: ensureEmployeeSearch },
        { id: "controls", chapter: "cards", page: "cards", outside: DRAWER, target: "#cf-authstrat",
            place: "left", ring: true,
            scroll: "#cf-creditlimit",
            text: ["Configure card controls including spending limits and merchant category restrictions based " +
                "on company policies"],
            prepare: function () { ensureCardForm(false); } },
        { id: "submit", chapter: "cards", page: "cards", outside: DRAWER,
            target: '[data-cmp-createcard-form] button[type="submit"]',
            place: "left", ring: true,
            text: ["With the cardholder selected and account limits configured, the user clicks ", { b: "Submit" },
                " to issue the card"],
            prepare: function () { ensureCardForm(true); } },
        { id: "created", chapter: "cards", page: "cards", target: "row", place: "bottom",
            text: ["The card is successfully created and is added to the cardholders list"],
            next: "\u2192 Issue Virtual Cards", prepare: submitCard },
        { id: "virtual-intro", chapter: "virtual", page: "virtual", center: true, title: "Issue Virtual Cards",
            text: ["When a purchase is needed, a virtual card can be quickly issued with controls such as spend " +
                "limits, usage types including single-use or multi-use, and merchant restrictions, enabling " +
                "faster, more secure payments."], back: "flow",
            prepare: vcCloseDrawer },
        { id: "add-virtual", chapter: "virtual", page: "virtual", target: "[data-cmp-vclist-add-trigger]",
            place: "top", ring: true,
            text: ["Clicking ", { b: "Add virtual cards" }, " initiates the setup for a new virtual card"],
            prepare: vcCloseDrawer },
        { id: "vc-details", chapter: "virtual", page: "virtual", outside: DRAWER, target: "[data-cmp-vcwiz-next]",
            place: "left", ring: true, anchorY: "#vcf-desc",
            text: ["First, the user enters the virtual card details"],
            prepare: function () {
                vcCloseDrawer();
                vcEnsureDetails();
            } },
        { id: "vc-employees", chapter: "virtual", page: "virtual", outside: DRAWER, target: "[data-cmp-vcwiz-next]",
            place: "left", ring: true, anchorY: "[data-cmp-vcemp-add]",
            text: ["User then selects which employees will receive the virtual card"],
            prepare: function () {
                if (vcStep() === 3) {
                    q("[data-cmp-vcwiz-back]").click();
                }
                vcEnsureEmployees();
            } },
        { id: "vc-review", chapter: "virtual", page: "virtual", outside: DRAWER, target: "[data-cmp-vcwiz-create]",
            place: "left", ring: true,
            extra: { target: ".cmp-vcwiz__section--mcc", outside: DRAWER, place: "left",
                text: "Administrators can set virtual card policies to block specific merchant category groups" },
            text: ["With recipients selected, the user reviews the card details and creates the card"],
            prepare: vcEnsureReview },
        { id: "vc-creating", chapter: "virtual", page: "virtual", target: '[data-cmp-toast="vclist"]',
            place: "left", text: ["Virtual card creation is not instant and is dependent on issuers"],
            prepare: vcCreate },
        { id: "vc-added", chapter: "virtual", page: "virtual", target: "vcrow", place: "bottom", wait: 2500,
            text: ["After the card has been created it is added to the list of virtual cards"],
            next: "\u2192 Manage Expense Categories", prepare: vcCreate },

        { id: "categories-intro", chapter: "categories", page: "categories", center: true,
            title: "Manage Expense Categories",
            text: ["Expense categories are defined and managed to ensure consistent coding, enabling accurate " +
                "reporting and seamless integration with downstream systems."], back: "flow",
            prepare: ecCloseDialog },
        { id: "create-code", chapter: "categories", page: "categories", target: "[data-cmp-expcat-create]",
            place: "bottom", ring: true, text: ["Click ", { b: "Create" }, " to quickly add a new expense code"],
            prepare: ecCloseDialog },
        { id: "ec-form", chapter: "categories", page: "categories", outside: ".cmp-expcat__dialog",
            target: "[data-cmp-expcat-save]", place: "left", ring: true, anchorY: "#ecf-adv",
            text: ["Administrators can create new charge codes, either manually or by uploading a spreadsheet " +
                "to batch create multiple codes"],
            prepare: ecEnsureDialog },
        { id: "ec-created", chapter: "categories", page: "categories", target: '[data-cmp-toast="expcat"]',
            place: "left", wait: 1500,
            text: ["Once created, the charge codes becomes active and is immediately available for expense coding"],
            next: "\u2192 Code Expenses & Attach Receipts", prepare: ecSave },

        { id: "coding-intro", chapter: "coding", page: "coding", center: true, title: "Code Expenses & Attach Receipts",
            text: ["Transactions can be quickly coded to company-defined categories and receipts attached directly " +
                "from mobile or desktop, helping ensure accurate reconciliation, audit readiness, and streamlined " +
                "financial reporting."], back: "flow",
            prepare: cxClosePanel },
        { id: "pick-expense", chapter: "coding", page: "coding", target: '[data-id="e01"] [data-cmp-codeexp-open]',
            place: "bottom", ring: true,
            text: ["User selects an expense from the list to begin the coding and receipt flow"],
            prepare: cxClosePanel },
        { id: "cx-details", chapter: "coding", page: "coding", outside: ".cmp-codeexp__panel",
            target: '[data-cmp-codeexp-split="1"] [data-dim="gl"] [data-cmp-codeexp-cell]', place: "left",
            ring: true, text: ["The user reviews the transaction details and enters expense details."],
            prepare: function () {
                cxCloseDialog();
                cxEnsurePanel();
                cxPickGl(true);
            } },
        { id: "cx-manage", chapter: "coding", page: "coding", target: "[data-cmp-codeexp-manage]", place: "left",
            ring: true, anchorY: "#cx-manage",
            extra: { target: "[data-cmp-codeexp-thumb]", place: "left",
                text: "Spend Clarity can automatically link receipts to the appropriate expense" },
            text: ["Users can also manually upload and manage additional receipts if needed"],
            prepare: function () {
                cxCloseDialog();
                cxEnsurePanel();
                cxPickGl(false);
                var root = cxRoot();
                var pop = root ? q("#cx-manage", root) : null;
                if (pop && pop.hidden) {
                    q("[data-cmp-codeexp-manage]", root).click();
                }
            } },
        { id: "cx-upload", chapter: "coding", page: "coding", target: "[data-cmp-codeexp-upload]", place: "bottom",
            ring: true, text: ["Additional receipts can be uploaded to the image library via mobile, local drive, " +
                "or email"],
            prepare: function () {
                cxEnsurePanel();
                cxEnsureDialog("linked");
            } },
        { id: "cx-mobile", chapter: "coding", page: "coding", stage: "phone", target: ".cmp-vtour__shutter",
            outside: ".cmp-vtour__phone",
            place: "right", ring: true,
            text: ["Users can upload receipts conveniently from their phone using the Spend Clarity mobile app"],
            prepare: function () {
                cxEnsurePanel();
                cxEnsureDialog("linked");
            } },
        { id: "cx-library", chapter: "coding", page: "coding", target: '[data-cmp-codeexp-img="link"]',
            place: "bottom", ring: true,
            extra: { target: "#cx-itab-library", place: "bottom",
                text: "Uploaded images that haven\u2019t been linked yet are held in the Image Library" },
            text: ["The uploaded receipt photo can then be linked to expense details"],
            prepare: cxEnsureImageActions },
        { id: "cx-complete", chapter: "coding", page: "coding", outside: ".cmp-codeexp__panel",
            target: "[data-cmp-codeexp-complete]", place: "left", ring: true,
            text: ["With the receipt linked, the user reviews all charge codes and clicks ", { b: "Complete" },
                " to submit for approval"],
            next: "Continue", onNext: cxComplete, prepare: cxLinkAndReturn }
    ];

    function indexOf(id) {
        for (var i = 0; i < STEPS.length; i++) {
            if (STEPS[i].id === id) {
                return i;
            }
        }
        return -1;
    }

    function firstOfChapter(chapter) {
        for (var i = 0; i < STEPS.length; i++) {
            if (STEPS[i].chapter === chapter) {
                return i;
            }
        }
        return 0;
    }

    function chapterSteps(chapter) {
        return STEPS.filter(function (s) { return s.chapter === chapter; });
    }

    function readState() {
        try {
            return JSON.parse(window.sessionStorage.getItem(KEY) || "null");
        } catch (err) {
            return null;
        }
    }

    function writeState(state) {
        try {
            if (state) {
                window.sessionStorage.setItem(KEY, JSON.stringify(state));
            } else {
                window.sessionStorage.removeItem(KEY);
            }
        } catch (err) {
            /* Storage unavailable: the journey still works within the page. */
        }
    }

    function currentPage() {
        if (q("[data-cmp-cardlist]")) {
            return "cards";
        }
        if (q("[data-cmp-vclist]")) {
            return "virtual";
        }
        if (q("[data-cmp-expcat]")) {
            return "categories";
        }
        if (q("[data-cmp-codeexp]")) {
            return "coding";
        }
        return "home";
    }

    /* ---------- component ---------- */
    function init(root) {
        if (!root || root.__vtourInit) {
            return;
        }
        root.__vtourInit = true;

        var status = q("[data-cmp-vtour-status]", root);
        var chapters = Array.prototype.slice.call(root.querySelectorAll("[data-cmp-vtour-chapter]"));
        var page = currentPage();
        var urlKey = { home: "home", cards: "cards", virtual: "virtual", categories: "categories", coding: "coding" };
        var layer = document.createElement("div");
        layer.className = "cmp-vtour__layer";
        document.body.appendChild(layer);
        var pop = null;
        var hint = null;
        var extra = null;
        var ring = null;
        var stepIndex = -1;
        var targetEl = null;
        var hotspotHandler = null;
        var arrivedByFlow = false;

        function urlFor(p) {
            var k = urlKey[p];
            return root.getAttribute("data-url-" + k) || root.getAttribute("data-default-" + k);
        }

        var PAGE_CHAPTER = { home: "start", cards: "cards", virtual: "virtual", categories: "categories",
            coding: "coding" };

        function markChapter(chapter) {
            chapter = chapter || PAGE_CHAPTER[page];
            chapters.forEach(function (b) {
                var on = b.getAttribute("data-cmp-vtour-chapter") === chapter;
                b.classList.toggle("is-current", on);
                if (on) {
                    b.setAttribute("aria-current", "step");
                } else {
                    b.removeAttribute("aria-current");
                }
            });
        }

        function clearUi() {
            layer.textContent = "";
            pop = null;
            hint = null;
            extra = null;
            ring = null;
            if (targetEl && hotspotHandler) {
                targetEl.removeEventListener("click", hotspotHandler, true);
            }
            targetEl = null;
            hotspotHandler = null;
        }

        function end(announce) {
            clearUi();
            stepIndex = -1;
            writeState(null);
            markChapter(null);
            updateFrames();
            if (announce) {
                status.textContent = "Guided journey closed.";
            }
        }

        function resolveTarget(step) {
            if (!step.target) {
                return null;
            }
            if (step.target === "vcrow") {
                return vcRow();
            }
            if (step.target === "row") {
                return demoRow() || q("[data-cmp-toast]:not([hidden])");
            }
            if (step.target.indexOf("nav:") === 0) {
                var label = step.target.slice(4);
                var tabs = document.querySelectorAll(".cmp-header__nav-link, .cmp-vscheader__nav-link");
                return Array.prototype.slice.call(tabs).filter(function (n) {
                    return visible(n) && n.textContent.trim() === label;
                })[0] || null;
            }
            var all = Array.prototype.slice.call(document.querySelectorAll(step.target));
            return all.filter(visible)[0] || null;
        }

        function find(sel) {
            if (!sel) {
                return null;
            }
            return Array.prototype.slice.call(document.querySelectorAll(sel)).filter(visible)[0] || null;
        }

        function build(step, i) {
            var steps = chapterSteps(step.chapter);
            var pos = steps.indexOf(step);
            var el = document.createElement("section");
            el.className = "cmp-vtour__pop" + (step.center ? " cmp-vtour__pop--center" : "") +
                (step.id === "welcome" ? " cmp-vtour__pop--welcome" : "");
            el.setAttribute("role", "dialog");
            el.setAttribute("aria-labelledby", "cmp-vtour-heading");
            el.setAttribute("aria-describedby", "cmp-vtour-text");
            el.tabIndex = -1;


            var h = document.createElement("h2");
            h.id = "cmp-vtour-heading";
            h.className = step.title ? "cmp-vtour__title" : "cmp-visually-hidden";
            h.textContent = step.title || ("Guided journey, step " + (pos + 1) + " of " + steps.length);
            el.appendChild(h);
            if (step.subtitle) {
                var sub = document.createElement("p");
                sub.className = "cmp-vtour__sub";
                sub.textContent = step.subtitle;
                el.appendChild(sub);
            }
            var p = document.createElement("p");
            p.id = "cmp-vtour-text";
            p.className = "cmp-vtour__text";
            step.text.forEach(function (part) {
                if (typeof part === "string") {
                    p.appendChild(document.createTextNode(part));
                } else {
                    var b = document.createElement("strong");
                    b.textContent = part.b;
                    p.appendChild(b);
                }
            });
            el.appendChild(p);
            var tip = document.createElement("p");
            tip.className = "cmp-visually-hidden";
            tip.id = "cmp-vtour-tip";
            tip.textContent = "Press Escape to exit the guided journey.";
            el.appendChild(tip);
            el.setAttribute("aria-describedby", "cmp-vtour-text cmp-vtour-tip");

            if (!(step.center && step.id === "welcome")) {
                var prog = document.createElement("div");
                prog.className = "cmp-vtour__progress";
                prog.setAttribute("aria-hidden", "true");
                steps.forEach(function (s, k) {
                    var seg = document.createElement("span");
                    seg.className = "cmp-vtour__seg" + (k <= pos ? " is-done" : "");
                    prog.appendChild(seg);
                });
                el.appendChild(prog);
            }

            var actions = document.createElement("div");
            actions.className = "cmp-vtour__actions" + (step.back === false ? " cmp-vtour__actions--single" : "");
            var showBack = step.back === "flow" ? arrivedByFlow && i > 0 : step.back !== false;
            actions.className = "cmp-vtour__actions" + (showBack ? "" : " cmp-vtour__actions--single");
            if (showBack) {
                var back = document.createElement("button");
                back.type = "button";
                back.className = "cmp-vtour__btn";
                back.textContent = "Back";
                back.addEventListener("click", function () { go(i - 1, true); });
                actions.appendChild(back);
            }
            var next = document.createElement("button");
            next.type = "button";
            next.className = "cmp-vtour__btn cmp-vtour__btn--primary";
            next.textContent = step.next || "Next";
            next.setAttribute("data-cmp-vtour-next", "");
            next.addEventListener("click", function () {
                if (step.onNext) {
                    step.onNext();
                }
                go(i + 1, true);
            });
            actions.appendChild(next);
            el.appendChild(actions);
            return el;
        }

        function place(el, target, where, outside, anchorY) {
            el.style.top = "";
            el.style.left = "";
            if (!target) {
                el.classList.add("cmp-vtour__pop--center");
                return;
            }
            var r = target.getBoundingClientRect();
            var box = outside ? q(outside) : null;
            if (box && visible(box) && (where === "left" || where === "right")) {
                var b = box.getBoundingClientRect();
                var edge = where === "left" ? b.left : b.right;
                r = { left: edge, right: edge, width: 0, top: r.top, bottom: r.bottom, height: r.height };
            }
            var ay = anchorY ? find(anchorY) : null;
            if (ay && (where === "left" || where === "right")) {
                var a = ay.getBoundingClientRect();
                r = { left: r.left, right: r.right, width: r.width, top: a.top, bottom: a.bottom, height: a.height };
            }
            var w = el.offsetWidth;
            var hgt = el.offsetHeight;
            var gap = 14;
            var vw = document.documentElement.clientWidth;
            var vh = window.innerHeight;
            var top;
            var left;
            if (where === "left") {
                left = r.left - w - gap;
                top = r.top + r.height / 2 - hgt / 2;
                if (left < 8) {
                    where = "bottom";
                }
            }
            if (where === "right") {
                left = r.right + gap;
                top = r.top + r.height / 2 - hgt / 2;
                if (left + w > vw - 8) {
                    where = "bottom";
                }
            }
            if (where === "top") {
                left = r.left + r.width / 2 - w / 2;
                top = r.top - hgt - gap;
                if (top < 8) {
                    where = "bottom";
                }
            }
            if (where === "bottom") {
                left = r.left + r.width / 2 - w / 2;
                top = r.bottom + gap;
            }
            left = Math.max(8, Math.min(left, vw - w - 8));
            /* Keep clear of the previous / next arrows at the bottom centre. */
            top = Math.max(8, Math.min(top, vh - hgt - 56));
            el.setAttribute("data-place", where);
            el.style.left = Math.round(left) + "px";
            el.style.top = Math.round(top) + "px";
        }

        function placeRing(target) {
            if (!ring || !target) {
                return;
            }
            var r = target.getBoundingClientRect();
            var size = 64;
            ring.style.left = Math.round(r.left + r.width / 2 - size / 2) + "px";
            ring.style.top = Math.round(r.top + r.height / 2 - size / 2) + "px";
        }

        function placeHint() {
            if (!hint) {
                return;
            }
            var menu = q(".cmp-vtour__chapters", root).getBoundingClientRect();
            hint.style.left = Math.round(menu.right + 12) + "px";
            hint.style.top = Math.max(8, Math.round(menu.top + menu.height / 2 - hint.offsetHeight / 2)) + "px";
        }

        function layout() {
            if (stepIndex < 0 || !pop) {
                return;
            }
            var step = STEPS[stepIndex];
            if (step.center) {
                return;
            }
            var t = resolveTarget(step);
            place(pop, t, step.place || "bottom", step.outside, step.anchorY);
            placeRing(t);
            placeHint();
            if (extra && step.extra) {
                place(extra, find(step.extra.target), step.extra.place || "left", step.extra.outside);
            }
        }

        /* Decorative phone mock-up for the mobile upload step (Figma: camera screen). */
        function buildPhone() {
            var stage = document.createElement("div");
            stage.className = "cmp-vtour__stage";
            stage.setAttribute("aria-hidden", "true");
            var phone = document.createElement("div");
            phone.className = "cmp-vtour__phone";
            var screen = document.createElement("div");
            screen.className = "cmp-vtour__phone-screen";
            var receipt = document.createElement("div");
            receipt.className = "cmp-vtour__receipt";
            ["HOUSEWARES STORE", "123 Market Street", "Chicago, IL 60601", "", "Mixing Bowl Set      9.99",
                "Measuring Cups       6.49", "Kitchen Towel Set    7.99", "Silicone Spatula     3.49",
                "Storage Containers  12.99", "", "Subtotal            44.94", "Sales Tax 8.50%      3.82",
                "TOTAL               45.99"].forEach(function (line, k) {
                var row = document.createElement("span");
                row.className = k === 0 ? "cmp-vtour__receipt-title" : "";
                row.textContent = line || "\u00a0";
                receipt.appendChild(row);
            });
            screen.appendChild(receipt);
            phone.appendChild(screen);
            var label = document.createElement("span");
            label.className = "cmp-vtour__photo";
            label.textContent = "PHOTO";
            phone.appendChild(label);
            var bar = document.createElement("div");
            bar.className = "cmp-vtour__phone-bar";
            var cancel = document.createElement("span");
            cancel.textContent = "Cancel";
            var shutter = document.createElement("span");
            shutter.className = "cmp-vtour__shutter";
            bar.appendChild(cancel);
            bar.appendChild(shutter);
            bar.appendChild(document.createElement("span"));
            phone.appendChild(bar);
            stage.appendChild(phone);
            return stage;
        }

        function draw(step, i) {
            var target = resolveTarget(step);
            var scrollTo = step.scroll ? q(step.scroll) : target;
            if (scrollTo && scrollTo.scrollIntoView && !step.stage) {
                scrollTo.scrollIntoView({ block: "center", inline: "nearest" });
            }
            var dim = document.createElement("div");
            dim.className = "cmp-vtour__dim";
            dim.setAttribute("aria-hidden", "true");
            layer.insertBefore(dim, layer.firstChild);
            pop = build(step, i);
            layer.appendChild(pop);
            if (step.ring && target) {
                ring = document.createElement("div");
                ring.className = "cmp-vtour__ring";
                ring.setAttribute("aria-hidden", "true");
                layer.appendChild(ring);
            }
            if (step.hint) {
                hint = document.createElement("p");
                hint.className = "cmp-vtour__hint";
                hint.textContent = step.hint;
                layer.appendChild(hint);
            }
            if (step.extra) {
                extra = document.createElement("p");
                extra.className = "cmp-vtour__hint cmp-vtour__hint--extra";
                extra.textContent = step.extra.text;
                layer.appendChild(extra);
            }
            if (step.hotspotNext && target) {
                targetEl = target;
                hotspotHandler = makeHotspot(i);
                target.addEventListener("click", hotspotHandler, true);
            }
            layout();
            var focusEl = pop.querySelector("[data-cmp-vtour-next]");
            if (focusEl) {
                focusEl.focus({ preventScroll: true });
            }
            var steps = chapterSteps(step.chapter);
            status.textContent = (step.title ? step.title + ". " : "") + "Step " + (steps.indexOf(step) + 1) +
                " of " + steps.length + "." + (step.extra ? " " + step.extra.text + "." : "");
        }

        function render(i) {
            clearUi();
            var step = STEPS[i];
            stepIndex = i;
            markChapter(step.chapter);
            updateFrames();
            /* Run after the current click has finished bubbling (components close their menus on
               outside clicks), then let them update the DOM before measuring. */
            window.setTimeout(function () {
                if (stepIndex !== i) {
                    return;
                }
                if (step.prepare) {
                    step.prepare();
                }
                if (step.stage === "phone") {
                    layer.insertBefore(buildPhone(), layer.firstChild);
                }
            }, 0);
            /* Wait for the target (some appear after a delay, e.g. new rows), then draw. */
            var waited = 0;
            var limit = step.wait || 1200;
            function attempt() {
                if (stepIndex !== i) {
                    return;
                }
                if (step.target && !step.center && !resolveTarget(step) && waited < limit) {
                    waited += 100;
                    window.setTimeout(attempt, 100);
                    return;
                }
                draw(step, i);
            }
            window.setTimeout(attempt, 120);
        }

        function makeHotspot(i) {
            return function (e) {
                e.preventDefault();
                go(i + 1, true);
            };
        }

        /* =====================================================
           End of the journey: full-screen "Restart Demo" screen (Figma)
           ===================================================== */
        var finishEl = null;
        var finishReturn = null;

        function mockDashboard() {
            var shot = document.createElement("div");
            shot.className = "cmp-vtour__shot";
            var bar = document.createElement("div");
            bar.className = "cmp-vtour__shot-bar";
            var brand = document.createElement("span");
            brand.className = "cmp-vtour__shot-brand";
            brand.textContent = "VISA";
            var name = document.createElement("span");
            name.textContent = "Spend Clarity | Enterprise";
            bar.appendChild(brand);
            bar.appendChild(name);
            shot.appendChild(bar);
            var nav = document.createElement("div");
            nav.className = "cmp-vtour__shot-nav";
            ["Home", "My Spend", "Approvals", "Cards", "Virtual Cards", "Search", "Reports", "Administration"]
                .forEach(function (t) {
                    var item = document.createElement("span");
                    item.textContent = t;
                    nav.appendChild(item);
                });
            shot.appendChild(nav);
            var grid = document.createElement("div");
            grid.className = "cmp-vtour__shot-grid";
            [["My Actions", 5], ["Transactions", 9], ["Announcements", 3]].forEach(function (col) {
                var c = document.createElement("div");
                c.className = "cmp-vtour__shot-col";
                var head = document.createElement("span");
                head.className = "cmp-vtour__shot-head";
                head.textContent = col[0];
                c.appendChild(head);
                for (var k = 0; k < col[1]; k++) {
                    var line = document.createElement("span");
                    line.className = "cmp-vtour__shot-line" + (k === 0 && col[0] === "My Actions" ?
                        " cmp-vtour__shot-line--cta" : "");
                    c.appendChild(line);
                }
                grid.appendChild(c);
            });
            shot.appendChild(grid);
            return shot;
        }

        function closeFinish(restoreFocus) {
            if (!finishEl) {
                return;
            }
            finishEl.parentNode.removeChild(finishEl);
            finishEl = null;
            updateFrames();
            document.documentElement.classList.remove("cmp-vtour-locked");
            if (restoreFocus && finishReturn && document.documentElement.contains(finishReturn)) {
                finishReturn.focus();
            }
        }

        function showFinish() {
            end(false);
            closeFinish(false);
            finishReturn = document.activeElement;
            var screen = document.createElement("section");
            screen.className = "cmp-vtour__finish";
            screen.setAttribute("role", "dialog");
            screen.setAttribute("aria-modal", "true");
            screen.setAttribute("aria-labelledby", "cmp-vtour-finish-title");
            screen.setAttribute("aria-describedby", "cmp-vtour-finish-text");
            var copy = document.createElement("div");
            copy.className = "cmp-vtour__finish-copy";
            var h = document.createElement("h2");
            h.id = "cmp-vtour-finish-title";
            h.className = "cmp-vtour__finish-title";
            h.appendChild(document.createTextNode("The Future of Spend Management Starts with "));
            var strong = document.createElement("strong");
            strong.textContent = "Spend Clarity for Enterprise";
            h.appendChild(strong);
            copy.appendChild(h);
            var p = document.createElement("p");
            p.id = "cmp-vtour-finish-text";
            p.className = "cmp-vtour__finish-text";
            p.textContent = "The capabilities you\u2019ve just seen come together to create a seamless, end-to-end " +
                "view of spend. With greater visibility and control, businesses can move forward with clarity " +
                "and confidence. Connect with your banking representative to learn how Spend Clarity for " +
                "Enterprise can support your organization.";
            copy.appendChild(p);
            var restart = document.createElement("button");
            restart.type = "button";
            restart.className = "cmp-vtour__finish-btn";
            restart.textContent = "Restart Demo";
            restart.addEventListener("click", function () {
                closeFinish(false);
                go(0, false);
            });
            copy.appendChild(restart);
            screen.appendChild(copy);
            var laptop = document.createElement("div");
            laptop.className = "cmp-vtour__laptop";
            laptop.setAttribute("aria-hidden", "true");
            var lid = document.createElement("div");
            lid.className = "cmp-vtour__laptop-lid";
            lid.appendChild(mockDashboard());
            laptop.appendChild(lid);
            var base = document.createElement("div");
            base.className = "cmp-vtour__laptop-base";
            laptop.appendChild(base);
            screen.appendChild(laptop);
            screen.addEventListener("keydown", function (e) {
                if (e.key === "Tab") {
                    e.preventDefault();
                    restart.focus();
                } else if (e.key === "Escape" || e.key === "Esc") {
                    e.preventDefault();
                    closeFinish(true);
                    status.textContent = "Guided journey finished.";
                }
            });
            document.body.appendChild(screen);
            finishEl = screen;
            updateFrames();
            document.documentElement.classList.add("cmp-vtour-locked");
            restart.focus();
            status.textContent = "Guided journey finished. Restart Demo to start again.";
        }

        function go(i, flow) {
            if (i < 0) {
                return;
            }
            if (i >= STEPS.length) {
                /* Let the last action (Complete) update the list, then show the end screen. */
                end(false);
                window.setTimeout(showFinish, 400);
                return;
            }
            var step = STEPS[i];
            arrivedByFlow = !!flow;
            writeState({ step: step.id, flow: arrivedByFlow });
            if (step.page !== page) {
                clearUi();
                window.location.assign(urlFor(step.page));
                return;
            }
            render(i);
        }

        /* Previous / next frame arrows (bottom centre). */
        var prevBtn = q("[data-cmp-vtour-prev]", root);
        var nextBtn = q("[data-cmp-vtour-nextframe]", root);

        function updateFrames() {
            if (!prevBtn || !nextBtn) {
                return;
            }
            var finished = !!finishEl;
            prevBtn.disabled = finished || stepIndex <= 0;
            nextBtn.disabled = finished;
        }

        if (prevBtn && nextBtn) {
            prevBtn.addEventListener("click", function () {
                if (stepIndex > 0) {
                    go(stepIndex - 1, true);
                }
            });
            nextBtn.addEventListener("click", function () {
                if (finishEl) {
                    return;
                }
                if (stepIndex < 0) {
                    go(firstOfChapter(PAGE_CHAPTER[page]), false);
                    return;
                }
                var step = STEPS[stepIndex];
                if (step.onNext) {
                    step.onNext();
                }
                go(stepIndex + 1, true);
            });
        }

        chapters.forEach(function (b) {
            b.addEventListener("click", function () {
                go(firstOfChapter(b.getAttribute("data-cmp-vtour-chapter")), false);
            });
        });

        document.addEventListener("keydown", function (e) {
            if ((e.key === "Escape" || e.key === "Esc") && stepIndex >= 0 && pop &&
                (pop.contains(document.activeElement) || document.activeElement === document.body)) {
                end(true);
            }
        });
        window.addEventListener("resize", layout);
        window.addEventListener("scroll", layout, true);

        markChapter(null);
        updateFrames();

        /* Resume on page load, or show the welcome on the home page once per tab. */
        var state = readState();
        var resume = state && indexOf(state.step);
        if (state && resume >= 0 && STEPS[resume].page === page) {
            arrivedByFlow = !!state.flow;
            render(resume);
        } else if (!state && page === "home" && root.getAttribute("data-welcome") !== "false") {
            var seen = false;
            try {
                seen = window.sessionStorage.getItem(KEY + "-welcomed") === "1";
                window.sessionStorage.setItem(KEY + "-welcomed", "1");
            } catch (err) {
                seen = false;
            }
            if (!seen) {
                go(0, false);
            }
        } else if (state) {
            writeState(null);
        }
    }

    function boot() {
        Array.prototype.forEach.call(document.querySelectorAll("[data-cmp-vtour]"), function (root) {
            try {
                init(root);
            } catch (err) {
                window.console.warn("VSC Guided Journey could not start", err);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
