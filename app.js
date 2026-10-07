const ADMIN_PIN_KEY = 'sugar-coat-admin-pin';
const ADMIN_SESSION_KEY = 'sugar-coat-admin-until';
const ADMIN_SESSION_MS = 30 * 60 * 1000;
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 5000;
const PAGE_SIZE = 20;

const form = document.getElementById('customer-form');
const formCard = form.closest('.card');
const thankYouCard = document.getElementById('thank-you-card');
const thankYouName = document.getElementById('thank-you-name');
const thankYouDetail = document.getElementById('thank-you-detail');
const entriesTableBody = document.getElementById('entries-table-body');
const entryCountEl = document.getElementById('entry-count');
const summaryCountEl = document.getElementById('summary-count');
const summaryAmountEl = document.getElementById('summary-amount');
const toast = document.getElementById('toast');
const modal = document.getElementById('entries-modal');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const deleteModal = document.getElementById('delete-modal');
const deleteMessageEl = document.getElementById('delete-message');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const notesInput = document.getElementById('notes');

const editNameInput = document.getElementById('edit-name');
const editPhoneInput = document.getElementById('edit-phone');
const editAmountInput = document.getElementById('edit-amount');
const editNotesInput = document.getElementById('edit-notes');

const hints = {
  name: document.getElementById('name-hint'),
  phone: document.getElementById('phone-hint'),
  amount: document.getElementById('amount-hint'),
};

const editHints = {
  name: document.getElementById('edit-name-hint'),
  phone: document.getElementById('edit-phone-hint'),
  amount: document.getElementById('edit-amount-hint'),
};

let editingCustomerId = null;
let deletingCustomerId = null;
let confirmMode = 'delete'; // 'delete' | 'clear-all'
let currentPage = 1;
let searchQuery = '';
let sortKey = 'createdAt';
let sortDir = 'desc';

const entriesSearchInput = document.getElementById('entries-search');
const filterCountEl = document.getElementById('filter-count');
const entriesTableHead = document.querySelector('.entries-table thead');

const paginationEl = document.getElementById('entries-pagination');
const pageInfoEl = document.getElementById('page-info');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const entriesTableWrap = document.getElementById('entries-table-wrap');
const adminLinksEl = document.getElementById('admin-links');
const logoFrameEl = document.getElementById('logo-frame');
const pinModal = document.getElementById('pin-modal');
const pinForm = document.getElementById('pin-form');
const pinInput = document.getElementById('pin-input');
const pinConfirmInput = document.getElementById('pin-confirm-input');
const pinConfirmWrap = document.getElementById('pin-confirm-wrap');
const pinMessageEl = document.getElementById('pin-message');
const pinHintEl = document.getElementById('pin-hint');
const pinModalTitle = document.getElementById('pin-modal-title');
const pinSubmitBtn = document.getElementById('pin-submit-btn');
const syncStatusEl = document.getElementById('sync-status');

let pinModalMode = 'verify'; // 'verify' | 'setup'
let appReady = false;
let pendingAdminAction = null;
let logoTapCount = 0;
let logoTapTimer = null;

