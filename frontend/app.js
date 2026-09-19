"use strict";

const FIELD_LABELS = {
  shipper: "Shipper", consignee: "Consignee", notify_party: "Notify Party",
  port_of_loading: "Port of Loading", port_of_discharge: "Port of Discharge",
  container_count: "Container Count", gross_weight_kg: "Gross Weight (kg)",
};
const CATEGORIES = {
  BL_COMPARISON: "Comparison", SI_REQUEST: "New SI", INVOICE_QUERY: "Invoice",
  GENERAL: "General", SPAM: "Spam", UNKNOWN: "Unclassified",
};
const STATUS_LABELS = { OK: "Matched", MISMATCH: "Mismatch", NEEDS_REVIEW: "Needs Review", CLASSIFIED: "Classified" };

const $main = document.getElementById("main");
const $reviewer = document.getElementById("reviewer");
const state = { category: "", q: "" };

try { $reviewer.value = localStorage.getItem("logos.reviewer") || ""; } catch (e) { /* storage unavailable */ }
$reviewer.addEventListener("input", () => {
  try { localStorage.setItem("logos.reviewer", $reviewer.value); } catch (e) { /* ignore */ }
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtVal(v) {
  if (v === null || v === undefined) return '<span class="null">missing</span>';
  return esc(typeof v === "number" ? v.toLocaleString("en-US") : v);
}
function fmtTime(t) { return t ? new Date(t).toLocaleString() : ""; }
function pill(status) { return `<span class="status ${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`; }

async function api(path, opts) {
  const res = await fetch(path, opts && opts.body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body),
  } : opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.detail && (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))) || res.statusText);
  return data;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}
function reviewer() {
  const name = $reviewer.value.trim();
  if (!name) { toast("Enter your name under 'Signed in as' first."); $reviewer.focus(); }
  return name;
}
function setNav(active) {
  document.getElementById("nav-inbox").classList.toggle("active", active === "inbox");
  document.getElementById("nav-review").classList.toggle("active", active === "review");
  document.getElementById("nav-inbox").toggleAttribute("aria-current", active === "inbox");
  document.getElementById("nav-review").toggleAttribute("aria-current", active === "review");
}
async function refreshBadge() {
  try {
    const s = await api("/stats");
    const b = document.getElementById("nav-badge");
    b.hidden = !s.needs_review; b.textContent = s.needs_review;
  } catch (e) { /* ignore */ }
}

