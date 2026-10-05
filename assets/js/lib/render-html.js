// Hiển thị doc model thành trang A4 (HTML) đúng thể thức NĐ 30/2020/NĐ-CP.
import { QUOC_HIEU, TIEU_NGU, formatNoiNhan, formatRecipients } from './doc-types.js';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Escape và làm nổi bật chỗ cần điền dạng [ … ]. */
const tx = (s) => escapeHtml(s).replace(/\[([^\]\n]{1,80})\]/g, '<span class="vb-ph">[$1]</span>');

const runsHtml = (runs) =>
  runs
    .map((r) => {
      let t = tx(r.text);
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      return t;
    })
    .join('');

export function renderDocumentHtml(doc) {
  const h = doc.header;
  const head = `
  <table class="vb-head" role="presentation"><tr>
    <td class="vb-head-left">
      ${h.parent ? `<div class="vb-parent">${tx(h.parent)}</div>` : ''}
      <div class="vb-org">${tx(h.org || ' ')}</div>
      <div class="vb-rule vb-rule-short"></div>
      <div class="vb-number">${tx(h.number)}</div>
      ${h.subject ? `<div class="vb-subject-cv">${tx(h.subject)}</div>` : ''}
    </td>
    <td class="vb-head-right">
      <div class="vb-qh">${QUOC_HIEU}</div>
      <div class="vb-tn">${TIEU_NGU}</div>
      <div class="vb-rule vb-rule-tn"></div>
      <div class="vb-date">${tx(h.placeDate)}</div>
    </td>
  </tr></table>`;

  const title = doc.title
    ? `<div class="vb-title">${tx(doc.title.name)}</div>
       ${doc.title.subject ? `<div class="vb-title-sub">${tx(doc.title.subject)}</div>` : ''}
       <div class="vb-rule vb-rule-title"></div>`
    : '';

  const authority = doc.authority ? `<div class="vb-authority">${tx(doc.authority)}</div>` : '';

  let recipients = '';
  if (doc.recipients?.length) {
    const cls = doc.recipientsInline ? 'vb-kg vb-kg-inline' : 'vb-kg';
    recipients =
      doc.recipients.length === 1
        ? `<div class="${cls}"><span>Kính gửi:</span> ${tx(doc.recipients[0].replace(/[.;]+$/, ''))}.</div>`
        : `<div class="${cls} vb-kg-multi"><span>Kính gửi:</span><div>${formatRecipients(doc.recipients)
            .map((r) => `<div>${tx(r)}</div>`)
            .join('')}</div></div>`;
  }

  const body = doc.body
    .map((p) => {
      const cls = ['vb-p', `al-${p.align || 'justify'}`, p.indent ? 'ind' : '', p.spaceBefore ? 'sb' : ''].filter(Boolean).join(' ');
      return `<p class="${cls}">${runsHtml(p.runs)}</p>`;
    })
    .join('');

  let sign = '';
  if (doc.sign) {
    sign = `
    <table class="vb-sign" role="presentation"><tr>
      <td class="vb-sign-left">
        <div class="vb-nn-label">Nơi nhận:</div>
        ${formatNoiNhan(doc.sign.noiNhan)
          .map((l) => `<div class="vb-nn">${tx(l)}</div>`)
          .join('')}
      </td>
      <td class="vb-sign-right">
        ${doc.sign.authority ? `<div class="vb-sign-auth">${tx(doc.sign.authority)}</div>` : ''}
        <div class="vb-sign-pos">${tx(doc.sign.position)}</div>
        <div class="vb-sign-space"><span class="vb-seal" aria-hidden="true"></span></div>
        <div class="vb-sign-name">${tx(doc.sign.name)}</div>
      </td>
    </tr></table>`;
  } else if (doc.dualSign) {
    const col = (c) => `<td class="vb-sign-right"><div class="vb-sign-pos">${tx(c.title)}</div><div class="vb-sign-hint">(Ký, ghi rõ họ tên)</div><div class="vb-sign-space"></div><div class="vb-sign-name">${tx(c.name.replace(/\s*-.*$/, '').replace(/^(Ông|Bà)\s+/i, ''))}</div></td>`;
    sign = `<table class="vb-sign" role="presentation"><tr>${col(doc.dualSign.left)}${col(doc.dualSign.right)}</tr></table>`;
  }

  return `<article class="vb-page" lang="vi">${head}${title}${authority}${recipients}<div class="vb-body">${body}</div>${sign}</article>`;
}