async function hashPin(pin) {
  const data = new TextEncoder().encode(`sugar-coat-admin:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getStoredPinHash() {
  return localStorage.getItem(ADMIN_PIN_KEY);
}

function isAdminSessionActive() {
  const until = Number(sessionStorage.getItem(ADMIN_SESSION_KEY) || 0);
  return until > Date.now();
}

function unlockAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, String(Date.now() + ADMIN_SESSION_MS));
  adminLinksEl.hidden = false;
}

function lockAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  adminLinksEl.hidden = true;
  if (modal.open) modal.close();
  closeExportMenu();
}

function syncAdminUi() {
  adminLinksEl.hidden = !isAdminSessionActive();
}

function openPinModal(mode, message) {
  pinModalMode = mode;
  pinHintEl.hidden = true;
  pinInput.value = '';
  pinConfirmInput.value = '';
  pinInput.classList.remove('error');

  if (mode === 'setup') {
    pinModalTitle.textContent = 'Set Admin PIN';
    pinSubmitBtn.textContent = 'Save PIN';
    pinConfirmWrap.hidden = false;
    pinMessageEl.textContent =
      message || 'Create a 4-digit PIN. You will need it to view, export, or clear entries.';
  } else {
    pinModalTitle.textContent = 'Admin PIN';
    pinSubmitBtn.textContent = 'Unlock';
    pinConfirmWrap.hidden = true;
    pinMessageEl.textContent = message || 'Enter your 4-digit admin PIN.';
  }

  pinModal.showModal();
  pinInput.focus();
}

function closePinModal() {
  pinModal.close();
  pendingAdminAction = null;
}

function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

async function saveAdminPin(pin) {
  localStorage.setItem(ADMIN_PIN_KEY, await hashPin(pin));
}

async function verifyAdminPin(pin) {
  const stored = getStoredPinHash();
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

function requireAdmin(action) {
  if (isAdminSessionActive()) {
    action();
    return;
  }
  pendingAdminAction = action;
  if (!getStoredPinHash()) {
    openPinModal('setup');
    return;
  }
  openPinModal('verify');
}

function completeAdminUnlock() {
  unlockAdminSession();
  closePinModal();
  showToast('Admin unlocked for 30 minutes');
  if (pendingAdminAction) {
    const action = pendingAdminAction;
    pendingAdminAction = null;
    action();
  }
}

function registerLogoAdminGesture() {
  logoFrameEl.addEventListener('click', () => {
    logoTapCount += 1;
    clearTimeout(logoTapTimer);
    logoTapTimer = setTimeout(() => {
      logoTapCount = 0;
    }, 2500);

    if (logoTapCount < 5) return;
    logoTapCount = 0;

    if (isAdminSessionActive()) {
      showToast('Admin already unlocked');
      return;
    }

    pendingAdminAction = null;
    if (!getStoredPinHash()) {
      openPinModal('setup');
      return;
    }
    openPinModal('verify');
  });
}

function getCustomers() {
  return SugarCoatDb.getCustomers();
}

function setFormEnabled(enabled) {
  appReady = enabled;
  form.querySelectorAll('input, textarea, button[type="submit"]').forEach((el) => {
    el.disabled = !enabled;
  });
}

function updateSyncStatus(meta = {}) {
  if (!syncStatusEl) return;
  const { online = SugarCoatDb.isOnline(), ready = SugarCoatDb.isReady() } = meta;

  if (!SugarCoatDb.isConfigured()) {
    syncStatusEl.hidden = false;
    syncStatusEl.textContent = 'Setup required — add Firebase config';
    syncStatusEl.className = 'sync-status sync-status-error';
    return;
  }

  if (!ready) {
    syncStatusEl.hidden = false;
    syncStatusEl.textContent = 'Connecting…';
    syncStatusEl.className = 'sync-status sync-status-pending';
    return;
  }

  syncStatusEl.hidden = false;
  if (online) {
    syncStatusEl.textContent = 'Synced — shared across iPads';
    syncStatusEl.className = 'sync-status sync-status-ok';
  } else {
    syncStatusEl.textContent = 'Offline — saving locally, will sync';
    syncStatusEl.className = 'sync-status sync-status-offline';
  }
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatWhenCompact(isoString) {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const time = formatTime(isoString);
  return { date, time };
}

function formatAmount(amount) {
  return Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function toTitleCaseName(value) {
  return value
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeName(value) {
  return toTitleCaseName(value);
}

function validateName(name) {
  if (!name || name.replace(/\s/g, '').length < 2) {
    return { ok: false, message: 'Name must be at least 2 letters' };
  }
  if (!/^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/.test(name)) {
    return { ok: false, message: 'Name must contain letters only' };
  }
  return { ok: true };
}

function validatePhone(phone) {
  if (!/^\d{10}$/.test(phone)) {
    return { ok: false, message: 'Phone must be exactly 10 digits' };
  }
  if (!/^[6-9]/.test(phone)) {
    return { ok: false, message: 'Mobile number must start with 6, 7, 8, or 9' };
  }
  return { ok: true };
}

function sanitizeNotes(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function validateAmount(value) {
  const trimmed = value.trim();

  if (trimmed === '') {
    return { ok: true, value: 0 };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: 'Enter a valid amount (up to 2 decimal places)' };
  }

  const num = parseFloat(trimmed);

  if (num < MIN_AMOUNT) {
    return { ok: false, message: 'Amount cannot be negative' };
  }
  if (num > MAX_AMOUNT) {
    return { ok: false, message: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}` };
  }

  return { ok: true, value: num };
}

