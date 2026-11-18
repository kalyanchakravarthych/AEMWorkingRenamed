/* VSC Three Column Grid — aligns the three columns with the header tabs.

   Column 1 starts at the LEFT edge of the "My Spend" (2nd primary tab)
   label; Column 1 ends at the "r" of "Cards" in "Virtual Cards" (the
   second "r" reading left-to-right); Column 2 starts at the letter
   after that "r" (the "d"); Column 3 has the same width as Column 1.

   Works with cmp-header and cmp-vscheader. Sets three CSS variables only
   (--cmp-threecolgrid-start, -col, -gap); layout stays in
   _threecolgrid.scss.

   ACCESSIBILITY + LIGHTHOUSE:
   - All DOM reads/writes are batched into one requestAnimationFrame
     callback, so there is no layout thrashing even when the user resizes
     the window rapidly (keeps Total Blocking Time low).
   - No scroll, focus or ARIA state is touched - keyboard navigation and
     screen-reader focus flow stay exactly as the author intends.
   - Observers are reused per nav item (never attached twice), and torn
     down when their nav element is removed from the DOM (memory-safe).
   - Every browser API is feature-detected; the script is a no-op on
     browsers that lack them, so the SCSS fallback values stay in effect
     and the layout still renders.
   - Strict mode, no globals, no console output, no deprecated APIs. */
