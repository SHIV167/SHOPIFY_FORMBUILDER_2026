/**
 * JavaScript Widget — GET /api/widget/[id]
 * Returns a self-contained JavaScript file.
 * Usage on any Shopify page / section:
 *
 *   <div id="cf-form-FORM_ID"></div>
 *   <script src="https://your-app.com/api/widget/FORM_ID.js"></script>
 *
 * No shop domain needed. The form is identified purely by its ID.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // strip optional .js suffix so both /widget/ID and /widget/ID.js work
  const id = params.id.replace(/\.js$/, "");
  const appHost = process.env.NEXT_PUBLIC_HOST || process.env.HOST || "";

  try {
    const form = await prisma.contactForm.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        shop: { select: { shopifyDomain: true } },
      },
    });

    const notFound = `console.error('[CF Widget] Form "${id}" not found or not published.');`;

    if (!form || !form.isActive || !form.isPublished)
      return jsResponse(notFound);

    // Build a safe JSON blob with only public fields
    const formData = JSON.stringify({
      id: form.id,
      title: form.title,
      description: form.description || "",
      successMessage: form.successMessage,
      submitButtonText: form.submitButtonText,
      primaryColor: form.primaryColor,
      bgColor: form.bgColor,
      formStyle: form.formStyle,
      enableHoneypot: form.enableHoneypot,
      shopDomain: form.shop.shopifyDomain,
      fields: form.fields
        .filter((f: (typeof form.fields)[number]) => f.fieldType !== "hidden")
        .map((f: (typeof form.fields)[number]) => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          placeholder: f.placeholder || "",
          helpText: f.helpText || "",
          required: f.required,
          options: f.options,
          defaultValue: f.defaultValue || "",
          width: f.width,
        })),
    });

    const js = buildWidgetJs(id, appHost, formData);
    return jsResponse(js);
  } catch (err) {
    console.error("[widget]", err);
    return jsResponse(`console.error('[CF Widget] Failed to load form.');`);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function jsResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

function buildWidgetJs(
  formId: string,
  apiHost: string,
  formDataJson: string,
): string {
  return `
/* ─────────────────────────────────────────────────────────────
   SK Contact Form Builder — Inline Widget
   Form ID: ${formId}
   Generated: ${new Date().toISOString()}
───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var FORM = ${formDataJson};
  var API  = '${apiHost}' || (window.location.protocol + '//' + window.location.host);
  var CID  = 'cf-form-' + FORM.id;

  /* ── find container ── */
  var container = document.getElementById(CID);
  if (!container) {
    /* fallback: wrap the <script> tag itself */
    var scripts = document.querySelectorAll('script[src*="${formId}"]');
    var tag = scripts[scripts.length - 1];
    if (tag) {
      container = document.createElement('div');
      container.id = CID;
      tag.parentNode.insertBefore(container, tag.nextSibling);
    }
  }
  if (!container) { console.error('[CF Widget] No container found. Add <div id="' + CID + '"></div> before the script tag.'); return; }

  /* ── inject scoped CSS ── */
  var css = [
    '#' + CID + ' { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; box-sizing: border-box; max-width: 600px; margin: 0 auto; }',
    '#' + CID + ' *, #' + CID + ' *::before, #' + CID + ' *::after { box-sizing: inherit; }',
    '#' + CID + ' .cf-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 8px; text-align: center; }',
    '#' + CID + ' .cf-desc  { font-size: 0.95rem; color: #6b7280; margin: 0 0 24px; text-align: center; line-height: 1.5; }',
    '#' + CID + ' .cf-field { margin-bottom: 20px; }',
    '#' + CID + ' .cf-label { display: block; font-size: 0.9rem; font-weight: 600; color: #374151; margin-bottom: 8px; }',
    '#' + CID + ' .cf-label .cf-req { color: #ef4444; margin-left: 2px; }',
    '#' + CID + ' .cf-input, #' + CID + ' .cf-select, #' + CID + ' .cf-textarea {',
    '  width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 12px;',
    '  font-size: 1rem; outline: none; transition: all .2s ease;',
    '  background: #fff; color: #111827; line-height: 1.5; }',
    '#' + CID + ' .cf-input:focus, #' + CID + ' .cf-select:focus, #' + CID + ' .cf-textarea:focus {',
    '  border-color: ' + FORM.primaryColor + '; box-shadow: 0 0 0 4px ' + hexToRgba(FORM.primaryColor, 0.1) + '; transform: translateY(-1px); }',
    '#' + CID + ' .cf-input.cf-err, #' + CID + ' .cf-select.cf-err, #' + CID + ' .cf-textarea.cf-err {',
    '  border-color: #ef4444; background: #fef2f2; }',
    '#' + CID + ' .cf-textarea { resize: vertical; min-height: 120px; }',
    '#' + CID + ' .cf-errmsg { font-size: 0.85rem; color: #ef4444; margin-top: 6px; font-weight: 500; }',
    '#' + CID + ' .cf-help  { font-size: 0.85rem; color: #6b7280; margin-top: 6px; line-height: 1.4; }',
    '#' + CID + ' .cf-radio-group, #' + CID + ' .cf-checkbox-group { display: flex; flex-direction: column; gap: 12px; }',
    '#' + CID + ' .cf-option { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; cursor: pointer; padding: 8px; border-radius: 8px; transition: background .15s; }',
    '#' + CID + ' .cf-option:hover { background: #f9fafb; }',
    '#' + CID + ' .cf-option input[type="radio"], #' + CID + ' .cf-option input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: ' + FORM.primaryColor + '; }',
    '#' + CID + ' .cf-submit {',
    '  width: 100%; padding: 14px 24px; background: ' + FORM.primaryColor + '; color: #fff;',
    '  font-size: 1rem; font-weight: 600; border: none; border-radius: 12px; cursor: pointer;',
    '  transition: all .2s ease; margin-top: 16px; box-shadow: 0 4px 6px -1px ' + hexToRgba(FORM.primaryColor, 0.2) + '; }',
    '#' + CID + ' .cf-submit:hover { transform: translateY(-2px); box-shadow: 0 6px 12px -2px ' + hexToRgba(FORM.primaryColor, 0.3) + '; }',
    '#' + CID + ' .cf-submit:active { transform: translateY(0); }',
    '#' + CID + ' .cf-submit:disabled { opacity: .5; cursor: not-allowed; transform: none; }',
    '#' + CID + ' .cf-success { text-align: center; padding: 48px 24px; }',
    '#' + CID + ' .cf-success .cf-tick { font-size: 4rem; margin-bottom: 16px; animation: bounce 0.5s ease; }',
    '@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }',
    '#' + CID + ' .cf-success p { font-size: 1.1rem; color: #111827; font-weight: 600; line-height: 1.6; }',
    '#' + CID + ' .cf-success a { font-size: 0.9rem; color: ' + FORM.primaryColor + '; text-decoration: underline; cursor: pointer; font-weight: 500; }',
    '#' + CID + ' .cf-alert { padding: 14px 18px; border-radius: 12px; font-size: 0.95rem; margin-top: 16px;',
    '  background: #fef2f2; border: 2px solid #fecaca; color: #dc2626; font-weight: 500; }',
  ].join('\\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── render ── */
  render();

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fieldHtml(f) {
    var id = 'cf-f-' + f.id;
    var req = f.required ? '<span class="cf-req">*</span>' : '';
    var labelHtml = f.fieldType !== 'checkbox' ? '<label class="cf-label" for="' + id + '">' + esc(f.label) + req + '</label>' : '';
    var help = f.helpText ? '<p class="cf-help">' + esc(f.helpText) + '</p>' : '';
    var errSpan = '<span class="cf-errmsg" id="' + id + '-err"></span>';
    var ph = esc(f.placeholder);
    var inner = '';

    switch (f.fieldType) {
      case 'textarea':
        inner = '<textarea class="cf-textarea" id="' + id + '" name="' + esc(f.label) + '" placeholder="' + ph + '"' + (f.required ? ' required' : '') + '>' + esc(f.defaultValue) + '</textarea>';
        break;
      case 'select':
        inner = '<select class="cf-select" id="' + id + '" name="' + esc(f.label) + '"' + (f.required ? ' required' : '') + '>';
        inner += '<option value="">Select…</option>';
        f.options.forEach(function(o) { inner += '<option value="' + esc(o) + '">' + esc(o) + '</option>'; });
        inner += '</select>';
        break;
      case 'radio':
        inner = '<div class="cf-radio-group">';
        f.options.forEach(function(o) {
          inner += '<label class="cf-option"><input type="radio" name="' + esc(f.label) + '" value="' + esc(o) + '"' + (f.required ? ' required' : '') + '> ' + esc(o) + '</label>';
        });
        inner += '</div>';
        break;
      case 'checkbox':
        if (f.options.length > 0) {
          inner = '<div class="cf-checkbox-group">';
          f.options.forEach(function(o) {
            inner += '<label class="cf-option"><input type="checkbox" name="' + esc(f.label) + '" value="' + esc(o) + '"> ' + esc(o) + '</label>';
          });
          inner += '</div>';
        } else {
          inner = '<label class="cf-option cf-label"><input type="checkbox" id="' + id + '" name="' + esc(f.label) + '" value="true"' + (f.required ? ' required' : '') + '> ' + esc(f.placeholder || f.label) + '</label>';
          labelHtml = '';
        }
        break;
      case 'date':
        inner = '<input type="date" class="cf-input" id="' + id + '" name="' + esc(f.label) + '"' + (f.required ? ' required' : '') + ' value="' + esc(f.defaultValue) + '">';
        break;
      case 'number':
        inner = '<input type="number" class="cf-input" id="' + id + '" name="' + esc(f.label) + '" placeholder="' + ph + '"' + (f.required ? ' required' : '') + ' value="' + esc(f.defaultValue) + '">';
        break;
      case 'email':
        inner = '<input type="email" class="cf-input" id="' + id + '" name="' + esc(f.label) + '" placeholder="' + (ph || 'you@example.com') + '"' + (f.required ? ' required' : '') + ' value="' + esc(f.defaultValue) + '">';
        break;
      case 'phone':
        inner = '<input type="tel" class="cf-input" id="' + id + '" name="' + esc(f.label) + '" placeholder="' + (ph || '+91 XXXXX XXXXX') + '"' + (f.required ? ' required' : '') + ' value="' + esc(f.defaultValue) + '">';
        break;
      default:
        inner = '<input type="text" class="cf-input" id="' + id + '" name="' + esc(f.label) + '" placeholder="' + ph + '"' + (f.required ? ' required' : '') + ' value="' + esc(f.defaultValue) + '">';
    }
    return '<div class="cf-field">' + labelHtml + inner + help + errSpan + '</div>';
  }

  function render() {
    var hp = FORM.enableHoneypot ? '<input type="text" name="__hp" style="display:none" tabindex="-1" autocomplete="off">' : '';
    var fields = FORM.fields.map(fieldHtml).join('');
    var desc = FORM.description ? '<p class="cf-desc">' + esc(FORM.description) + '</p>' : '';
    var style = FORM.bgColor && FORM.bgColor !== '#ffffff' ? 'style="background:' + FORM.bgColor + ';padding:16px;border-radius:12px;"' : '';
    container.innerHTML =
      '<div ' + style + '>' +
        '<h2 class="cf-title">' + esc(FORM.title) + '</h2>' +
        desc +
        '<form id="' + CID + '-form">' +
          hp +
          fields +
          '<div class="cf-alert" id="' + CID + '-err" style="display:none"></div>' +
          '<button type="submit" class="cf-submit" id="' + CID + '-btn">' + esc(FORM.submitButtonText) + '</button>' +
        '</form>' +
      '</div>';

    document.getElementById(CID + '-form').addEventListener('submit', handleSubmit);
  }

  function validate() {
    var valid = true;
    FORM.fields.forEach(function(f) {
      var id = 'cf-f-' + f.id;
      var errEl = document.getElementById(id + '-err');
      if (!errEl) return;
      errEl.textContent = '';

      var inputs = document.querySelectorAll('#' + CID + '-form [name="' + CSS.escape(f.label) + '"]');
      var value = '';
      if (f.fieldType === 'checkbox' && f.options.length > 0) {
        var checked = [];
        inputs.forEach(function(cb) { if (cb.checked) checked.push(cb.value); });
        value = checked.join(',');
      } else if (f.fieldType === 'radio') {
        inputs.forEach(function(rb) { if (rb.checked) value = rb.value; });
      } else if (inputs[0]) {
        value = (inputs[0].value || '').trim();
      }

      if (f.required && !value) { errEl.textContent = f.label + ' is required'; valid = false; }
      else if (f.fieldType === 'email' && value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
        errEl.textContent = 'Please enter a valid email'; valid = false;
      }

      var inputEl = document.getElementById(id);
      if (inputEl) { inputEl.classList.toggle('cf-err', !!errEl.textContent); }
    });
    return valid;
  }

  function collectData() {
    var data = {};
    FORM.fields.forEach(function(f) {
      var inputs = document.querySelectorAll('#' + CID + '-form [name="' + CSS.escape(f.label) + '"]');
      if (f.fieldType === 'checkbox' && f.options.length > 0) {
        var checked = [];
        inputs.forEach(function(cb) { if (cb.checked) checked.push(cb.value); });
        data[f.label] = checked.join(',');
      } else if (f.fieldType === 'radio') {
        inputs.forEach(function(rb) { if (rb.checked) data[f.label] = rb.value; });
      } else if (inputs[0]) {
        data[f.label] = inputs[0].value;
      }
    });
    if (FORM.enableHoneypot) data['__hp'] = '';
    return data;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    var btn = document.getElementById(CID + '-btn');
    var errBox = document.getElementById(CID + '-err');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    errBox.style.display = 'none';

    var payload = {
      shopDomain: FORM.shopDomain,
      formId: FORM.id,
      data: collectData(),
      pageUrl: window.location.href,
      referrer: document.referrer || '',
    };

    fetch(API + '/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok) {
        errBox.textContent = res.data.error || 'Submission failed. Please try again.';
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = FORM.submitButtonText;
        return;
      }
      /* success */
      container.innerHTML =
        '<div class="cf-success">' +
          '<div class="cf-tick">✅</div>' +
          '<p>' + esc(FORM.successMessage) + '</p>' +
          '<a id="' + CID + '-reset">Submit another response</a>' +
        '</div>';
      document.getElementById(CID + '-reset').addEventListener('click', function() { render(); });
    })
    .catch(function() {
      errBox.textContent = 'Network error. Please try again.';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = FORM.submitButtonText;
    });
  }

})();
/* end CF widget ${formId} */
`.trim();
}