function setFieldError(input, hintEl, message) {
  input.classList.add('error');
  if (hintEl) {
    hintEl.textContent = message;
    hintEl.hidden = false;
  }
}

function clearFieldError(input, hintEl) {
  input.classList.remove('error');
  if (hintEl) {
    hintEl.hidden = true;
  }
}

function clearAllErrors() {
  clearFieldError(nameInput, hints.name);
  clearFieldError(phoneInput, hints.phone);
  clearFieldError(amountInput, hints.amount);
}

function clearEditErrors() {
  clearFieldError(editNameInput, editHints.name);
  clearFieldError(editPhoneInput, editHints.phone);
  clearFieldError(editAmountInput, editHints.amount);
}

function validateFields({ nameInputEl, phoneInputEl, amountInputEl, notesInputEl, hintMap }) {
  const name = sanitizeName(nameInputEl.value);
  nameInputEl.value = name;
  const phone = phoneInputEl.value.trim();
  const amountRaw = amountInputEl.value.trim();
  const notes = notesInputEl ? sanitizeNotes(notesInputEl.value) : '';

  const nameCheck = validateName(name);
  const phoneCheck = validatePhone(phone);
  const amountCheck = validateAmount(amountRaw);

  let hasError = false;

  if (!nameCheck.ok) {
    setFieldError(nameInputEl, hintMap.name, nameCheck.message);
    hasError = true;
  }
  if (!phoneCheck.ok) {
    setFieldError(phoneInputEl, hintMap.phone, phoneCheck.message);
    hasError = true;
  }
  if (!amountCheck.ok) {
    setFieldError(amountInputEl, hintMap.amount, amountCheck.message);
    hasError = true;
  }

  if (hasError) return null;

  return { name, phone, amount: amountCheck.value, notes };
}

function truncateNotes(notes, max = 40) {
  if (!notes) return '—';
  return notes.length > max ? `${notes.slice(0, max)}…` : notes;
}

const ICON_EDIT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

const ICON_DELETE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-.8 14H5.8L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateEntryCount() {
  entryCountEl.textContent = getCustomers().length;
}

function showThankYou(customer) {
  thankYouName.textContent = customer.name;
  if (customer.amount > 0) {
    thankYouDetail.textContent = `Purchase of ₹${formatAmount(customer.amount)} recorded successfully.`;
  } else {
    thankYouDetail.textContent = 'Your details have been saved for follow-up.';
  }
  formCard.hidden = true;
  thankYouCard.hidden = false;
  thankYouCard.classList.add('thank-you-visible');
}

function showForm() {
  thankYouCard.hidden = true;
  thankYouCard.classList.remove('thank-you-visible');
  formCard.hidden = false;
  form.reset();
  clearAllErrors();
  if (appReady) {
    form.querySelector('button[type="submit"]').disabled = false;
  }
  nameInput.focus();
}

function updateEntriesSummary(customers) {
  const total = customers.length;
  const totalAmount = customers.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  summaryCountEl.textContent = total.toLocaleString('en-IN');
  summaryAmountEl.textContent = `₹${formatAmount(totalAmount)}`;
}

function compareValues(a, b) {
  if (a < b) return sortDir === 'asc' ? -1 : 1;
  if (a > b) return sortDir === 'asc' ? 1 : -1;
  return 0;
}

function getFilteredSortedCustomers() {
  const query = searchQuery.trim().toLowerCase();
  let list = getCustomers();

  if (query) {
    list = list.filter((c) => {
      const amount = String(c.amount ?? 0);
      return (
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.notes || '').toLowerCase().includes(query) ||
        amount.includes(query)
      );
    });
  }

  list.sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return compareValues(a.name.toLowerCase(), b.name.toLowerCase());
      case 'phone':
        return compareValues(a.phone, b.phone);
      case 'amount':
        return compareValues(Number(a.amount) || 0, Number(b.amount) || 0);
      case 'notes':
        return compareValues((a.notes || '').toLowerCase(), (b.notes || '').toLowerCase());
      case 'createdAt':
      default:
        return compareValues(new Date(a.createdAt).getTime(), new Date(b.createdAt).getTime());
    }
  });

  return list;
}

