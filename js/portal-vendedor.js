// CampusTrade CU2 - Lógica del Portal Exclusivo del Vendedor
// Manejo de autenticación, catálogo propio (Firestore en tiempo real) y pedidos de campus

(function () {
  'use strict';

  let currentSeller = null;
  let activeTab = 'orders'; // 'orders' o 'products'

  // Productos del vendedor actual, sincronizados desde Firestore
  let sellerProducts = [];
  let unsubscribeProducts = null;

  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';

  // Filtro ético y legal BUAP (antes vivía en store.js y se omitía al publicar en Firebase)
  const FORBIDDEN_KEYWORDS = ['tarea', 'examen', 'tesis', 'ensayo escolar', 'cerveza', 'cigarro', 'vape', 'vodka', 'alcohol', 'droga'];

  // Escapa texto antes de insertarlo con innerHTML (los datos ahora vienen de una base pública)
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function toMillis(ts) {
    return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
  }

  function categoryName(id) {
    const cat = (window.CATEGORIES || []).find((c) => c.id === id);
    return cat ? cat.name : (id || 'Sin categoría');
  }

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
      stopListeningProducts();
      if (authSection) authSection.classList.remove('hidden');
      if (dashboardSection) dashboardSection.classList.add('hidden');
      if (navControls) navControls.classList.add('hidden');
    }
  }

  // ==========================================================
  // FIRESTORE: PRODUCTOS DEL VENDEDOR EN TIEMPO REAL
  // ==========================================================
  function stopListeningProducts() {
    if (unsubscribeProducts) {
      unsubscribeProducts();
      unsubscribeProducts = null;
    }
    sellerProducts = [];
  }

  function listenSellerProducts() {
    stopListeningProducts();
    if (!currentSeller) return;

    if (typeof db === 'undefined') {
      showNotificationToast('Firebase no está inicializado en esta página.', 'error');
      return;
    }

    unsubscribeProducts = db.collection('productos')
      .where('vendedorId', '==', currentSeller.id)
      .onSnapshot((snapshot) => {
        sellerProducts = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.fechaCreacion) - toMillis(a.fechaCreacion));

        renderSellerProducts();
        updateKPIs();
      }, (error) => {
        console.error('Error al escuchar tus productos:', error);
        showNotificationToast('No se pudieron cargar tus productos (' + (error.code || error.message) + ')', 'error');
      });
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
          stopListeningProducts();
          window.CampusStore.logoutSeller();
          initAuth();
        }
      });
    }

    // Guardar Ubicación en Vivo
    const btnSaveLocation = document.getElementById('btn-save-location');
    if (btnSaveLocation) {
      btnSaveLocation.addEventListener('click', async () => {
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

        // El catálogo público filtra por product.vendedorEdificio,
        // así que si el vendedor cambia de edificio se actualizan sus productos en Firestore.
        try {
          const toUpdate = sellerProducts.filter((p) => p.vendedorEdificio !== buildingId);
          if (toUpdate.length > 0) {
            const batch = db.batch();
            toUpdate.forEach((p) => {
              batch.update(db.collection('productos').doc(p.id), { vendedorEdificio: buildingId });
            });
            await batch.commit();
          }
          showNotificationToast('Ubicación de entrega en vivo actualizada para tus clientes', 'success');
        } catch (error) {
          console.error('Error al actualizar el edificio de tus productos:', error);
          showNotificationToast('Se guardó tu ubicación, pero no se pudo actualizar el edificio en el catálogo (' + (error.code || error.message) + ')', 'error');
        }
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

    // Formulario de Agregar Producto (Firestore)
    const formProduct = document.getElementById('form-modal-product');
    if (formProduct) {
      formProduct.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Filtro de seguridad por si expiró la sesión
        if (!currentSeller) {
          alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          window.location.reload();
          return;
        }

        const nombre = document.getElementById('prod-name').value.trim();
        const descripcion = document.getElementById('prod-description').value.trim();

        // Filtro ético y legal BUAP
        const text = `${nombre} ${descripcion}`.toLowerCase();
        const found = FORBIDDEN_KEYWORDS.find((w) => text.includes(w));
        if (found) {
          alert(`Contenido no permitido ("${found}"). Está estrictamente prohibida la venta de tareas o sustancias reguladas según la normativa BUAP.`);
          return;
        }

        const submitBtn = formProduct.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const nuevoProducto = {
          // Datos del producto
          nombre,
          categoria: document.getElementById('prod-category').value,
          precio: parseFloat(document.getElementById('prod-price').value),
          unidad: document.getElementById('prod-unit').value.trim(),
          stock: parseInt(document.getElementById('prod-stock').value, 10),
          imagen: document.getElementById('prod-image').value.trim(),
          descripcion,
          etiquetas: document.getElementById('prod-tags').value.trim(),

          // Datos del vendedor
          vendedorId: currentSeller.id,
          vendedorNombre: currentSeller.name,
          vendedorWhatsapp: currentSeller.whatsapp,
          vendedorEdificio: document.getElementById('dash-location-building')?.value || currentSeller.defaultBuilding,

          // Marca de tiempo de Firestore
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          const docRef = await db.collection('productos').add(nuevoProducto);
          console.log('Producto guardado. ID:', docRef.id);

          closeProductModal();
          showNotificationToast(`¡"${nuevoProducto.nombre}" publicado en el catálogo público de CU2!`, 'success');
          // No hace falta refrescar a mano: el listener de listenSellerProducts() actualiza la lista solo.
        } catch (error) {
          console.error('Error al guardar en Firebase:', error);
          alert('No se pudo publicar el producto: ' + (error.code || error.message));
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  // RENDERIZADO DEL DASHBOARD PRIVADO
  function renderDashboard() {
    if (!currentSeller) return;

    // Perfil
    document.getElementById('dash-seller-name').textContent = currentSeller.name;
    document.getElementById('dash-seller-faculty').innerHTML = `<i class="fas fa-graduation-cap text-amber-400 mr-1"></i>${esc(currentSeller.faculty)}`;
    document.getElementById('dash-seller-id').innerHTML = `<i class="fas fa-id-card text-sky-400 mr-1"></i>Matrícula: ${esc(currentSeller.studentId)}`;
    document.getElementById('dash-seller-email').innerHTML = `<i class="fas fa-envelope text-indigo-400 mr-1"></i>${esc(currentSeller.email)}`;
    document.getElementById('dash-seller-phone').innerHTML = `<i class="fab fa-whatsapp text-emerald-400 mr-1"></i>${esc(currentSeller.whatsapp)}`;

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

    // Productos: escucha en tiempo real desde Firestore
    listenSellerProducts();
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

    container.innerHTML = orders.map((order) => {
      const isPreparing = order.status === 'En preparación';
      const isReady = order.status === 'Listo para entrega';
      const isDelivered = order.status === 'Entregado';
      const isCancelled = order.status === 'Cancelado';

      const statusColor = isDelivered ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
                          isReady ? 'bg-sky-950 text-sky-300 border-sky-500/40' :
                          isPreparing ? 'bg-purple-950 text-purple-300 border-purple-500/40' :
                          isCancelled ? 'bg-red-950 text-red-300 border-red-500/40' :
                          'bg-amber-950 text-amber-300 border-amber-500/40';

      const customerPhone = String(order.customerContact || '').replace(/[^0-9]/g, '');
      const waMsg = encodeURIComponent(`Hola ${order.customerName}, sobre tu pedido #${order.id} en CampusTrade CU2...`);

      return `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-black text-amber-400 text-xs tracking-wider">#${esc(order.id)}</span>
            <span class="text-[10px] text-slate-500">${esc(order.date)}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusColor}">
              ${esc(order.status)}
            </span>
          </div>

          <div class="text-xs text-slate-200">
            <p><strong>Comprador:</strong> ${esc(order.customerName)}</p>
            <p class="text-sky-300"><strong>Punto de Entrega:</strong> ${esc(order.deliveryPoint)}</p>
            <p class="text-slate-400"><strong>Horario:</strong> ${esc(order.deliveryTime)}</p>
            <p class="text-amber-400/90"><strong>Pago:</strong> ${esc(order.paymentMethod)}</p>
            ${order.notes ? `<p class="text-[11px] text-slate-400 italic">Notas: "${esc(order.notes)}"</p>` : ''}
          </div>

          <!-- Desglose de Productos -->
          <div class="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
            ${order.items.map((it) => `
              <div class="flex justify-between text-slate-300">
                <span>${esc(it.quantity)}x ${esc(it.name)}</span>
                <span class="font-bold text-amber-400">$${(it.price * it.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
            <div class="pt-1.5 border-t border-slate-800 flex justify-between font-extrabold text-white text-xs">
              <span>Total a Cobrar:</span>
              <span class="text-amber-400">$${Number(order.total).toFixed(2)} MXN</span>
            </div>
          </div>

          <!-- Acciones de Estado -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <button class="btn-change-status bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-purple-500/30 transition" data-id="${esc(order.id)}" data-status="En preparación">
              Preparando
            </button>
            <button class="btn-change-status bg-sky-900/60 hover:bg-sky-800 text-sky-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-sky-500/30 transition" data-id="${esc(order.id)}" data-status="Listo para entrega">
              Listo en Punto
            </button>
            <button class="btn-change-status bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition" data-id="${esc(order.id)}" data-status="Entregado">
              Entregado
            </button>

            ${customerPhone ? `
              <a href="https://wa.me/${customerPhone}?text=${waMsg}" target="_blank" rel="noopener" class="bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition ml-auto flex items-center gap-1">
                <i class="fab fa-whatsapp"></i> Chat
              </a>
            ` : ''}

            <button class="btn-delete-order text-slate-500 hover:text-red-400 p-1 ml-auto" data-id="${esc(order.id)}" title="Eliminar registro">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-change-status').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-id');
        const newStatus = btn.getAttribute('data-status');
        window.CampusStore.updateOrderStatus(currentSeller.id, orderId, newStatus);
        renderSellerOrders();
        updateKPIs();
        showNotificationToast(`Pedido #${orderId} marcado como: ${newStatus}`, 'info');
      });
    });

    container.querySelectorAll('.btn-delete-order').forEach((btn) => {
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

  // Lista "Mis Productos en Venta" (datos de Firestore, campos en español)
  function renderSellerProducts() {
    if (!currentSeller) return;

    const products = sellerProducts;
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

    container.innerHTML = products.map((prod) => {
      const precio = parseFloat(prod.precio) || 0;
      const stock = parseInt(prod.stock, 10) || 0;
      const imagen = prod.imagen || FALLBACK_IMG;

      return `
        <div class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-slate-800">
          <div class="relative">
            <img src="${esc(imagen)}" alt="${esc(prod.nombre)}" class="w-full h-36 object-cover bg-slate-900" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
            <span class="absolute top-2.5 left-2.5 bg-slate-950/90 text-amber-400 font-extrabold text-xs px-2 py-0.5 rounded-lg border border-amber-500/30">
              $${precio.toFixed(2)} MXN
            </span>
            <span class="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              stock > 0 ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40' : 'bg-red-950/90 text-red-300 border border-red-500/40'
            }">
              ${stock > 0 ? `${stock} disponibles` : 'Agotado'}
            </span>
          </div>

          <div class="p-3.5 flex-1 flex flex-col justify-between">
            <div>
              <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">${esc(categoryName(prod.categoria))}</span>
              <h4 class="font-bold text-sm text-white line-clamp-1 mb-1">${esc(prod.nombre)}</h4>
              <p class="text-xs text-slate-400 line-clamp-2 mb-2">${esc(prod.descripcion) || 'Sin descripción'}</p>
              <span class="text-[10px] text-slate-500 block mb-2">Unidad: ${esc(prod.unidad)}</span>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <div class="flex items-center space-x-1">
                <span class="text-[10px] text-slate-400 mr-1">Stock:</span>
                <button class="btn-stock-delta bg-slate-800 hover:bg-slate-700 text-white w-6 h-6 rounded flex items-center justify-center text-xs" data-id="${esc(prod.id)}" data-delta="-1">-</button>
                <span class="font-bold text-xs text-amber-400 px-1">${stock}</span>
                <button class="btn-stock-delta bg-slate-800 hover:bg-slate-700 text-white w-6 h-6 rounded flex items-center justify-center text-xs" data-id="${esc(prod.id)}" data-delta="1">+</button>
              </div>

              <button class="btn-delete-product text-red-400 hover:text-red-300 p-1.5" data-id="${esc(prod.id)}" title="Eliminar producto">
                <i class="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-stock-delta').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const prodId = btn.getAttribute('data-id');
        const delta = parseInt(btn.getAttribute('data-delta'), 10);
        const prod = sellerProducts.find((p) => p.id === prodId);
        if (!prod) return;

        const current = parseInt(prod.stock, 10) || 0;
        if (current + delta < 0) return;

        try {
          await db.collection('productos').doc(prodId).update({
            stock: firebase.firestore.FieldValue.increment(delta)
          });
        } catch (error) {
          console.error('Error al actualizar stock:', error);
          showNotificationToast('No se pudo actualizar el stock (' + (error.code || error.message) + ')', 'error');
        }
      });
    });

    container.querySelectorAll('.btn-delete-product').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const prodId = btn.getAttribute('data-id');
        if (!confirm('¿Eliminar este producto de tu catálogo?')) return;

        try {
          await db.collection('productos').doc(prodId).delete();
          showNotificationToast('Producto eliminado', 'info');
        } catch (error) {
          console.error('Error al eliminar producto:', error);
          showNotificationToast('No se pudo eliminar el producto (' + (error.code || error.message) + ')', 'error');
        }
      });
    });
  }

  function updateKPIs() {
    if (!currentSeller) return;

    const orders = window.CampusStore.getSellerOrders(currentSeller.id);

    const totalDelivered = orders
      .filter((o) => o.status === 'Entregado')
      .reduce((sum, o) => sum + o.total, 0);

    const pendingOrders = orders
      .filter((o) => o.status !== 'Entregado' && o.status !== 'Cancelado').length;

    const kpiSales = document.getElementById('kpi-sales-amount');
    const kpiPending = document.getElementById('kpi-pending-orders');
    const kpiProducts = document.getElementById('kpi-products-count');

    if (kpiSales) kpiSales.textContent = `$${totalDelivered.toFixed(2)}`;
    if (kpiPending) kpiPending.textContent = pendingOrders;
    if (kpiProducts) kpiProducts.textContent = sellerProducts.length;
  }

  // ALERTAS Y NOTIFICACIONES
  function showAlert(msg, type = 'error') {
    const alertEl = document.getElementById('auth-alert');
    if (!alertEl) return;

    alertEl.classList.remove('hidden', 'bg-red-950/80', 'border-red-500/40', 'text-red-200', 'bg-emerald-950/80', 'border-emerald-500/40', 'text-emerald-200');

    if (type === 'error') {
      alertEl.classList.add('bg-red-950/80', 'border-red-500/40', 'text-red-200');
      alertEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1.5"></i> ${esc(msg)}`;
    } else {
      alertEl.classList.add('bg-emerald-950/80', 'border-emerald-500/40', 'text-emerald-200');
      alertEl.innerHTML = `<i class="fas fa-check-circle mr-1.5"></i> ${esc(msg)}`;
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
    const color = type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200'
                : type === 'error' ? 'bg-red-900/90 border-red-500 text-red-200'
                : 'bg-sky-900/90 border-sky-500 text-sky-200';
    toast.className = `p-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-2xl flex items-center space-x-2 pointer-events-auto transition ${color}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i><span>${esc(msg)}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), type === 'error' ? 6000 : 3000);
  }

})();