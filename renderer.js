// Login and dashboard logic
const { ipcRenderer } = require('electron');
const API_URL = 'https://wellpro-backend.onrender.com';

let currentToken = null;
let itemsCache = [];      // all items stored here (used for dropdowns)
let billCart = [];        // current sales bill being created
let purchaseCart = [];    // current purchase being created

// ============ LOGIN ============

window.addEventListener('DOMContentLoaded', () => {
  const savedLicenseKey = localStorage.getItem('wellpro_license_key');
  if (savedLicenseKey) {
    document.getElementById('licenseKeyRow').style.display = 'none';
    document.getElementById('changeLicenseLink').style.display = 'block';
  }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const savedLicenseKey = localStorage.getItem('wellpro_license_key');
  const licenseKey = savedLicenseKey || document.getElementById('licenseKey').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');

  errorDiv.textContent = '';

  if (!licenseKey || !username || !password) {
    errorDiv.textContent = 'Please fill in all fields.';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      errorDiv.textContent = data.error || 'Login failed.';
      return;
    }

    localStorage.setItem('wellpro_license_key', licenseKey);
    currentToken = data.token;
    document.getElementById('welcomeText').textContent = `WellPro ERP — ${data.user.full_name}`;

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'block';

    loadItems();
    loadSuppliers();
  } catch (err) {
    errorDiv.textContent = 'Could not connect to server. Check your internet connection.';
    console.error(err);
  }
});

document.getElementById('changeLicenseLink').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('wellpro_license_key');
  document.getElementById('licenseKeyRow').style.display = 'block';
  document.getElementById('changeLicenseLink').style.display = 'none';
  document.getElementById('licenseKey').value = '';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentToken = null;
  document.getElementById('dashboardScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
});

// ============ TAB NAVIGATION ============

function switchToTab(pageId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetBtn = document.querySelector(`.tab-btn[data-page="${pageId}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.add('active');

  if (pageId === 'dashboardPage') {
    loadDashboard();
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchToTab(btn.dataset.page));
});

// "Open in New Window" buttons - asks the main process to open a fresh window
// focused on that specific page
document.querySelectorAll('.new-window-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ipcRenderer.send('open-window', btn.dataset.page);
  });
});

// If this window was opened with a specific page requested (via hash), jump to it
window.addEventListener('DOMContentLoaded', () => {
  const requestedPage = window.location.hash.replace('#', '');
  if (requestedPage) {
    switchToTab(requestedPage);
  }
});

// ============ DASHBOARD ============

async function loadDashboard() {
  loadLowStock();
  loadExpiringSoon();
  loadRecentSales();
}

async function loadLowStock() {
  try {
    const response = await fetch(`${API_URL}/api/inventory/low-stock`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const items = await response.json();
    const tbody = document.getElementById('lowStockBody');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No low stock items. All good!</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.total_stock}</td>
        <td>${item.reorder_level}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load low stock items:', err);
  }
}

async function loadExpiringSoon() {
  try {
    const response = await fetch(`${API_URL}/api/inventory/expiring-soon`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const batches = await response.json();
    const tbody = document.getElementById('expiringSoonBody');

    if (batches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">Nothing expiring soon.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    batches.forEach(batch => {
      const expiry = new Date(batch.expiry_date).toLocaleDateString('en-IN');
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${batch.item_name}</td>
        <td>${batch.batch_no}</td>
        <td>${expiry}</td>
        <td>${batch.quantity_available}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load expiring items:', err);
  }
}

async function loadRecentSales() {
  try {
    const response = await fetch(`${API_URL}/api/sales`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const sales = await response.json();
    const tbody = document.getElementById('recentSalesBody');

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No sales yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    sales.forEach(sale => {
      const date = new Date(sale.invoice_date).toLocaleString('en-IN');
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sale.invoice_no}</td>
        <td>${date}</td>
        <td>${sale.payment_mode}</td>
        <td>₹${sale.total_amount}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load recent sales:', err);
  }
}

// ============ ITEMS (INVENTORY) ============

async function loadItems() {
  try {
    const response = await fetch(`${API_URL}/api/items`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const items = await response.json();
    itemsCache = items;

    // Inventory table
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No items found.</td></tr>';
    } else {
      items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.name}</td>
          <td>${item.generic_name || '-'}</td>
          <td>${item.manufacturer || '-'}</td>
          <td>${item.unit}</td>
          <td>${item.gst_percent}%</td>
        `;
        tbody.appendChild(row);
      });
    }

    // Billing item dropdown
    const billSelect = document.getElementById('billItemSelect');
    billSelect.innerHTML = '<option value="">Select Item</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      billSelect.appendChild(opt);
    });

    // Purchase item dropdown
    const purchaseSelect = document.getElementById('purchaseItemSelect');
    purchaseSelect.innerHTML = '<option value="">Select Item</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      purchaseSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

