/* VSC Expenses Two Column Grid — aligns the columns with the header tabs.
   Left column ends at the right edge of the 2nd primary tab ("My spend");
   right column content starts at the label of the 3rd tab ("Approvals" in the
   Figma). Works with cmp-header and cmp-vscheader. Sets two CSS variables only. */
(function () {
    "use strict";

    var NAV_ITEMS = ".cmp-header__nav-list > .cmp-header__nav-item, " +
        ".cmp-vscheader__nav-list > .cmp-vscheader__item";
    var TAB = ".cmp-header__nav-link, .cmp-vscheader__nav-link";
    var grids = [];
    var frame = 0;

    function tabs() {
        var items = document.querySelectorAll(NAV_ITEMS);
        if (items.length < 3) {
            return null;
        }
        var second = items[1].querySelector(TAB);
        var third = items[2].querySelector(TAB);
        if (!second || !third || !second.offsetWidth || !third.offsetWidth) {
            return null;
        }
        return { second: second, third: third };
    }

    function align(grid) {
        var t = tabs();
        if (!t) {
            grid.style.removeProperty("--cmp-expgrid-left-end");
            grid.style.removeProperty("--cmp-expgrid-right-start");
            return;
        }
        var origin = grid.getBoundingClientRect().left;
        var leftEnd = t.second.getBoundingClientRect().right - origin;
        var rightStart = t.third.getBoundingClientRect().left +
            (parseFloat(window.getComputedStyle(t.third).paddingLeft) || 0) - origin;
        if (leftEnd <= 0 || rightStart <= leftEnd) {
            return;
        }
        grid.style.setProperty("--cmp-expgrid-left-end", leftEnd.toFixed(2) + "px");
        grid.style.setProperty("--cmp-expgrid-right-start", rightStart.toFixed(2) + "px");
    }

    function alignAll() {
        frame = 0;
        grids = grids.filter(function (g) { return document.documentElement.contains(g); });
        grids.forEach(align);
    }

    function schedule() {
        if (!frame) {
            frame = window.requestAnimationFrame(alignAll);
        }
    }

    function register(node) {
        var added = false;
        function add(g) {
            if (grids.indexOf(g) < 0) {
                grids.push(g);
                added = true;
            }
        }
        if (node.matches && node.matches("[data-cmp-expgrid]")) {
            add(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-expgrid]"), add);
        }
        if (added) {
            schedule();
        }
    }

    function boot() {
        register(document);
        window.addEventListener("resize", schedule);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(schedule);
        }
        if (window.ResizeObserver) {
            var observer = new window.ResizeObserver(schedule);
            Array.prototype.forEach.call(document.querySelectorAll(NAV_ITEMS), function (item) {
                observer.observe(item);
            });
        }
        /* AEM editor re-renders components after edits (REFRESH_SELF/PAGE). */
        if (window.MutationObserver) {
            new window.MutationObserver(function (records) {
                var changed = false;
                records.forEach(function (record) {
                    Array.prototype.forEach.call(record.addedNodes, function (node) {
                        if (node.nodeType === 1) {
                            register(node);
                            changed = true;
                        }
                    });
                });
                if (changed && grids.length) {
                    schedule();
                }
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
