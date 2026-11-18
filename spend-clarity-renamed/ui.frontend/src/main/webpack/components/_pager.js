/* VSC Pagination — UI for any paged list (e.g. VSC Card Listing).
   The list owns the data; the pager only shows state and asks for pages.
     list  -> pager : CustomEvent "vsc:pager-render" { page, pages }
                      (also mirrored in data-cmp-pager-page / -pages)
     pager -> list  : CustomEvent "vsc:pager-change" { page }
   A pager that appears later (AEM editor drop/refresh) announces itself
   with "vsc:pager-ready" on document so lists can link to it. */
(function () {
    "use strict";

    function readInt(pager, name, fallback) {
        var n = parseInt(pager.getAttribute(name), 10);
        return n > 0 ? n : fallback;
    }

    function init(pager) {
        if (!pager || pager.__vscPagerInit) {
            return;
        }
        pager.__vscPagerInit = true;

        var prev = pager.querySelector("[data-cmp-pager-prev]");
        var next = pager.querySelector("[data-cmp-pager-next]");
        var status = pager.querySelector("[data-cmp-pager-status]");
        var state = { page: 1, pages: 1 };

        function update(page, pages) {
            var hadFocus = document.activeElement;
            state.pages = Math.max(1, pages);
            state.page = Math.min(Math.max(1, page), state.pages);
            var text = "Page " + state.page + " of " + state.pages;
            if (status.textContent !== text) {
                status.textContent = text;
            }
            prev.disabled = state.page <= 1;
            next.disabled = state.page >= state.pages;
            /* Keep keyboard focus inside the pager when a button disables itself. */
            if (hadFocus === prev && prev.disabled && !next.disabled) {
                next.focus();
            } else if (hadFocus === next && next.disabled && !prev.disabled) {
                prev.focus();
            }
        }

        function request(page) {
            pager.dispatchEvent(new CustomEvent("vsc:pager-change", {
                bubbles: true,
                detail: { page: page }
            }));
        }

        prev.addEventListener("click", function () {
            if (state.page > 1) {
                request(state.page - 1);
            }
        });
        next.addEventListener("click", function () {
            if (state.page < state.pages) {
                request(state.page + 1);
            }
        });

        pager.addEventListener("vsc:pager-render", function (e) {
            var d = e.detail || {};
            update(d.page || 1, d.pages || 1);
        });

        /* Pick up state a list may have written before this script ran. */
        update(readInt(pager, "data-cmp-pager-page", 1), readInt(pager, "data-cmp-pager-pages", 1));

        document.dispatchEvent(new CustomEvent("vsc:pager-ready", { detail: { pager: pager } }));
    }

    function scan(root) {
        if (root.matches && root.matches("[data-cmp-pager]")) {
            init(root);
        }
        if (root.querySelectorAll) {
            Array.prototype.forEach.call(root.querySelectorAll("[data-cmp-pager]"), init);
        }
    }

    function boot() {
        scan(document);
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