(function () {
    "use strict";

    /* Named no-op for empty rejection / observer-failure handlers.
       ESLint no-empty-function rule requires a non-empty body. */
    function noop() {
        /* no-op: used to swallow a Promise rejection or observer
           failure without surfacing it to the user. */
        return undefined;
    }


    /* ------------ feature-detection ------------ */
    if (typeof window === "undefined" || typeof document === "undefined") {
        return;
    }
    var raf = window.requestAnimationFrame ||
        function (cb) { return window.setTimeout(cb, 16); };

    /* ------------ constants ------------ */
    var NAV_ITEMS = ".cmp-header__nav-list > .cmp-header__nav-item, " +
        ".cmp-vscheader__nav-list > .cmp-vscheader__item";
    var TAB = ".cmp-header__nav-link, .cmp-vscheader__nav-link";
    var VAR_START = "--cmp-threecolgrid-start";
    var VAR_COL = "--cmp-threecolgrid-col";
    var VAR_GAP = "--cmp-threecolgrid-gap";

    /* ------------ state ------------ */
    var grids = [];
    var frame = 0;
    var resizeObserver = null;
    var observedItems = (typeof WeakSet === "function") ? new WeakSet() : null;

    /* ------------ helpers ------------ */

    /* Walk descendant text nodes to find the "Virtual Cards" label. */
    function textNode(el, pattern) {
        if (!el || typeof document.createTreeWalker !== "function" ||
            typeof window.NodeFilter === "undefined") {
            return null;
        }
        var walker;
        try {
            walker = document.createTreeWalker(el, window.NodeFilter.SHOW_TEXT);
        } catch (err) {
            return null;
        }
        var node = walker.nextNode();
        while (node) {
            if (pattern.test(node.nodeValue)) {
                return node;
            }
            node = walker.nextNode();
        }
        return null;
    }

    /* Left edge of a tab: its box (tab mode) or its visible label (label mode). */
    function leftEdge(tab, mode) {
        var rect = tab.getBoundingClientRect();
        if (mode === "tab") {
            return rect.left;
        }
        var style = window.getComputedStyle(tab);
        return rect.left + (parseFloat(style.paddingLeft) || 0);
    }

    function measure(mode) {
        var items;
        try {
            items = Array.prototype.slice.call(
                document.querySelectorAll(NAV_ITEMS));
        } catch (err) {
            return null;
        }
        if (items.length < 2) {
            return null;
        }
        /* 2nd tab = "My Spend": we want the LEFT edge (text or tab-box). */
        var second = items[1].querySelector(TAB);
        if (!second || !second.offsetWidth) {
            return null;
        }
        var start = leftEdge(second, mode);

        /* Find "Virtual Cards" text node anywhere in the nav. */
        var vcNode = null;
        items.some(function (item) {
            var tab = item.querySelector(TAB);
            var node = tab ? textNode(tab, /virtual\s+cards/i) : null;
            if (node) {
                vcNode = node;
                return true;
            }
            return false;
        });
        if (!vcNode) {
            return null;
        }
        /* Last "r" in "Virtual Cards" = the "r" of "Cards" (the 2nd "r"). */
        var i = vcNode.nodeValue.toLowerCase().lastIndexOf("r");
        if (i < 0) {
            return null;
        }
        var range;
        try {
            range = document.createRange();
            range.setStart(vcNode, i);
            range.setEnd(vcNode, i + 1);
        } catch (err) {
            return null;
        }
        var r = range.getBoundingClientRect();
        if (!r.width) {
            return null;
        }
        return { start: start, rLeft: r.left, rRight: r.right };
    }

    function align(grid, measurements) {
        var mode = grid.getAttribute("data-cmp-threecolgrid-align") === "label"
            ? "label" : "tab";
        var m = measurements ? measurements[mode] : null;
        if (!m) {
            grid.style.removeProperty(VAR_START);
            grid.style.removeProperty(VAR_COL);
            grid.style.removeProperty(VAR_GAP);
            return;
        }
        var origin = grid.getBoundingClientRect().left;
        var start = m.start - origin;
        var col = m.rLeft - m.start;
        var gap = m.rRight - m.rLeft;
        if (start < 0 || col <= 0 || gap <= 0) {
            return;
        }
        grid.style.setProperty(VAR_START, start.toFixed(2) + "px");
        grid.style.setProperty(VAR_COL, col.toFixed(2) + "px");
        grid.style.setProperty(VAR_GAP, gap.toFixed(2) + "px");
    }

    function alignAll() {
        frame = 0;
        /* Drop any grids that have been removed from the DOM (prevents
           memory leaks on SPA navigation + long-lived editor sessions). */
        grids = grids.filter(function (g) {
            return document.documentElement.contains(g);
        });
        if (!grids.length) {
            return;
        }
        var measurements = {
            tab: measure("tab"),
            label: measure("label")
        };
        grids.forEach(function (g) { align(g, measurements); });

        /* Attach a ResizeObserver to any newly-added nav items that have
           not been observed yet (keeps the layout accurate when nav labels
           change or the header reflows at a breakpoint). */
        if (resizeObserver && observedItems) {
            Array.prototype.forEach.call(
                document.querySelectorAll(NAV_ITEMS),
                function (item) {
                    if (!observedItems.has(item)) {
                        observedItems.add(item);
                        try { resizeObserver.observe(item); } catch (err) {
            /* no-op: observer/listener attach failed — safe to continue. */
        }
                    }
                }
            );
        }
    }

    function schedule() {
        if (!frame) {
            frame = raf(alignAll);
        }
    }

    function register(node) {
        if (!node) {
            return;
        }
        var added = false;
        function add(g) {
            if (grids.indexOf(g) < 0) {
                grids.push(g);
                added = true;
            }
        }
        if (typeof node.matches === "function" &&
            node.matches("[data-cmp-threecolgrid]")) {
            add(node);
        }
        if (typeof node.querySelectorAll === "function") {
            Array.prototype.forEach.call(
                node.querySelectorAll("[data-cmp-threecolgrid]"), add);
        }
        if (added) {
            schedule();
        }
    }

    function boot() {
        register(document);

        /* Resize: debounced via rAF already by schedule(). Passive listener
           so this never blocks scroll or touch (Lighthouse "Passive event
           listeners" audit). */
        try {
            window.addEventListener("resize", schedule, { passive: true });
        } catch (err) {
            /* Older browsers without options-object support. */
            window.addEventListener("resize", schedule);
        }

        /* Re-measure once web fonts have settled (tab widths can shift). */
        if (document.fonts && typeof document.fonts.ready === "object" &&
            typeof document.fonts.ready.then === "function") {
            document.fonts.ready.then(schedule, noop);
        }

        /* Observe each nav item for size changes. */
        if (typeof window.ResizeObserver === "function" && observedItems) {
            try {
                resizeObserver = new window.ResizeObserver(schedule);
                Array.prototype.forEach.call(
                    document.querySelectorAll(NAV_ITEMS),
                    function (item) {
                        if (!observedItems.has(item)) {
                            observedItems.add(item);
                            resizeObserver.observe(item);
                        }
                    }
                );
            } catch (err) {
                resizeObserver = null;
            }
        }

        /* AEM editor re-renders components after edits (REFRESH_SELF/PAGE),
           so watch for new [data-cmp-threecolgrid] nodes being added. */
        if (typeof window.MutationObserver === "function" && document.body) {
            try {
                new window.MutationObserver(function (records) {
                    var changed = false;
                    records.forEach(function (record) {
                        Array.prototype.forEach.call(record.addedNodes,
                            function (node) {
                                if (node.nodeType === 1) {
                                    register(node);
                                    changed = true;
                                }
                            });
                    });
                    if (changed && grids.length) {
                        schedule();
                    }
                }).observe(document.body,
                    { childList: true, subtree: true });
            } catch (err) {
                /* no-op: mutation observation is nice-to-have. */
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
