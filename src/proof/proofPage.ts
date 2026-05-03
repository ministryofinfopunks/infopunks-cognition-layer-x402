import type { ReceiptRecord } from "../x402/types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRow(label: string, value: string): string {
  return `<div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

export function renderProofIndex(records: ReceiptRecord[]): string {
  const rows = records.map((record) => `
    <a class="receipt-link" href="${escapeHtml(record.receipt.proof_url)}">
      <span>${escapeHtml(record.receipt.created_at)}</span>
      <span>${escapeHtml(record.receipt.tool_id)}</span>
      <span>${escapeHtml(record.payment_status)}</span>
      <span>${escapeHtml(record.receipt.receipt_id)}</span>
    </a>
  `).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Infopunks Proof Index</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #06090d; color: #d8e4f2; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      main { max-width: 960px; margin: 0 auto; padding: 28px 20px 56px; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 20px; color: #8ca1b8; }
      .frame { border: 1px solid #243140; border-radius: 14px; background: #0a1118; overflow: hidden; }
      .receipt-link { display: grid; grid-template-columns: 1.3fr 1fr .8fr 1.6fr; gap: 12px; padding: 12px 16px; color: inherit; text-decoration: none; border-top: 1px solid #182330; }
      .receipt-link:first-of-type { border-top: 0; }
      .receipt-link:hover { background: #0f1923; }
      .header { display: grid; grid-template-columns: 1.3fr 1fr .8fr 1.6fr; gap: 12px; padding: 12px 16px; background: #0d151e; color: #8ca1b8; text-transform: uppercase; font-size: 12px; letter-spacing: .08em; }
    </style>
  </head>
  <body>
    <main>
      <h1>Infopunks Proof</h1>
      <p>Verified paid calls with public proof metadata only.</p>
      <section class="frame">
        <div class="header"><span>Timestamp</span><span>Tool</span><span>Status</span><span>Receipt</span></div>
        ${rows || '<div class="receipt-link"><span>No receipts yet.</span><span></span><span></span><span></span></div>'}
      </section>
    </main>
  </body>
</html>`;
}

export function renderProofPage(record: ReceiptRecord): string {
  const { receipt } = record;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(receipt.tool_id)} proof</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: radial-gradient(circle at top, #101824 0%, #05070a 65%); color: #d8e4f2; font: 15px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      main { max-width: 860px; margin: 0 auto; padding: 36px 20px 64px; }
      .terminal { border: 1px solid #273548; border-radius: 18px; overflow: hidden; background: rgba(6, 10, 15, 0.92); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45); }
      .topbar { display: flex; gap: 8px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #17212d; background: #0b1219; }
      .dot { width: 10px; height: 10px; border-radius: 999px; background: #ff5f57; box-shadow: 18px 0 0 #febc2e, 36px 0 0 #28c840; }
      .screen { padding: 22px 20px 24px; }
      .status { color: #7ee787; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      .subtle { color: #8ca1b8; margin: 0 0 20px; }
      .grid { display: grid; gap: 10px; }
      .row { display: grid; grid-template-columns: 140px 1fr; gap: 14px; padding: 10px 0; border-top: 1px solid #111b27; }
      .row:first-child { border-top: 0; }
      .label { color: #8ca1b8; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; }
      .value { word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <section class="terminal">
        <div class="topbar"><span class="dot" aria-hidden="true"></span></div>
        <div class="screen">
          <p class="status">paid call verified</p>
          <h1>Infopunks Cognition Layer Proof</h1>
          <p class="subtle">${escapeHtml(record.result_summary)}</p>
          <div class="grid">
            ${renderRow("tool id", receipt.tool_id)}
            ${renderRow("endpoint", receipt.endpoint)}
            ${renderRow("network", receipt.network)}
            ${renderRow("asset", receipt.asset)}
            ${renderRow("status", record.payment_status)}
            ${renderRow("receipt id", receipt.receipt_id)}
            ${renderRow("result hash", receipt.result_hash)}
            ${renderRow("timestamp", receipt.created_at)}
            ${renderRow("payTo", receipt.payTo)}
            ${renderRow("verifier", receipt.facilitator_provider)}
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
