// CampusTrade CU2 - Lógica del Portal Exclusivo del Vendedor
// Manejo de autenticación, catálogo propio y pedidos de campus

(function () {
  'use strict';

  let currentSeller = null;
  let activeTab = 'orders'; // 'orders' o 'products'

  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupEventListeners();
  });

  function initAuth() {
    currentSeller = window.CampusStore.getCurrentSeller();

    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const navControls = document.getElementById('nav-user-controls');

    if (currentSeller) {
      if (authSection) authSection.classList.add('hidden');
      if (dashboardSection) dashboardSection.classList.remove('hidden');
      if (navControls) navControls.classList.remove('hidden');
      renderDashboard();
    } else {
      if (authSection) authSection.classList.remove('hidden');
      if (dashboardSection) dashboardSection.classList.add('hidden');
      if (navControls) navControls.classList.add('hidden');
    }
  }

  function setupEventListeners() {
    // Pestañas de Login vs Registro
    const btnTabLogin = document.getElementById('tab-btn-login');
    const btnTabRegister = document.getElementById('tab-btn-register');
    const formLoginContainer = document.getElementById('form-login-container');
    const formRegisterContainer = document.getElementById('form-register-container');

    if (btnTabLogin && btnTabRegister) {
      btnTabLogin.addEventListener('click', () => {
        btnTabLogin.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-950 bg-amber-500 shadow';
        btnTabRegister.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white';
        formLoginContainer.classList.remove('hidden');
        formRegisterContainer.classList.add('hidden');
        hideAlert();
      });

      btnTabRegister.addEventListener('click', () => {
        btnTabRegister.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-950 bg-amber-500 shadow';
        btnTabLogin.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white';
        formRegisterContainer.classList.remove('hidden');
        formLoginContainer.classList.add('hidden');
        hideAlert();
      });
    }

    // Submit de Iniciar Sesión
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        const res = window.CampusStore.loginSeller(email, pass);
        if (res.success) {
          showAlert('¡Bienvenido a tu panel de ventas CU2!', 'success');
          setTimeout(() => {
            initAuth();
          }, 400);
        } else {
          showAlert(res.error, 'error');
        }
      });
    }

    // Submit de Registro
    const formRegister = document.getElementById('form-register');
    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const studentId = document.getElementById('reg-studentid').value;
        const whatsapp = document.getElementById('reg-whatsapp').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const faculty = document.getElementById('reg-faculty').value;
        const building = document.getElementById('reg-building').value;

        const res = window.CampusStore.registerSeller({
          name,
          studentId,
          email,
          password: pass,
          faculty,
          defaultBuilding: building,
          whatsapp
        });

        if (res.success) {
          showAlert('¡Cuenta de emprendedor creada exitosamente!', 'success');
          setTimeout(() => {
            initAuth();
          }, 600);
        } else {
          showAlert(res.error, 'error');
        }
      });
    }

    // Cerrar Sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('¿Deseas cerrar tu sesión de vendedor?')) {
          window.CampusStore.logoutSeller();
          initAuth();
        }
      });
    }

    // Guardar Ubicación en Vivo
    const btnSaveLocation = document.getElementById('btn-save-location');
    if (btnSaveLocation) {
      btnSaveLocation.addEventListener('click', () => {
        if (!currentSeller) return;
        const buildingId = document.getElementById('dash-location-building').value;
        const locationText = document.getElementById('dash-location-text').value;
        const availableUntil = document.getElementById('dash-location-time').value;

        window.CampusStore.updateSellerLocation(currentSeller.id, {
          buildingId,
          locationText,
          availableUntil
        });

        // Actualizar sesión local
        currentSeller = window.CampusStore.getCurrentSeller();
        showNotificationToast('Ubicación de entrega en vivo actualizada para tus clientes', 'success');
      });
    }

    // Pestañas Dashboard: Pedidos vs Productos
    const tabOrders = document.getElementById('dash-tab-orders');
    const tabProducts = document.getElementById('dash-tab-products');
    const viewOrders = document.getElementById('dash-view-orders');
    const viewProducts = document.getElementById('dash-view-products');

    if (tabOrders && tabProducts) {
      tabOrders.addEventListener('click', () => {
        activeTab = 'orders';
        tabOrders.className = 'px-4 py-2 rounded-xl text-xs font-bold text-amber-400 bg-slate-800 border border-slate-700 transition flex items-center gap-1.5';
        tabProducts.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5';
        viewOrders.classList.remove('hidden');
        viewProducts.classList.add('hidden');
      });

      tabProducts.addEventListener('click', () => {
        activeTab = 'products';
        tabProducts.className = 'px-4 py-2 rounded-xl text-xs font-bold text-amber-400 bg-slate-800 border border-slate-700 transition flex items-center gap-1.5';
        tabOrders.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5';
        viewProducts.classList.remove('hidden');
        viewOrders.classList.add('hidden');
      });
    }

    // Modales de Producto
    const btnOpenModal = document.getElementById('btn-open-add-product-modal');
    const btnEmptyAdd = document.getElementById('btn-empty-add-product');
    const btnCloseModal = document.getElementById('btn-close-product-modal');
    const btnCancelModal = document.getElementById('btn-cancel-product-modal');
    const modalProduct = document.getElementById('modal-add-product');

    function openProductModal() {
      if (modalProduct) modalProduct.classList.remove('hidden');
    }

    function closeProductModal() {
      if (modalProduct) modalProduct.classList.add('hidden');
      document.getElementById('form-modal-product')?.reset();
    }

    if (btnOpenModal) btnOpenModal.addEventListener('click', openProductModal);
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openProductModal);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeProductModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeProductModal);

    // Formulario de Agregar Producto
    const formProduct = document.getElementById('form-modal-product');
    if (formProduct) {
      formProduct.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentSeller) return;

        const name = document.getElementById('prod-name').value;
        const category = document.getElementById('prod-category').value;
        const price = document.getElementById('prod-price').value;
        const unit = document.getElementById('prod-unit').value;
        const stock = document.getElementById('prod-stock').value;
        const image = document.getElementById('prod-image').value;
        const description = document.getElementById('prod-description').value;
        const tags = document.getElementById('prod-tags').value.split(',');

        const res = window.CampusStore.createProduct(currentSeller.id, {
          name,
          category,
          price,
          unit,
          stock,
          image,
          description,
          tags
        });

        if (res.success) {
          closeProductModal();
          showNotificationToast(`¡"${name}" publicado en el catálogo público de CU2!`, 'success');
          renderSellerProducts();
          updateKPIs();
        } else {
          alert('⚠️ ERROR DE PUBLICACIÓN:\n\n' + res.error);
        }
      });
    }
  }

  // RENDERIZADO DEL DASHBOARD PRIVADO
  function renderDashboard() {
    if (!currentSeller) return;

    // Perfil
    document.getElementById('dash-seller-name').textContent = currentSeller.name;
    document.getElementById('dash-seller-faculty').innerHTML = `<i class="fas fa-graduation-cap text-amber-400 mr-1"></i>${currentSeller.faculty}`;
    document.getElementById('dash-seller-id').innerHTML = `<i class="fas fa-id-card text-sky-400 mr-1"></i>Matrícula: ${currentSeller.studentId}`;
    document.getElementById('dash-seller-email').innerHTML = `<i class="fas fa-envelope text-indigo-400 mr-1"></i>${currentSeller.email}`;
    document.getElementById('dash-seller-phone').innerHTML = `<i class="fab fa-whatsapp text-emerald-400 mr-1"></i>${currentSeller.whatsapp}`;

    // Ubicación en vivo
    const selectBuilding = document.getElementById('dash-location-building');
    const inputLoc = document.getElementById('dash-location-text');
    const inputTime = document.getElementById('dash-location-time');

    if (selectBuilding) selectBuilding.value = currentSeller.currentBuildingId || 'ema3';
    if (inputLoc) inputLoc.value = currentSeller.currentLocation || '';
    if (inputTime) inputTime.value = currentSeller.availableUntil || '15:00 hrs';

    renderSellerOrders();
    renderSellerProducts();
    updateKPIs();
  }

  function renderSellerOrders() {
    if (!currentSeller) return;

    const orders = window.CampusStore.getSellerOrders(currentSeller.id);
    const container = document.getElementById('seller-orders-container');
    const emptyState = document.getElementById('orders-empty-state');
    const badgeOrders = document.getElementById('dash-badge-orders');

    if (badgeOrders) badgeOrders.textContent = orders.length;

    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = orders.map(order => {
      const isPending = order.status === 'Pendiente';
      const isPreparing = order.status === 'En preparación';
      const isReady = order.status === 'Listo para entrega';
      const isDelivered = order.status === 'Entregado';
      const isCancelled = order.status === 'Cancelado';

      const statusColor = isDelivered ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
                          isReady ? 'bg-sky-950 text-sky-300 border-sky-500/40' :
                          isPreparing ? 'bg-purple-950 text-purple-300 border-purple-500/40' :
                          isCancelled ? 'bg-red-950 text-red-300 border-red-500/40' :
                          'bg-amber-950 text-amber-300 border-amber-500/40';

      const customerPhone = order.customerContact || '';
      const waMsg = encodeURIComponent(`Hola ${order.customerName}, sobre tu pedido #${order.id} en CampusTrade CU2...`);

      return `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-black text-amber-400 text-xs tracking-wider">#${order.id}</span>
            <span class="text-[10px] text-slate-500">${order.date}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusColor}">
              ${order.status}
            </span>
          </div>

          <div class="text-xs text-slate-200">
            <p><strong>Comprador:</strong> ${order.customerName}</p>
            <p class="text-sky-300"><strong>Punto de Entrega:</strong> ${order.deliveryPoint}</p>
            <p class="text-slate-400"><strong>Horario:</strong> ${order.deliveryTime}</p>
            <p class="text-amber-400/90"><strong>Pago:</strong> ${order.paymentMethod}</p>
            ${order.notes ? `<p class="text-[11px] text-slate-400 italic">Notas: "${order.notes}"</p>` : ''}
          </div>

          <!-- Desglose de Productos -->
          <div class="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
            ${order.items.map(it => `
              <div class="flex justify-between text-slate-300">
                <span>${it.quantity}x ${it.name}</span>
                <span class="font-bold text-amber-400">$${(it.price * it.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
            <div class="pt-1.5 border-t border-slate-800 flex justify-between font-extrabold text-white text-xs">
              <span>Total a Cobrar:</span>
              <span class="text-amber-400">$${order.total.toFixed(2)} MXN</span>
            </div>
          </div>

          <!-- Acciones de Estado -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <button class="btn-change-status bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-purple-500/30 transition" data-id="${order.id}" data-status="En preparación">
              Preparando
            </button>
            <button class="btn-change-status bg-sky-900/60 hover:bg-sky-800 text-sky-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-sky-500/30 transition" data-id="${order.id}" data-status="Listo para entrega">
              Listo en Punto
            </button>
            <button class="btn-change-status bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition" data-id="${order.id}" data-status="Entregado">
              Entregado
            </button>

            ${customerPhone ? `
              <a href="https://wa.me/${customerPhone}?text=${waMsg}" target="_blank" class="bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition ml-auto flex items-center gap-1">
                <i class="fab fa-whatsapp"></i> Chat
              </a>
            ` : ''}

            <button class="btn-delete-order text-slate-500 hover:text-red-400 p-1 ml-auto" data-id="${order.id}" title="Eliminar registro">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-change-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-id');
        const newStatus = btn.getAttribute('data-status');
        window.CampusStore.updateOrderStatus(currentSeller.id, orderId, newStatus);
        renderSellerOrders();
        updateKPIs();
        showNotificationToast(`Pedido #${orderId} marcado como: ${newStatus}`, 'info');
      });
    });

    container.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-id');
        if (confirm(`¿Eliminar el pedido #${orderId}?`)) {
          window.CampusStore.deleteOrder(currentSeller.id, orderId);
          renderSellerOrders();
          updateKPIs();
        }
      });
    });
  }

  function renderSellerProducts() {
    if (!currentSeller) return;

    const products = window.CampusStore.getSellerProducts(currentSeller.id);
    const container = document.getElementById('seller-products-container');
    const emptyState = document.getElementById('products-empty-state');
    const badgeProducts = document.getElementById('dash-badge-products');

    if (badgeProducts) badgeProducts.textContent = products.length;

    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = products.map(prod => {
      return `
        <div class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-slate-800">
          <div class="relative">
            <img src="${prod.image}" alt="${prod.name}" class="w-full h-36 object-cover bg-slate-900" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'">
            <span class="absolute top-2.5 left-2.5 bg-slate-950/90 text-amber-400 font-extrabold text-xs px-2 py-0.5 rounded-lg border border-amber-500/30">
              $${prod.price.toFixed(2)} MXN
            </span>
            <span class="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              prod.stock > 0 ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40' : 'bg-red-950/90 text-red-300 border border-red-500/40'
            }">
              ${prod.stock > 0 ? `${prod.stock} disponibles` : 'Agotado'}
            </span>
          </div>

          <div class="p-3.5 flex-1 flex flex-col justify-between">
            <div>
              <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">${prod.category}</span>
              <h4 class="font-bold text-sm text-white line-clamp-1 mb-1">${prod.name}</h4>
              <p class="text-xs text-slate-400 line-clamp-2 mb-2">${prod.description || 'Sin descripción'}</p>
              <span class="text-[10px] text-slate-500 block mb-2">Unidad: ${prod.unit}</span>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <div class="flex items-center space-x-1">
                <span class="text-[10px] text-slate-400 mr-1">Stock:</span>
                <button class="btn-stock-delta bg-slate-800 hover:bg-slate-700 text-white w-6 h-6 rounded flex items-center justify-center text-xs" data-id="${prod.id}" data-delta="-1">-</button>
                <span class="font-bold text-xs text-amber-400 px-1">${prod.stock}</span>
                <button class="btn-stock-delta bg-slate-800 hover:bg-slate-700 text-white w-6 h-6 rounded flex items-center justify-center text-xs" data-id="${prod.id}" data-delta="1">+</button>
              </div>

              <button class="btn-delete-product text-red-400 hover:text-red-300 p-1.5" data-id="${prod.id}" title="Eliminar producto">
                <i class="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-stock-delta').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-id');
        const delta = parseInt(btn.getAttribute('data-delta'), 10);
        window.CampusStore.updateProductStock(prodId, delta);
        renderSellerProducts();
      });
    });

    container.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-id');
        if (confirm('¿Eliminar este producto de tu catálogo?')) {
          window.CampusStore.deleteProduct(currentSeller.id, prodId);
          renderSellerProducts();
          updateKPIs();
          showNotificationToast('Producto eliminado', 'info');
        }
      });
    });
  }

  function updateKPIs() {
    if (!currentSeller) return;

    const orders = window.CampusStore.getSellerOrders(currentSeller.id);
    const products = window.CampusStore.getSellerProducts(currentSeller.id);

    const totalDelivered = orders
      .filter(o => o.status === 'Entregado')
      .reduce((sum, o) => sum + o.total, 0);

    const pendingOrders = orders
      .filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado').length;

    const kpiSales = document.getElementById('kpi-sales-amount');
    const kpiPending = document.getElementById('kpi-pending-orders');
    const kpiProducts = document.getElementById('kpi-products-count');

    if (kpiSales) kpiSales.textContent = `$${totalDelivered.toFixed(2)}`;
    if (kpiPending) kpiPending.textContent = pendingOrders;
    if (kpiProducts) kpiProducts.textContent = products.length;
  }

  // ALERTAS Y NOTIFICACIONES
  function showAlert(msg, type = 'error') {
    const alertEl = document.getElementById('auth-alert');
    if (!alertEl) return;

    alertEl.classList.remove('hidden', 'bg-red-950/80', 'border-red-500/40', 'text-red-200', 'bg-emerald-950/80', 'border-emerald-500/40', 'text-emerald-200');

    if (type === 'error') {
      alertEl.classList.add('bg-red-950/80', 'border-red-500/40', 'text-red-200');
      alertEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1.5"></i> ${msg}`;
    } else {
      alertEl.classList.add('bg-emerald-950/80', 'border-emerald-500/40', 'text-emerald-200');
      alertEl.innerHTML = `<i class="fas fa-check-circle mr-1.5"></i> ${msg}`;
    }
  }

  function hideAlert() {
    const alertEl = document.getElementById('auth-alert');
    if (alertEl) alertEl.classList.add('hidden');
  }

  function showNotificationToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-5 right-5 z-[100] flex flex-col space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200' : 'bg-sky-900/90 border-sky-500 text-sky-200';
    toast.className = `p-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-2xl flex items-center space-x-2 pointer-events-auto transition ${color}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i><span>${msg}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

})();
