// Dependency-free Excel export.
//
// Builds an Office-flavoured HTML document and downloads it with an .xls
// extension + the Excel MIME type — Excel / Google Sheets / LibreOffice all
// open it as a spreadsheet. Avoids pulling in a heavy SheetJS dependency.

export interface ExcelSheet {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function downloadExcel(filename: string, sheets: ExcelSheet[]): void {
  const blocks = sheets
    .map((sheet) => {
      const head = `<tr>${sheet.columns
        .map(
          (c) =>
            `<th style="background:#2A1D15;color:#FFF7ED;text-align:left;padding:6px 12px;border:1px solid #d6c7b4">${escapeHtml(
              c,
            )}</th>`,
        )
        .join("")}</tr>`;
      const body = sheet.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell) =>
                  `<td style="padding:6px 12px;border:1px solid #e7ddcd">${escapeHtml(
                    cell,
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      return `<h3 style="font-family:sans-serif;margin:14px 0 6px">${escapeHtml(
        sheet.title,
      )}</h3><table border="1" cellspacing="0" cellpadding="0">${head}${body}</table>`;
    })
    .join("<br/>");

  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"/></head><body>${blocks}</body></html>`;

  const blob = new Blob(["﻿", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
