/* VSC table export — dependency-free CSV, Excel (.xlsx), PDF and PNG.
   Usage (any component):
     window.VSC.exporter.download("xlsx", {
         filename: "charge-codes",          // no extension
         title: "Charge Codes",             // PDF / image heading, sheet name
         columns: ["Value", "Type"],
         rows: [["500030", "GL Account"]]
     });
   Formats: "csv" | "xlsx" | "pdf" | "png". Returns true when a file was produced.
   Everything is generated in the browser: no network requests, no libraries. */
(function () {
    "use strict";

    var VSC = window.VSC = window.VSC || {};

    /* ---------- download ---------- */
    function save(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function utf8(str) {
        return new TextEncoder().encode(str);
    }

    function cell(v) {
        return v === null || v === undefined ? "" : String(v);
    }

    /* ---------- CSV ---------- */
    function toCsv(columns, rows) {
        function q(v) {
            var s = cell(v);
            /* Neutralise spreadsheet formulas (CSV injection). */
            if (/^[=+\-@\t\r]/.test(s)) {
                s = "'" + s;
            }
            return '"' + s.replace(/"/g, '""') + '"';
        }
        var lines = [columns.map(q).join(",")];
        rows.forEach(function (r) { lines.push(r.map(q).join(",")); });
        return new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    }

    /* ---------- ZIP (stored) for XLSX ---------- */
    var CRC_TABLE = (function () {
        var t = [];
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) {
                /* eslint-disable-next-line no-bitwise */
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            /* eslint-disable-next-line no-bitwise */
            t[n] = c >>> 0;
        }
        return t;
    }());

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) {
            /* eslint-disable-next-line no-bitwise */
            c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        }
        /* eslint-disable-next-line no-bitwise */
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function zip(files) {
        var parts = [];
        var central = [];
        var offset = 0;
        function u16(v) {
            /* eslint-disable-next-line no-bitwise */
            return [v & 0xFF, (v >>> 8) & 0xFF];
        }
        function u32(v) {
            /* eslint-disable-next-line no-bitwise */
            return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
        }
        files.forEach(function (f) {
            var name = utf8(f.name);
            var data = utf8(f.data);
            var crc = crc32(data);
            var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
                u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
            var local = new Uint8Array([].concat(u32(0x04034b50), common));
            parts.push(local, name, data);
            central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common,
                u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
            offset += local.length + name.length + data.length;
        });
        var size = central.reduce(function (s, p) { return s + p.length; }, 0);
        var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length),
            u16(files.length), u32(size), u32(offset), u16(0)));
        return new Blob(parts.concat(central, [end]),
            { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }

    function xml(s) {
        return cell(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    }

    function colName(i) {
        var s = "";
        var n = i + 1;
        while (n > 0) {
            var m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    function toXlsx(title, columns, rows) {
        var sheetName = xml((title || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
        var all = [columns].concat(rows);
        var sheetRows = all.map(function (r, ri) {
            var cells = r.map(function (v, ci) {
                var ref = colName(ci) + (ri + 1);
                return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : "") +
                    "><is><t xml:space=\"preserve\">" + xml(v) + "</t></is></c>";
            }).join("");
            return '<row r="' + (ri + 1) + '">' + cells + "</row>";
        }).join("");
        var widths = columns.map(function (c, ci) {
            var w = all.reduce(function (m, r) { return Math.max(m, cell(r[ci]).length); }, 8);
            return '<col min="' + (ci + 1) + '" max="' + (ci + 1) + '" width="' + Math.min(60, w + 2) +
                '" customWidth="1"/>';
        }).join("");
        var ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
        var rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
        return zip([
            { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-' +
                'officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-' +
                'officedocument.spreadsheetml.worksheet+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-' +
                'officedocument.spreadsheetml.styles+xml"/></Types>' },
            { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="xl/workbook.xml"/>' +
                "</Relationships>" },
            { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                "<workbook " + ns + ' xmlns:r="' + rel + '"><sheets><sheet name="' + sheetName +
                '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
            { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="' + rel + '/worksheet" Target="worksheets/sheet1.xml"/>' +
                '<Relationship Id="rId2" Type="' + rel + '/styles" Target="styles.xml"/></Relationships>' },
            { name: "xl/styles.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                "<styleSheet " + ns + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
                '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
                '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
                '<fill><patternFill patternType="gray125"/></fill></fills>' +
                '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
                '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
                '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
                '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
                '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
                "</styleSheet>" },
            { name: "xl/worksheets/sheet1.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                "<worksheet " + ns + "><cols>" + widths + "</cols><sheetData>" + sheetRows +
                "</sheetData></worksheet>" }
        ]);
    }

    /* ---------- PDF (Helvetica, A4 landscape, paginated) ---------- */
    function pdfText(s) {
        var out = "";
        var str = cell(s);
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            var ch = str.charAt(i);
            if (ch === "\\" || ch === "(" || ch === ")") {
                out += "\\" + ch;
            } else if (code < 32) {
                out += " ";
            } else if (code < 128) {
                out += ch;
            } else if (code < 256) {
                out += "\\" + ("00" + code.toString(8)).slice(-3);
            } else {
                out += "?";
            }
        }
        return out;
    }

    function fit(text, maxChars) {
        var s = cell(text);
        return s.length > maxChars ? s.slice(0, Math.max(1, maxChars - 3)) + "..." : s;
    }

    function toPdf(title, columns, rows) {
        var W = 842;
        var H = 595;
        var M = 40;
        var ROW = 20;
        var usable = W - 2 * M;
        var weights = columns.map(function (c, ci) {
            return [c].concat(rows.map(function (r) { return r[ci]; }))
                .reduce(function (m, v) { return Math.max(m, cell(v).length); }, 4);
        });
        var total = weights.reduce(function (a, b) { return a + b; }, 0);
        var widths = weights.map(function (w) { return usable * w / total; });
        var perPage = Math.floor((H - 2 * M - 60) / ROW);
        var pages = [];
        for (var p = 0; p === 0 || p * perPage < rows.length; p++) {
            pages.push(rows.slice(p * perPage, (p + 1) * perPage));
        }

        function rowOps(values, y, bold) {
            var x = M;
            var ops = "";
            values.forEach(function (v, ci) {
                var maxChars = Math.floor(widths[ci] / 5.2);
                ops += "BT /" + (bold ? "F2" : "F1") + " 10 Tf " + (x + 4).toFixed(1) + " " + (y + 6).toFixed(1) +
                    " Td (" + pdfText(fit(v, maxChars)) + ") Tj ET\n";
                x += widths[ci];
            });
            ops += "0.85 G 0.5 w " + M + " " + y.toFixed(1) + " m " + (W - M) + " " + y.toFixed(1) + " l S\n";
            return ops;
        }

        var objects = [];
        function add(body) {
            objects.push(body);
            return objects.length;
        }
        var fontReg = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        var fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        var pagesId = objects.length + 1;
        objects.push(null);
        var kids = [];
        pages.forEach(function (chunk, pi) {
            var y = H - M - 20;
            var ops = "BT /F2 16 Tf " + M + " " + y + " Td (" + pdfText(title) + ") Tj ET\n";
            ops += "BT /F1 9 Tf " + (W - M - 90) + " " + y + " Td (" + pdfText("Page " + (pi + 1) + " of " +
                pages.length) + ") Tj ET\n";
            y -= 34;
            ops += "0.95 g " + M + " " + y.toFixed(1) + " " + usable + " " + ROW + " re f 0 g\n";
            ops += rowOps(columns, y, true);
            chunk.forEach(function (r) {
                y -= ROW;
                ops += rowOps(r, y, false);
            });
            var stream = add("<< /Length " + ops.length + " >>\nstream\n" + ops + "endstream");
            kids.push(add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + W + " " + H + "] " +
                "/Resources << /Font << /F1 " + fontReg + " 0 R /F2 " + fontBold + " 0 R >> >> " +
                "/Contents " + stream + " 0 R >>"));
        });
        objects[pagesId - 1] = "<< /Type /Pages /Kids [" + kids.map(function (k) { return k + " 0 R"; }).join(" ") +
            "] /Count " + kids.length + " >>";
        var catalog = add("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");
        var info = add("<< /Title (" + pdfText(title) + ") /Producer (Spend Clarity) >>");

        var out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
        var offsets = [];
        objects.forEach(function (body, i) {
            offsets.push(out.length);
            out += (i + 1) + " 0 obj\n" + body + "\nendobj\n";
        });
        var xref = out.length;
        out += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
        offsets.forEach(function (o) { out += ("0000000000" + o).slice(-10) + " 00000 n \n"; });
        out += "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalog + " 0 R /Info " + info +
            " 0 R >>\nstartxref\n" + xref + "\n%%EOF";
        var bytes = new Uint8Array(out.length);
        for (var i = 0; i < out.length; i++) {
            /* eslint-disable-next-line no-bitwise */
            bytes[i] = out.charCodeAt(i) & 0xFF;
        }
        return new Blob([bytes], { type: "application/pdf" });
    }

    /* ---------- PNG (canvas) ---------- */
    function toPng(title, columns, rows, done) {
        var scale = 2;
        var font = "13px Arial, Helvetica, sans-serif";
        var bold = "bold 13px Arial, Helvetica, sans-serif";
        var pad = 12;
        var rowH = 32;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        if (!ctx || !canvas.toBlob) {
            done(null);
            return;
        }
        ctx.font = bold;
        var widths = columns.map(function (c, ci) {
            var w = ctx.measureText(cell(c)).width;
            ctx.font = font;
            rows.forEach(function (r) { w = Math.max(w, ctx.measureText(cell(r[ci])).width); });
            ctx.font = bold;
            return Math.ceil(w) + pad * 2;
        });
        var width = widths.reduce(function (a, b) { return a + b; }, 0) + 32;
        var height = 64 + rowH * (rows.length + 1) + 16;
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#202124";
        ctx.font = "bold 18px Arial, Helvetica, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(cell(title), 16, 30);
        var y = 56;
        [columns].concat(rows).forEach(function (r, ri) {
            if (ri === 0) {
                ctx.fillStyle = "#f1f3f5";
                ctx.fillRect(16, y, width - 32, rowH);
            }
            ctx.fillStyle = "#202124";
            ctx.font = ri === 0 ? bold : font;
            var x = 16;
            r.forEach(function (v, ci) {
                ctx.fillText(cell(v), x + pad, y + rowH / 2);
                x += widths[ci];
            });
            ctx.fillStyle = "#dfe2e6";
            ctx.fillRect(16, y + rowH - 1, width - 32, 1);
            y += rowH;
        });
        canvas.toBlob(done, "image/png");
    }

    /* ---------- public API ---------- */
    function download(format, spec) {
        var columns = spec.columns || [];
        var rows = spec.rows || [];
        var title = spec.title || "Export";
        var base = (spec.filename || title).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
        if (format === "csv") {
            save(toCsv(columns, rows), base + ".csv");
        } else if (format === "xlsx") {
            save(toXlsx(title, columns, rows), base + ".xlsx");
        } else if (format === "pdf") {
            save(toPdf(title, columns, rows), base + ".pdf");
        } else if (format === "png") {
            toPng(title, columns, rows, function (blob) {
                if (blob) {
                    save(blob, base + ".png");
                }
            });
        } else {
            return false;
        }
        return true;
    }

    VSC.exporter = {
        download: download,
        /* Exposed for unit tests. */
        build: { csv: toCsv, xlsx: toXlsx, pdf: toPdf, png: toPng }
    };
}());