document.getElementById('addItemBtn').addEventListener('click', async () => {
  const name = document.getElementById('newItemName').value;
  const generic_name = document.getElementById('newItemGeneric').value;
  const manufacturer = document.getElementById('newItemManufacturer').value;
  const unit = document.getElementById('newItemUnit').value;
  const gst_percent = document.getElementById('newItemGst').value;
  const msgDiv = document.getElementById('addItemMsg');

  msgDiv.textContent = '';
  msgDiv.className = '';

  if (!name) {
    msgDiv.textContent = 'Item name is required.';
    msgDiv.className = 'error';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
      body: JSON.stringify({ name, generic_name, manufacturer, unit, gst_percent })
    });
    const data = await response.json();

    if (!response.ok) {
      msgDiv.textContent = data.error || 'Failed to add item.';
      msgDiv.className = 'error';
      return;
    }

    msgDiv.textContent = `"${data.name}" added successfully!`;
    msgDiv.className = 'success';

    document.getElementById('newItemName').value = '';
    document.getElementById('newItemGeneric').value = '';
    document.getElementById('newItemManufacturer').value = '';
    document.getElementById('newItemGst').value = '12';

    loadItems();
  } catch (err) {
    msgDiv.textContent = 'Could not connect to server.';
    msgDiv.className = 'error';
    console.error(err);
  }
});

// ============ BILLING ============