function updateSortHeaders() {
  entriesTableHead.querySelectorAll('.sortable').forEach((th) => {
    const key = th.dataset.sort;
    const icon = th.querySelector('.sort-icon');
    const isActive = key === sortKey;

    th.setAttribute('aria-sort', isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    th.classList.toggle('sort-active', isActive);
    if (icon) {
      icon.textContent = isActive ? (sortDir === 'asc' ? '↑' : '↓') : '';
    }
  });
}

function resetEntriesView() {
  searchQuery = '';
  entriesSearchInput.value = '';
  sortKey = 'createdAt';
  sortDir = 'desc';
  updateSortHeaders();
}

function renderEntriesTable(page = currentPage) {
  const allCustomers = getCustomers();
  const filtered = getFilteredSortedCustomers();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  currentPage = Math.min(Math.max(1, page), totalPages);

  updateEntriesSummary(allCustomers);
  updateSortHeaders();

  if (searchQuery.trim()) {
    filterCountEl.hidden = false;
    filterCountEl.textContent = `${total} of ${allCustomers.length} shown`;
  } else {
    filterCountEl.hidden = true;
  }

  if (allCustomers.length === 0) {
    entriesTableBody.innerHTML =
      '<tr class="empty-row"><td colspan="7">No entries yet.</td></tr>';
    paginationEl.hidden = true;
    return;
  }

  if (total === 0) {
    entriesTableBody.innerHTML =
      '<tr class="empty-row"><td colspan="7">No matches found.</td></tr>';
    paginationEl.hidden = true;
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageCustomers = filtered.slice(start, start + PAGE_SIZE);

  entriesTableBody.innerHTML = pageCustomers
    .map((c, i) => {
      const when = formatWhenCompact(c.createdAt);
      return `
    <tr>
      <td class="col-num">${start + i + 1}</td>
      <td class="col-name">${escapeHtml(c.name)}</td>
      <td class="col-phone">${escapeHtml(c.phone)}</td>
      <td class="col-amt">${escapeHtml(formatAmount(c.amount ?? 0))}</td>
      <td class="col-when">${when.date} · ${when.time}</td>
      <td class="col-notes notes-cell" title="${escapeHtml(c.notes || '')}">${escapeHtml(truncateNotes(c.notes, 28))}</td>
      <td class="col-actions">
        <button type="button" class="btn-icon btn-edit" data-id="${escapeHtml(c.id)}" aria-label="Edit ${escapeHtml(c.name)}">${ICON_EDIT}</button>
        <button type="button" class="btn-icon btn-delete" data-id="${escapeHtml(c.id)}" aria-label="Delete ${escapeHtml(c.name)}">${ICON_DELETE}</button>
      </td>
    </tr>`;
    })
    .join('');

  if (total > PAGE_SIZE) {
    paginationEl.hidden = false;
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  } else {
    paginationEl.hidden = true;
  }

  entriesTableWrap.scrollTop = 0;
}

function openEditModal(customerId) {
  const customer = getCustomers().find((c) => c.id === customerId);
  if (!customer) {
    showToast('Entry not found');
    return;
  }

  editingCustomerId = customerId;
  editNameInput.value = customer.name;
  editPhoneInput.value = customer.phone;
  editAmountInput.value = String(customer.amount ?? 0);
  editNotesInput.value = customer.notes || '';
  clearEditErrors();
  editModal.showModal();
}

function closeEditModal() {
  editingCustomerId = null;
  editForm.reset();
  clearEditErrors();
  editModal.close();
}

function openConfirmModal(mode, message) {
  confirmMode = mode;
  deletingCustomerId = null;
  deleteMessageEl.textContent = message;

  if (mode === 'clear-all') {
    confirmModalTitle.textContent = 'Clear All Entries';
    deleteConfirmBtn.textContent = 'Clear All';
  } else {
    confirmModalTitle.textContent = 'Delete Entry';
    deleteConfirmBtn.textContent = 'Delete';
  }

  deleteModal.showModal();
}

function openDeleteModal(customerId) {
  const customer = getCustomers().find((c) => c.id === customerId);
  if (!customer) {
    showToast('Entry not found');
    return;
  }

  confirmMode = 'delete';
  deletingCustomerId = customerId;
  confirmModalTitle.textContent = 'Delete Entry';
  deleteConfirmBtn.textContent = 'Delete';
  deleteMessageEl.textContent = `Delete entry for ${customer.name} (₹${formatAmount(customer.amount)})? This cannot be undone.`;
  deleteModal.showModal();
}

function closeDeleteModal() {
  deletingCustomerId = null;
  confirmMode = 'delete';
  deleteModal.close();
}

async function deleteEntry(customerId) {
  try {
    await SugarCoatDb.deleteCustomer(customerId);
    updateEntryCount();
    renderEntriesTable(currentPage);
    closeDeleteModal();
    showToast('Entry deleted');
  } catch {
    showToast('Could not delete — try again');
  }
}

async function clearAllEntries() {
  try {
    await SugarCoatDb.clearAllCustomers();
    updateEntryCount();
    renderEntriesTable(1);
    closeDeleteModal();
    showToast('All entries cleared');
  } catch {
    showToast('Could not clear — try again');
  }
}

function getExportCustomers() {
  const customers = getFilteredSortedCustomers();
  if (customers.length === 0) {
    showToast('No entries to export');
    return null;
  }
  return customers;
}

function exportFileName(ext) {
  return `sugar-coat-customers-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function exportCSV() {
  const customers = getExportCustomers();
  if (!customers) return;

  const headers = ['Name', 'Phone', 'Amount (₹)', 'Notes', 'Date', 'Time'];
  const rows = customers.map((c) => [
    c.name,
    c.phone,
    c.amount ?? 0,
    c.notes || '',
    formatDate(c.createdAt),
    formatTime(c.createdAt),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName('csv');
  link.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded!');
}

function exportPDF() {
  const customers = getExportCustomers();
  if (!customers) return;

  const total = customers.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const dateStr = new Date().toISOString().slice(0, 10);

  if (window.jspdf?.jsPDF) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(61, 40, 38);
    doc.text('Sugar Coat Bakers — Customer Entries', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(138, 112, 104);
    doc.text(
      `Exported ${dateStr}  ·  ${customers.length} entries  ·  Total ₹${formatAmount(total)}`,
      14,
      20
    );

    doc.autoTable({
      startY: 26,
      head: [['#', 'Name', 'Phone', 'Amount (₹)', 'When', 'Notes']],
      body: customers.map((c, i) => {
        const when = formatWhenCompact(c.createdAt);
        return [
          i + 1,
          c.name,
          c.phone,
          formatAmount(c.amount ?? 0),
          `${when.date} · ${when.time}`,
          c.notes || '',
        ];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [61, 40, 38],
        lineColor: [235, 224, 214],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [184, 136, 107],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 246, 242] },
      columnStyles: {
        0: { cellWidth: 10 },
        3: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(exportFileName('pdf'));
    showToast('PDF downloaded!');
    return;
  }

  openPrintableExport(customers, total, dateStr);
}

function openPrintableExport(customers, total, dateStr) {
  const rows = customers
    .map((c, i) => {
      const when = formatWhenCompact(c.createdAt);
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td class="num">${escapeHtml(formatAmount(c.amount ?? 0))}</td>
        <td>${escapeHtml(`${when.date} · ${when.time}`)}</td>
        <td>${escapeHtml(c.notes || '')}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sugar Coat Bakers — Export</title>
<style>
  body { font-family: system-ui, sans-serif; color: #3d2826; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 12px; color: #8a7068; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ebe0d6; padding: 6px 8px; text-align: left; }
  th { background: #f5ebe4; }
  td.num { text-align: right; }
  tr:nth-child(even) { background: #faf6f2; }
</style></head><body>
  <h1>Sugar Coat Bakers — Customer Entries</h1>
  <p>Exported ${dateStr} · ${customers.length} entries · Total ₹${escapeHtml(formatAmount(total))}</p>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Amount (₹)</th><th>When</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    showToast('Allow pop-ups to export PDF');
    return;
  }
  win.document.write(html);
  win.document.close();
  showToast('Use Print → Save as PDF');
}

function closeExportMenu() {
  const exportMenu = document.getElementById('export-menu');
  const exportMenuBtn = document.getElementById('export-menu-btn');
  exportMenu.hidden = true;
  exportMenuBtn.setAttribute('aria-expanded', 'false');
}

function bindNameInput(input, hintEl) {
  input.addEventListener('input', (e) => {
    const cleaned = e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\s{2,}/g, ' ');
    if (e.target.value !== cleaned) {
      e.target.value = cleaned;
    }
    clearFieldError(input, hintEl);
  });
  input.addEventListener('blur', (e) => {
    e.target.value = sanitizeName(e.target.value);
  });
}

function bindPhoneInput(input, hintEl) {
  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    clearFieldError(input, hintEl);
  });
}

function bindAmountInput(input, hintEl) {
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^\d.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    if (parts.length === 2) {
      val = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    e.target.value = val;
    clearFieldError(input, hintEl);
  });
}

bindNameInput(nameInput, hints.name);
bindPhoneInput(phoneInput, hints.phone);
bindAmountInput(amountInput, hints.amount);

bindNameInput(editNameInput, editHints.name);
bindPhoneInput(editPhoneInput, editHints.phone);
bindAmountInput(editAmountInput, editHints.amount);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!appReady) {
    showToast('Still connecting — please wait');
    return;
  }
  clearAllErrors();

  const data = validateFields({
    nameInputEl: nameInput,
    phoneInputEl: phoneInput,
    amountInputEl: amountInput,
    notesInputEl: notesInput,
    hintMap: hints,
  });

  if (!data) {
    showToast('Please fix the highlighted fields');
    return;
  }

  const duplicate = SugarCoatDb.findByPhone(data.phone);
  if (duplicate) {
    setFieldError(
      phoneInput,
      hints.phone,
      `Already registered as ${duplicate.name}. Check saved entries.`
    );
    showToast('This phone number is already in the list');
    return;
  }

  const customer = {
    id: crypto.randomUUID(),
    name: data.name,
    phone: data.phone,
    amount: data.amount,
    notes: data.notes,
    createdAt: new Date().toISOString(),
  };

  const saveBtn = form.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  try {
    await SugarCoatDb.addCustomer(customer);
    updateEntryCount();
    showThankYou(customer);
  } catch {
    showToast('Could not save — check connection and try again');
    saveBtn.disabled = false;
  }
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!appReady) {
    showToast('Still connecting — please wait');
    return;
  }
  clearEditErrors();

  const data = validateFields({
    nameInputEl: editNameInput,
    phoneInputEl: editPhoneInput,
    amountInputEl: editAmountInput,
    notesInputEl: editNotesInput,
    hintMap: editHints,
  });

  if (!data) {
    showToast('Please fix the highlighted fields');
    return;
  }

  const existing = getCustomers().find((c) => c.id === editingCustomerId);
  if (!existing) {
    showToast('Entry not found');
    closeEditModal();
    return;
  }

  const duplicate = SugarCoatDb.findByPhone(data.phone, editingCustomerId);
  if (duplicate) {
    setFieldError(
      editPhoneInput,
      editHints.phone,
      `Phone used by ${duplicate.name}`
    );
    showToast('This phone number is already in the list');
    return;
  }

  try {
    await SugarCoatDb.updateCustomer(editingCustomerId, data);
    renderEntriesTable();
    closeEditModal();
    showToast('Entry updated successfully');
  } catch {
    showToast('Could not update — try again');
  }
});

entriesTableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.btn-edit');
  if (editBtn) {
    openEditModal(editBtn.dataset.id);
    return;
  }
  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    openDeleteModal(deleteBtn.dataset.id);
  }
});

document.getElementById('new-entry-btn').addEventListener('click', showForm);

document.getElementById('export-trigger').addEventListener('click', () => {
  requireAdmin(() => {
    resetEntriesView();
    renderEntriesTable(1);
    modal.showModal();
  });
});

entriesSearchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderEntriesTable(1);
});

entriesTableHead.addEventListener('click', (e) => {
  const th = e.target.closest('.sortable');
  if (!th) return;

  const key = th.dataset.sort;
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = key === 'createdAt' ? 'desc' : 'asc';
  }

  renderEntriesTable(1);
});

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) renderEntriesTable(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
  renderEntriesTable(currentPage + 1);
});

document.getElementById('modal-close').addEventListener('click', () => modal.close());

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);
document.getElementById('delete-cancel-btn').addEventListener('click', closeDeleteModal);
document.getElementById('delete-confirm-btn').addEventListener('click', () => {
  if (confirmMode === 'clear-all') {
    clearAllEntries();
    return;
  }
  if (deletingCustomerId) deleteEntry(deletingCustomerId);
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  requireAdmin(() => {
    const total = getCustomers().length;
    if (total === 0) {
      showToast('No entries to clear');
      return;
    }
    openConfirmModal(
      'clear-all',
      `Delete all ${total} entr${total === 1 ? 'y' : 'ies'}? This cannot be undone.`
    );
  });
});

document.getElementById('admin-lock-btn').addEventListener('click', () => {
  lockAdminSession();
  showToast('Admin locked');
});

pinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  pinHintEl.hidden = true;

  const pin = pinInput.value.trim();
  if (!isValidPin(pin)) {
    pinHintEl.textContent = 'PIN must be exactly 4 digits.';
    pinHintEl.hidden = false;
    return;
  }

  if (pinModalMode === 'setup') {
    const confirmPin = pinConfirmInput.value.trim();
    if (pin !== confirmPin) {
      pinHintEl.textContent = 'PINs do not match. Try again.';
      pinHintEl.hidden = false;
      return;
    }
    await saveAdminPin(pin);
    completeAdminUnlock();
    return;
  }

  const ok = await verifyAdminPin(pin);
  if (!ok) {
    pinHintEl.textContent = 'Incorrect PIN.';
    pinHintEl.hidden = false;
    pinInput.value = '';
    pinInput.focus();
    return;
  }

  completeAdminUnlock();
});

document.getElementById('pin-modal-close').addEventListener('click', closePinModal);
document.getElementById('pin-cancel-btn').addEventListener('click', closePinModal);
pinModal.addEventListener('click', (e) => {
  if (e.target === pinModal) closePinModal();
});

pinInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  pinHintEl.hidden = true;
});

pinConfirmInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  pinHintEl.hidden = true;
});

registerLogoAdminGesture();
syncAdminUi();
setFormEnabled(false);
updateSyncStatus({ ready: false, online: navigator.onLine });

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

const exportMenuBtn = document.getElementById('export-menu-btn');
const exportMenu = document.getElementById('export-menu');

exportMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = exportMenu.hidden;
  exportMenu.hidden = !willOpen;
  exportMenuBtn.setAttribute('aria-expanded', String(willOpen));
});

exportMenu.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('export-csv-btn').addEventListener('click', () => {
  closeExportMenu();
  exportCSV();
});

document.getElementById('export-pdf-btn').addEventListener('click', () => {
  closeExportMenu();
  exportPDF();
});

document.addEventListener('click', closeExportMenu);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

async function bootApp() {
  if (!SugarCoatDb.isConfigured()) {
    updateSyncStatus();
    showToast('Firebase not configured — see FIREBASE_SETUP.md');
    return;
  }

  try {
    SugarCoatDb.onCustomersUpdated(() => {
      updateEntryCount();
      updateSyncStatus();
      if (modal.open) renderEntriesTable(currentPage);
    });

    await SugarCoatDb.init();
    setFormEnabled(true);
    updateEntryCount();
    updateSyncStatus();
  } catch (err) {
    console.error(err);
    updateSyncStatus();
    showToast('Cloud sync failed — check Firebase setup');
  }
}

bootApp();