/* ---------------- Inbox ---------------- */
async function renderInbox() {
  setNav("inbox");
  $main.innerHTML = `<h1>Inbox</h1><p class="sub">Shipping operations mail, classified and checked.</p>
    <div class="toolbar">
      <div class="search"><label for="q" class="sr" style="position:absolute;left:-999px">Search emails</label>
        <input id="q" type="search" placeholder="Search sender, subject or shipment ref" value="${esc(state.q)}"></div>
      <button class="btn solid" id="run">Run pipeline</button>
      <span id="run-status" class="sub" style="margin:0" role="status"></span>
    </div>
    <div class="pills" id="pills" role="group" aria-label="Filter by category"></div>
    <div class="stats" id="stats"></div>
    <div class="card table-card" id="table"></div>`;
  const pills = document.getElementById("pills");
  const opts = [["", "All"], ...Object.entries(CATEGORIES).filter(([k]) => k !== "UNKNOWN"), ["UNKNOWN", "Unclassified"]];
  pills.innerHTML = opts.map(([k, l]) => `<button class="pill-btn" data-c="${k}" aria-pressed="${state.category === k}">${l}</button>`).join("");
  pills.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.category = b.dataset.c; renderInbox();
  });
  let timer;
  document.getElementById("q").addEventListener("input", e => {
    state.q = e.target.value; clearTimeout(timer); timer = setTimeout(loadTable, 250);
  });
  document.getElementById("run").addEventListener("click", startRun);
  await Promise.all([loadStats(), loadTable()]);
  pollRun();
}
async function loadStats() {
  const s = await api("/stats");
  const cards = [["Total Processed", s.total], ["Mismatches Found", s.mismatches], ["Needs Review", s.needs_review], ["Clean Matches", s.clean]];
  document.getElementById("stats").innerHTML = cards.map(([l, n]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
}
async function loadTable() {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.q) params.set("q", state.q);
  const rows = await api("/emails?" + params);
  const el = document.getElementById("table");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<p class="empty" style="padding:18px">${state.category || state.q ? "No emails match this filter." : "No emails processed yet. Choose “Run pipeline” to process the inbox."}</p>`;
    return;
  }
  el.innerHTML = `<table><thead><tr><th scope="col">Sender / Subject</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Processed</th><th scope="col"><span style="position:absolute;left:-999px">Action</span></th></tr></thead><tbody>${
    rows.map(r => `<tr>
      <td><div class="subject">${esc(r.subject)}</div><div class="from">${esc(r.sender)}</div></td>
      <td>${esc(CATEGORIES[r.category] || r.category)}${r.confidence != null ? `<div class="from">${Math.round(r.confidence * 100)}% conf.</div>` : ""}</td>
      <td>${pill(r.status)}</td>
      <td class="from">${esc(fmtTime(r.processed_at))}</td>
      <td>${r.category === "BL_COMPARISON" ? `<a class="link" href="#/email/${esc(r.id)}">View →</a>` : ""}</td></tr>`).join("")}</tbody></table>`;
}
async function startRun() {
  try { await api("/process", { body: {} }); } catch (e) { toast(e.message); }
  pollRun();
}
let pollTimer;
async function pollRun() {
  clearTimeout(pollTimer);
  const el = document.getElementById("run-status"); if (!el) return;
  const p = await api("/process/status");
  el.textContent = p.running ? `Processing ${p.done} / ${p.total}…` : (p.finished_at ? `Last run finished. ${p.errors} pipeline error(s).` : "");
  document.getElementById("run").disabled = p.running;
  if (p.running) { await Promise.all([loadStats(), loadTable()]); refreshBadge(); pollTimer = setTimeout(pollRun, 2000); }
  else if (p.finished_at) { loadStats(); loadTable(); refreshBadge(); }
}

/* ---------------- Detail ---------------- */
async function renderDetail(id) {
  setNav("inbox");
  let d;
  try { d = await api("/emails/" + encodeURIComponent(id)); }
  catch (e) { $main.innerHTML = `<p><a class="link" href="#/inbox">← Back to inbox</a></p><p class="err">${esc(e.message)}</p>`; return; }

  const mism = d.comparison.filter(r => r.match === false).length;
  const miss = d.comparison.filter(r => r.match === null).length;
  let banner;
  if (d.status === "NEEDS_REVIEW") banner = `<strong>Needs review.</strong> ${d.reasons.length} open escalation(s); this case cannot be trusted until a reviewer confirms it.`;
  else if (d.status === "MISMATCH") banner = `<strong>Mismatch.</strong> ${mism} of 7 fields differ between the SI and the draft BL.`;
  else banner = `<strong>Matched.</strong> All 7 fields agree between the SI and the draft BL.`;
  if (d.resolved_by) banner += ` Resolved by ${esc(d.resolved_by)} on ${esc(fmtTime(d.resolved_at))}.`;

  $main.innerHTML = `<p><a class="link" href="#/inbox">← Back to inbox</a></p>
    <h1>${esc(d.subject)}</h1>
    <div class="card"><dl class="meta">
      <div><dt>From</dt><dd>${esc(d.sender)}</dd></div>
      <div><dt>Processed</dt><dd>${esc(fmtTime(d.processed_at))}</dd></div>
      <div><dt>Classification confidence</dt><dd>${d.confidence != null ? Math.round(d.confidence * 100) + "%" : "n/a"} (${esc(CATEGORIES[d.category] || d.category)})</dd></div>
      <div><dt>Shipment ref</dt><dd>${esc(d.shipment_ref || "not stated")}</dd></div></dl></div>
    <div class="verdict ${esc(d.status)}" role="status">${banner}</div>
    <div class="actions">
      <button class="btn outline" id="esc">Escalate to Team</button>
      <button class="btn solid" id="resolve">Mark Resolved</button>
    </div>
    ${d.reasons.length ? `<section class="card"><h2>Open escalations</h2>${reasonsHtml(d.reasons)}</section>` : ""}
    <section class="card table-card" aria-labelledby="cmp-h"><h2 id="cmp-h" style="padding:18px 18px 0">Shipping Instruction vs draft Bill of Lading</h2>
      <table class="compare"><thead><tr><th scope="col">Field</th><th scope="col">SI (source of truth)</th><th scope="col">Draft BL</th><th scope="col">Result</th><th scope="col">Edit</th></tr></thead><tbody>${
        d.comparison.map(r => `<tr class="${r.match === false ? "flag" : r.match === null ? "miss" : ""}" data-field="${r.field}">
          <th scope="row">${FIELD_LABELS[r.field]}</th>
          <td class="val">${fmtVal(r.si)}</td><td class="val">${fmtVal(r.bl)}</td>
          <td class="mark">${r.match === false ? "Mismatch" : r.match === null ? "Missing" : "Match"}</td>
          <td><button class="linkbtn" data-edit="${r.field}">Edit</button></td></tr>`).join("")}</tbody></table></section>
    <section class="card" aria-labelledby="hist-h"><h2 id="hist-h">Edit history</h2>${
      d.edit_log.length ? `<ul class="history">${d.edit_log.map(h => `<li><strong>${FIELD_LABELS[h.field]}</strong> (${esc(h.doc)}):
        <span class="mono">${esc(h.old_value ?? "missing")}</span> → <span class="mono">${esc(h.new_value)}</span><br>
        <span class="from">${esc(h.editor)} · ${esc(fmtTime(h.timestamp))} · Reason: ${esc(h.reason)}</span></li>`).join("")}</ul>`
        : `<p class="empty">No edits recorded for this case</p>`}</section>`;

  $main.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openEdit(d, b.dataset.edit)));
  document.getElementById("esc").addEventListener("click", async () => {
    const editor = reviewer(); if (!editor) return;
    const note = prompt("Note for the team (optional):") ?? null; if (note === null) return;
    try { await api(`/emails/${id}/escalate`, { body: { editor, note } }); toast("Escalated to team."); renderDetail(id); refreshBadge(); }
    catch (e) { toast(e.message); }
  });
  document.getElementById("resolve").addEventListener("click", () => resolveCase(id, () => renderDetail(id)));
}

function openEdit(d, field) {
  document.querySelectorAll(".edit-row").forEach(r => r.remove());
  const tr = $main.querySelector(`tr[data-field="${field}"]`);
  const row = document.createElement("tr"); row.className = "edit-row";
  const cur = d.comparison.find(r => r.field === field);
  row.innerHTML = `<td colspan="5"><form class="edit-form" novalidate>
    <div><label for="ed-doc">Document</label><select id="ed-doc"><option value="SI">SI</option><option value="BL">BL</option></select></div>
    <div><label for="ed-val">New value for ${FIELD_LABELS[field]}</label><input id="ed-val" type="text" value="${esc(cur.si ?? "")}"></div>
    <div><label for="ed-reason">Reason for correction (required)</label><input id="ed-reason" type="text"></div>
    <button class="btn solid" type="submit">Save</button><button class="btn outline" type="button" id="ed-cancel">Cancel</button>
    <div class="err" id="ed-err" role="alert" style="grid-column:1/-1"></div></form></td>`;
  tr.after(row);
  const doc = row.querySelector("#ed-doc"), val = row.querySelector("#ed-val");
  doc.addEventListener("change", () => { val.value = (doc.value === "SI" ? cur.si : cur.bl) ?? ""; });
  val.focus();
  row.querySelector("#ed-cancel").addEventListener("click", () => row.remove());
  row.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const err = row.querySelector("#ed-err");
    const editor = reviewer();
    if (!editor) { err.textContent = "Enter your name under 'Signed in as'."; return; }
    const reason = row.querySelector("#ed-reason").value.trim();
    if (!reason) { err.textContent = "A short reason is required."; return; }
    try {
      await api(`/emails/${d.id}/edit`, { body: { field, doc: doc.value, new_value: val.value, editor, reason } });
      toast("Correction saved and logged."); renderDetail(d.id); refreshBadge();
    } catch (e) { err.textContent = e.message; }
  });
}

function reasonsHtml(reasons) {
  return reasons.map(r => `<div class="reason-item"><div class="reason-title">${esc(r.message)}</div>
    ${r.evidence ? `<pre class="evidence">${esc(r.evidence)}</pre>` : ""}</div>`).join("");
}

async function resolveCase(id, after) {
  const editor = reviewer(); if (!editor) return;
  try { await api(`/emails/${id}/resolve`, { body: { editor } }); toast("Case resolved."); after(); refreshBadge(); }
  catch (e) { toast(e.message); }
}

/* ---------------- Needs Review ---------------- */
async function renderReview() {
  setNav("review");
  $main.innerHTML = `<h1>Needs Review</h1><p class="sub">Cases the system would not decide on its own. Each shows why and the source evidence.</p><div id="queue"></div>`;
  const q = await api("/review-queue");
  const el = document.getElementById("queue");
  if (!q.length) { el.innerHTML = `<div class="card empty">Nothing needs review.</div>`; return; }
  el.innerHTML = q.map(c => `<section class="card" data-id="${esc(c.id)}"><div class="case">
      <div><h2>${esc(c.subject)}</h2><div class="from">${esc(c.sender)} · ${esc(CATEGORIES[c.category] || c.category)}</div></div>
      <div class="case-actions">
        ${c.category === "BL_COMPARISON" ? `<a class="link" href="#/email/${esc(c.id)}">Open case →</a>` : ""}
        <button class="linkbtn" data-src="${esc(c.id)}">View Source</button>
        <button class="btn solid" data-res="${esc(c.id)}">Confirm &amp; Resolve</button></div></div>
      <div style="margin-top:12px">${reasonsHtml(c.reasons)}</div><div class="src"></div></section>`).join("");
  el.querySelectorAll("[data-src]").forEach(b => b.addEventListener("click", async () => {
    const box = b.closest("section").querySelector(".src");
    if (box.innerHTML) { box.innerHTML = ""; return; }
    try {
      const s = await api(`/emails/${b.dataset.src}/source`);
      const part = (t, x) => x ? `<h2 style="margin-top:14px">${t}</h2><pre class="evidence">${esc(x)}</pre>` : "";
      box.innerHTML = part("Email body", s.body) + part("SI text", s.si_text) + part("BL text", s.bl_text);
    } catch (e) { toast(e.message); }
  }));
  el.querySelectorAll("[data-res]").forEach(b => b.addEventListener("click", () => resolveCase(b.dataset.res, renderReview)));
}

/* ---------------- Router ---------------- */
function route() {
  const h = location.hash || "#/inbox";
  let m;
  if ((m = h.match(/^#\/email\/(.+)$/))) renderDetail(decodeURIComponent(m[1]));
  else if (h === "#/review") renderReview();
  else renderInbox();
  refreshBadge();
}
window.addEventListener("hashchange", route);
route();