document.getElementById('billItemSelect').addEventListener('change', async () => {
  const itemId = document.getElementById('billItemSelect').value;
  const batchSelect = document.getElementById('billBatchSelect');
  batchSelect.innerHTML = '<option value="">Select Batch</option>';

  if (!itemId) return;

  try {
    const response = await fetch(`${API_URL}/api/items/${itemId}/batches`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const batches = await response.json();

    if (batches.length === 0) {
      batchSelect.innerHTML = '<option value="">No stock available</option>';
      return;
    }

    batches.forEach(batch => {
      const opt = document.createElement('option');
      opt.value = batch.id;
      opt.dataset.rate = batch.sale_rate;
      opt.dataset.stock = batch.quantity_available;
      const expiry = new Date(batch.expiry_date).toLocaleDateString('en-IN');
      opt.textContent = `${batch.batch_no} | Stock: ${batch.quantity_available} | Exp: ${expiry} | ₹${batch.sale_rate}`;
      batchSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load batches:', err);
  }
});

document.getElementById('addToBillBtn').addEventListener('click', () => {
  const itemSelect = document.getElementById('billItemSelect');
  const batchSelect = document.getElementById('billBatchSelect');
  const quantity = parseInt(document.getElementById('billQuantity').value);
  const msgDiv = document.getElementById('billMsg');

  msgDiv.textContent = '';
  msgDiv.className = '';

  const itemId = itemSelect.value;
  const batchId = batchSelect.value;
  const batchOption = batchSelect.options[batchSelect.selectedIndex];

  if (!itemId || !batchId || !quantity || quantity < 1) {
    msgDiv.textContent = 'Select item, batch, and enter a valid quantity.';
    msgDiv.className = 'error';
    return;
  }

  const stockAvailable = parseInt(batchOption.dataset.stock);
  if (quantity > stockAvailable) {
    msgDiv.textContent = `Only ${stockAvailable} in stock.`;
    msgDiv.className = 'error';
    return;
  }

  const item = itemsCache.find(i => i.id === itemId);
  const rate = parseFloat(batchOption.dataset.rate);

  billCart.push({
    item_id: itemId,
    item_name: item.name,
    batch_id: batchId,
    batch_label: batchOption.textContent,
    quantity: quantity,
    rate: rate,
    gst_percent: parseFloat(item.gst_percent)
  });

  renderBillCart();

  document.getElementById('billQuantity').value = '';
  itemSelect.value = '';
  batchSelect.innerHTML = '<option value="">Select Batch</option>';
});

function renderBillCart() {
  const tbody = document.getElementById('billCartBody');

  if (billCart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No items added yet.</td></tr>';
  } else {
    tbody.innerHTML = '';
    billCart.forEach((line, index) => {
      const amount = line.rate * line.quantity;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${line.item_name}</td>
        <td>${line.batch_label}</td>
        <td>${line.quantity}</td>
        <td>₹${line.rate}</td>
        <td>₹${amount.toFixed(2)}</td>
        <td><button class="btn-danger" data-index="${index}">Remove</button></td>
      `;
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', () => {
        billCart.splice(parseInt(btn.dataset.index), 1);
        renderBillCart();
      });
    });
  }

  let subtotal = 0;
  let gst = 0;
  billCart.forEach(line => {
    const amount = line.rate * line.quantity;
    subtotal += amount;
    gst += amount * (line.gst_percent / 100);
  });
  const total = subtotal + gst;

  document.getElementById('billSubtotal').textContent = subtotal.toFixed(2);
  document.getElementById('billGst').textContent = gst.toFixed(2);
  document.getElementById('billTotal').textContent = total.toFixed(2);
}

document.getElementById('completeBillBtn').addEventListener('click', async () => {
  const msgDiv = document.getElementById('billMsg');
  msgDiv.textContent = '';
  msgDiv.className = '';

  if (billCart.length === 0) {
    msgDiv.textContent = 'Add at least one item to the bill.';
    msgDiv.className = 'error';
    return;
  }

  const paymentMode = document.getElementById('billPaymentMode').value;

  const items = billCart.map(line => ({
    item_id: line.item_id,
    batch_id: line.batch_id,
    quantity: line.quantity,
    rate: line.rate,
    gst_percent: line.gst_percent
  }));

  try {
    const response = await fetch(`${API_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
      body: JSON.stringify({ payment_mode: paymentMode, items })
    });
    const data = await response.json();

    if (!response.ok) {
      msgDiv.textContent = data.error || 'Billing failed.';
      msgDiv.className = 'error';
      return;
    }

    msgDiv.textContent = `Bill created! Invoice: ${data.invoice_no} | Total: ₹${data.total_amount}`;
    msgDiv.className = 'success';

    billCart = [];
    renderBillCart();
  } catch (err) {
    msgDiv.textContent = 'Could not connect to server.';
    msgDiv.className = 'error';
    console.error(err);
  }
});

// ============ SUPPLIERS ============

async function loadSuppliers() {
  try {
    const response = await fetch(`${API_URL}/api/suppliers`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const suppliers = await response.json();

    const select = document.getElementById('purchaseSupplierSelect');
    select.innerHTML = '<option value="">Select Supplier</option>';
    suppliers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }
}

document.getElementById('addSupplierBtn').addEventListener('click', async () => {
  const name = document.getElementById('newSupplierName').value;
  const phone = document.getElementById('newSupplierPhone').value;
  const msgDiv = document.getElementById('supplierMsg');

  msgDiv.textContent = '';
  msgDiv.className = '';

  if (!name) {
    msgDiv.textContent = 'Supplier name is required.';
    msgDiv.className = 'error';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
      body: JSON.stringify({ name, phone })
    });
    const data = await response.json();

    if (!response.ok) {
      msgDiv.textContent = data.error || 'Failed to add supplier.';
      msgDiv.className = 'error';
      return;
    }

    msgDiv.textContent = `"${data.name}" added successfully!`;
    msgDiv.className = 'success';

    document.getElementById('newSupplierName').value = '';
    document.getElementById('newSupplierPhone').value = '';

    loadSuppliers();
  } catch (err) {
    msgDiv.textContent = 'Could not connect to server.';
    msgDiv.className = 'error';
    console.error(err);
  }
});

// ============ PURCHASE (STOCK IN) ============

document.getElementById('addToPurchaseBtn').addEventListener('click', () => {
  const itemSelect = document.getElementById('purchaseItemSelect');
  const batchNo = document.getElementById('purchaseBatchNo').value;
  const expiry = document.getElementById('purchaseExpiry').value;
  const mrp = parseFloat(document.getElementById('purchaseMrp').value);
  const purchaseRate = parseFloat(document.getElementById('purchaseRate').value);
  const saleRate = parseFloat(document.getElementById('purchaseSaleRate').value);
  const quantity = parseInt(document.getElementById('purchaseQty').value);
  const msgDiv = document.getElementById('purchaseMsg');

  msgDiv.textContent = '';
  msgDiv.className = '';

  const itemId = itemSelect.value;

  if (!itemId || !batchNo || !expiry || !mrp || !purchaseRate || !saleRate || !quantity || quantity < 1) {
    msgDiv.textContent = 'Please fill in all item fields.';
    msgDiv.className = 'error';
    return;
  }

  const item = itemsCache.find(i => i.id === itemId);

  purchaseCart.push({
    item_id: itemId,
    item_name: item.name,
    batch_no: batchNo,
    expiry_date: expiry,
    mrp: mrp,
    purchase_rate: purchaseRate,
    sale_rate: saleRate,
    quantity: quantity
  });

  renderPurchaseCart();

  // Reset item fields (keep supplier/invoice as is)
  itemSelect.value = '';
  document.getElementById('purchaseBatchNo').value = '';
  document.getElementById('purchaseExpiry').value = '';
  document.getElementById('purchaseMrp').value = '';
  document.getElementById('purchaseRate').value = '';
  document.getElementById('purchaseSaleRate').value = '';
  document.getElementById('purchaseQty').value = '';
});

function renderPurchaseCart() {
  const tbody = document.getElementById('purchaseCartBody');

  if (purchaseCart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No items added yet.</td></tr>';
  } else {
    tbody.innerHTML = '';
    purchaseCart.forEach((line, index) => {
      const amount = line.purchase_rate * line.quantity;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${line.item_name}</td>
        <td>${line.batch_no}</td>
        <td>${line.expiry_date}</td>
        <td>${line.quantity}</td>
        <td>₹${line.purchase_rate}</td>
        <td>₹${amount.toFixed(2)}</td>
        <td><button class="btn-danger" data-index="${index}">Remove</button></td>
      `;
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', () => {
        purchaseCart.splice(parseInt(btn.dataset.index), 1);
        renderPurchaseCart();
      });
    });
  }

  let total = 0;
  purchaseCart.forEach(line => {
    total += line.purchase_rate * line.quantity;
  });
  document.getElementById('purchaseTotal').textContent = total.toFixed(2);
}

document.getElementById('completePurchaseBtn').addEventListener('click', async () => {
  const msgDiv = document.getElementById('purchaseMsg');
  msgDiv.textContent = '';
  msgDiv.className = '';

  const supplierId = document.getElementById('purchaseSupplierSelect').value;
  const invoiceNo = document.getElementById('purchaseInvoiceNo').value;

  if (!supplierId) {
    msgDiv.textContent = 'Select a supplier.';
    msgDiv.className = 'error';
    return;
  }

  if (purchaseCart.length === 0) {
    msgDiv.textContent = 'Add at least one item to the purchase.';
    msgDiv.className = 'error';
    return;
  }

  const items = purchaseCart.map(line => ({
    item_id: line.item_id,
    batch_no: line.batch_no,
    expiry_date: line.expiry_date,
    mrp: line.mrp,
    purchase_rate: line.purchase_rate,
    sale_rate: line.sale_rate,
    quantity: line.quantity
  }));

  try {
    const response = await fetch(`${API_URL}/api/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
      body: JSON.stringify({ supplier_id: supplierId, invoice_no: invoiceNo, items })
    });
    const data = await response.json();

    if (!response.ok) {
      msgDiv.textContent = data.error || 'Purchase failed.';
      msgDiv.className = 'error';
      return;
    }

    msgDiv.textContent = `Purchase recorded! Total: ₹${data.total_amount}. Stock has been updated.`;
    msgDiv.className = 'success';

    purchaseCart = [];
    renderPurchaseCart();
    document.getElementById('purchaseInvoiceNo').value = '';
  } catch (err) {
    msgDiv.textContent = 'Could not connect to server.';
    msgDiv.className = 'error';
    console.error(err);
  }
});