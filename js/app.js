// CampusTrade CU2 - Aplicación Pública para Compradores y Estudiantes
// Conexión directa con Firebase en tiempo real

(function () {
  'use strict';

  // ESTADO LOCAL DE NAVEGACIÓN Y CARRITO
  const CLIENT_STATE = {
    cart: [],
    activeCategory: 'all',
    selectedBuildingId: null,
    searchQuery: '',
    currentView: 'catalog'
  };

  let allProductsFromCloud = []; // Variable global para Firebase

  // CARGAR CARRITO PERSISTENTE
  function loadCart() {
    try {
      const stored = localStorage.getItem('campustrade_cart_v2');
      if (stored) CLIENT_STATE.cart = JSON.parse(stored);
    } catch (e) {
      CLIENT_STATE.cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem('campustrade_cart_v2', JSON.stringify(CLIENT_STATE.cart));
    updateCartBadges();
  }

  // INICIALIZACIÓN
  document.addEventListener('DOMContentLoaded', () => {
    window.CampusStore.init();
    loadCart();
    renderCategories();
    startProductListener(); // Inicia la escucha a Firebase
    updateCartBadges();
    setupEventListeners();
    setupBuildingSelector();
    updateSellerNavState();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.log('SW Note:', err.message);
      });
    }
  });

  function updateSellerNavState() {
    const currentSeller = window.CampusStore.getCurrentSeller();
    const btnNavSeller = document.getElementById('btn-nav-seller');
    if (!btnNavSeller) return;

    if (currentSeller) {
      btnNavSeller.innerHTML = `
        <i class="fas fa-user-circle text-amber-400"></i>
        <span>Mi Portal (${currentSeller.name.split(' ')[0]})</span>
      `;
      btnNavSeller.href = './portal-vendedor.html';
    } else {
      btnNavSeller.innerHTML = `
        <i class="fas fa-hand-holding-usd text-amber-400"></i>
        <span>Portal Vendedores</span>
      `;
      btnNavSeller.href = './portal-vendedor.html';
    }
  }

  // CATEGORÍAS
  function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = window.CATEGORIES.map(cat => {
      const isActive = CLIENT_STATE.activeCategory === cat.id;
      return `
        <button class="category-pill px-4 py-2 rounded-full text-xs sm:text-sm font-medium flex items-center space-x-2 transition-all ${
          isActive ? 'active' : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
        }" data-cat="${cat.id}">
          <i class="fas ${cat.icon}"></i>
          <span>${cat.name}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        CLIENT_STATE.activeCategory = btn.getAttribute('data-cat');
        renderCategories();
        renderProductsView(); // Actualizamos la vista sin volver a descargar
      });
    });
  }

  // FIREBASE: ESCUCHA DE PRODUCTOS
  function startProductListener() {
    if (typeof db !== 'undefined') {
      db.collection("productos").onSnapshot((querySnapshot) => {
        allProductsFromCloud = [];
        querySnapshot.forEach((doc) => {
          allProductsFromCloud.push({ id: doc.id, ...doc.data() });
        });
        renderProductsView();
        renderMapPins(); // Actualizar pines del mapa
      }, (error) => {
        console.error("Error al escuchar productos: ", error);
      });
    } else {
      console.warn("Firebase no está inicializado.");
    }
  }

  // RENDERIZADO DE LA VISTA
  function renderProductsView() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('products-empty');
    const activeFilterTag = document.getElementById('active-filter-tag');
    if (!grid) return;

    let filtered = allProductsFromCloud.filter(product => {
      const matchesCat = CLIENT_STATE.activeCategory === 'all' || product.categoria === CLIENT_STATE.activeCategory;
      const q = CLIENT_STATE.searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        product.nombre.toLowerCase().includes(q) ||
        (product.descripcion && product.descripcion.toLowerCase().includes(q)) ||
        (product.etiquetas && product.etiquetas.toLowerCase().includes(q));
      
      const matchesBuilding = !CLIENT_STATE.selectedBuildingId || product.vendedorEdificio === CLIENT_STATE.selectedBuildingId;

      return matchesCat && matchesSearch && matchesBuilding;
    });

    if (activeFilterTag) {
      if (CLIENT_STATE.selectedBuildingId) {
        const building = window.CU2_BUILDINGS.find(b => b.id === CLIENT_STATE.selectedBuildingId);
        activeFilterTag.innerHTML = `
          <div class="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
            <i class="fas fa-map-marker-alt"></i> Filtrado por: ${building ? building.name : 'Edificio'}
            <button id="clear-building-filter" class="hover:text-white ml-1">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        document.getElementById('clear-building-filter')?.addEventListener('click', () => {
          CLIENT_STATE.selectedBuildingId = null;
          updateActivePinUI();
          renderProductsView();
        });
      } else {
        activeFilterTag.innerHTML = '';
      }
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (allProductsFromCloud.length === 0) {
          emptyState.innerHTML = `
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
              <i class="fas fa-store"></i>
            </div>
            <h3 class="font-extrabold text-base text-white">Catálogo listo para el Campus CU2</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No hay productos. Crea tu cuenta de vendedor y publica tus productos hoy mismo.
            </p>
          `;
        } else {
          emptyState.innerHTML = `
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-2xl">
              <i class="fas fa-search"></i>
            </div>
            <h3 class="font-bold text-base text-slate-200">No encontramos productos con estos filtros</h3>
          `;
        }
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    grid.innerHTML = filtered.map(prod => {
      const inStock = prod.stock > 0;
      const precio = parseFloat(prod.precio) || 0;
      
      return `
        <div class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group">
          <div class="relative">
            <img src="${prod.imagen || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" alt="${prod.nombre}" class="w-full h-44 object-cover object-center group-hover:scale-105 transition duration-500 bg-slate-900" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'">
            
            <span class="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md text-amber-400 font-extrabold text-sm px-2.5 py-1 rounded-lg border border-amber-500/30">
              $${precio.toFixed(2)} MXN
            </span>
            <span class="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-semibold ${inStock ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'bg-red-950/80 text-red-300 border border-red-500/40'}">
              ${inStock ? `${prod.stock} disponibles` : 'Agotado'}
            </span>
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span class="truncate font-semibold text-slate-200">
                  <i class="fas fa-user-circle text-amber-400 mr-1"></i>${prod.vendedorNombre || 'Estudiante'}
                </span>
                <span class="text-[10px] text-sky-400 font-medium uppercase">${prod.vendedorEdificio || 'CU2'}</span>
              </div>
              <h3 class="font-bold text-slate-100 text-base leading-snug line-clamp-1 mb-1">${prod.nombre}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mb-3">${prod.descripcion || 'Producto de CU2.'}</p>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button class="btn-quick-order flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg shadow-amber-500/20" data-id="${prod.id}">
                <i class="fas fa-shopping-basket"></i> Pedir
              </button>
              
              ${prod.vendedorWhatsapp ? `
                <button class="btn-whatsapp bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-2 px-3 rounded-xl text-xs flex items-center justify-center transition" data-whatsapp="${prod.vendedorWhatsapp}" data-name="${prod.nombre}">
                  <i class="fab fa-whatsapp text-sm"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-quick-order').forEach(btn => {
      btn.addEventListener('click', () => addToCartCloud(btn.getAttribute('data-id')));
    });

    grid.querySelectorAll('.btn-whatsapp').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-whatsapp');
        const prodName = btn.getAttribute('data-name');
        const url = `https://wa.me/${num}?text=${encodeURIComponent(`Hola! Vi tu producto "${prodName}" en CampusTrade CU2. ¿Sigue disponible?`)}`;
        window.open(url, '_blank');
      });
    });
  }

  // CARRITO FIREBASE
  function addToCartCloud(productId) {
    const product = allProductsFromCloud.find(p => p.id === productId);
    if (!product) return;
    if (product.stock <= 0) {
      showToast('Producto agotado', 'warning');
      return;
    }
    const existing = CLIENT_STATE.cart.find(item => item.productId === productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        showToast(`Stock máximo (${product.stock})`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      CLIENT_STATE.cart.push({ productId: product.id, quantity: 1, sellerId: product.vendedorId || 'anonimo' });
    }
    saveCart();
    showToast(`¡"${product.nombre}" añadido!`, 'success');
  }

  function removeFromCart(productId) {
    CLIENT_STATE.cart = CLIENT_STATE.cart.filter(item => item.productId !== productId);
    saveCart();
    renderCartModal();
  }

  function updateCartQuantityCloud(productId, delta) {
    const item = CLIENT_STATE.cart.find(i => i.productId === productId);
    const product = allProductsFromCloud.find(p => p.id === productId);
    if (!item || !product) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) removeFromCart(productId);
    else if (newQty > product.stock) showToast(`Stock máximo (${product.stock})`, 'warning');
    else { item.quantity = newQty; saveCart(); renderCartModal(); }
  }

  function updateCartBadges() {
    const count = CLIENT_STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-badge-count').forEach(b => {
      b.textContent = count;
      count > 0 ? b.classList.remove('hidden') : b.classList.add('hidden');
    });
  }

  function renderCartModal() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-amount');
    const emptyNotice = document.getElementById('cart-empty-notice');
    const form = document.getElementById('cart-checkout-form');
    if (!container || !totalEl) return;

    if (CLIENT_STATE.cart.length === 0) {
      container.innerHTML = '';
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      if (form) form.classList.add('hidden');
      totalEl.textContent = '$0.00 MXN';
      return;
    }

    if (emptyNotice) emptyNotice.classList.add('hidden');
    if (form) form.classList.remove('hidden');

    let total = 0;
    container.innerHTML = CLIENT_STATE.cart.map(item => {
      const prod = allProductsFromCloud.find(p => p.id === item.productId);
      if (!prod) return '';
      const precio = parseFloat(prod.precio) || 0;
      total += precio * item.quantity;
      return `
        <div class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl border border-slate-800">
          <div class="flex items-center space-x-3">
            <img src="${prod.imagen || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" class="w-12 h-12 rounded-lg object-cover">
            <div>
              <h4 class="font-bold text-sm text-slate-100">${prod.nombre}</h4>
              <p class="text-xs text-amber-400">$${precio.toFixed(2)} c/u</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <div class="flex bg-slate-800 rounded-lg border border-slate-700">
              <button class="btn-qty-minus px-2 py-1 text-slate-400" data-id="${prod.id}">-</button>
              <span class="text-xs font-bold px-2 text-white flex items-center">${item.quantity}</span>
              <button class="btn-qty-plus px-2 py-1 text-slate-400" data-id="${prod.id}">+</button>
            </div>
            <button class="btn-cart-remove text-red-400 p-1.5" data-id="${prod.id}"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      `;
    }).join('');
    
    totalEl.textContent = `$${total.toFixed(2)} MXN`;

    container.querySelectorAll('.btn-qty-minus').forEach(b => b.addEventListener('click', () => updateCartQuantityCloud(b.getAttribute('data-id'), -1)));
    container.querySelectorAll('.btn-qty-plus').forEach(b => b.addEventListener('click', () => updateCartQuantityCloud(b.getAttribute('data-id'), 1)));
    container.querySelectorAll('.btn-cart-remove').forEach(b => b.addEventListener('click', () => removeFromCart(b.getAttribute('data-id'))));
    populateDeliveryPoints();
  }

  function populateDeliveryPoints() {
    const select = document.getElementById('checkout-delivery-point');
    if (!select) return;
    select.innerHTML = '';
    window.CU2_BUILDINGS.forEach(b => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = `${b.code} - ${b.name}`;
      b.safePoints.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = `${b.code}: ${sp}`;
        opt.textContent = `${b.code}: ${sp}`;
        optGroup.appendChild(opt);
      });
      select.appendChild(optGroup);
    });
  }

  // CHECKOUT
  function handleProcessOrder(e) {
    e.preventDefault();
    if (CLIENT_STATE.cart.length === 0) return;

    const customerName = document.getElementById('checkout-customer-name')?.value.trim() || 'Estudiante';
    const customerContact = document.getElementById('checkout-customer-contact')?.value.trim() || '';
    const deliveryPoint = document.getElementById('checkout-delivery-point')?.value || 'EMA 3';
    const deliveryTime = document.getElementById('checkout-delivery-time')?.value || 'Inmediato';
    const paymentMethod = document.getElementById('checkout-payment-method')?.value || 'Efectivo';
    const notes = document.getElementById('checkout-notes')?.value.trim() || '';

    const orderItems = [];
    let total = 0;
    let mainSellerId = null;
    let mainSellerWhatsapp = '';

    CLIENT_STATE.cart.forEach(item => {
      const p = allProductsFromCloud.find(prod => prod.id === item.productId);
      if (p) {
        orderItems.push({ id: p.id, name: p.nombre, quantity: item.quantity, price: parseFloat(p.precio) });
        total += parseFloat(p.precio) * item.quantity;
        if (!mainSellerId) {
          mainSellerId = p.vendedorId;
          mainSellerWhatsapp = p.vendedorWhatsapp || '';
        }
      }
    });

    const res = window.CampusStore.createOrder({
      sellerId: mainSellerId, customerName, customerContact, items: orderItems, total, deliveryPoint, deliveryTime, paymentMethod, notes
    });

    if (res.success) {
      CLIENT_STATE.cart = [];
      saveCart();
      closeModal('cart-modal');
      showOrderSuccess(res.order, mainSellerWhatsapp);
    }
  }

  function showOrderSuccess(order, whatsappNumber) {
    const modal = document.getElementById('order-success-modal');
    if (!modal) return;
    document.getElementById('success-order-id').textContent = '#' + order.id;
    document.getElementById('success-order-total').textContent = `$${order.total.toFixed(2)} MXN`;
    document.getElementById('success-order-point').textContent = order.deliveryPoint;
    document.getElementById('success-order-time').textContent = order.deliveryTime;

    const itemsSummary = order.items.map(i => `${i.quantity}x ${i.name} ($${i.price * i.quantity})`).join('\n• ');
    const waText = encodeURIComponent(`🐺 *PEDIDO CAMPUSTRADE CU2 (#${order.id})*\n\n¡Hola! Soy *${order.customerName}*. Solicitud en campus CU2:\n\n• ${itemsSummary}\n\n💰 *Total:* $${order.total.toFixed(2)} MXN\n📍 *Punto:* ${order.deliveryPoint}\n🕒 *Horario:* ${order.deliveryTime}\n💳 *Pago:* ${order.paymentMethod}\n${order.notes ? `📝 *Notas:* ${order.notes}\n` : ''}\n¿Me confirmas entrega?`);
    
    const waBtn = document.getElementById('btn-whatsapp-order');
    if (waBtn) {
      const cleanPhone = (whatsappNumber || '').replace(/[^0-9]/g, '');
      if (cleanPhone) {
        waBtn.href = `https://wa.me/${cleanPhone}?text=${waText}`;
        waBtn.classList.remove('hidden');
      }
    }
    openModal('order-success-modal');
  }

  // MAPA
  function renderMapPins() {
    const pinsContainer = document.getElementById('map-pins-overlay');
    if (!pinsContainer) return;
    pinsContainer.innerHTML = window.CU2_BUILDINGS.map(b => {
      const isSelected = CLIENT_STATE.selectedBuildingId === b.id;
      const count = allProductsFromCloud.filter(p => p.vendedorEdificio === b.id).length;
      return `
        <div class="map-pin ${isSelected ? 'active' : ''}" style="top: ${b.topPercent}%; left: ${b.leftPercent}%;" data-building-id="${b.id}" title="${b.name}">
          <div class="pin-circle"><i class="fas ${b.icon}"></i></div>
          <div class="pin-pulse"></div>
          <div class="bg-slate-900/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none border border-slate-700">
            ${b.code} ${count > 0 ? `(${count})` : ''}
          </div>
        </div>
      `;
    }).join('');

    pinsContainer.querySelectorAll('.map-pin').forEach(pin => {
      pin.addEventListener('click', () => selectBuilding(pin.getAttribute('data-building-id')));
    });
  }

  function selectBuilding(buildingId) {
    CLIENT_STATE.selectedBuildingId = CLIENT_STATE.selectedBuildingId === buildingId ? null : buildingId;
    updateActivePinUI();
    showBuildingDetailCard();
    renderProductsView();
  }

  function updateActivePinUI() {
    document.querySelectorAll('.map-pin').forEach(pin => {
      pin.getAttribute('data-building-id') === CLIENT_STATE.selectedBuildingId ? pin.classList.add('active') : pin.classList.remove('active');
    });
  }

  function showBuildingDetailCard() {
    const card = document.getElementById('building-detail-card');
    if (!card) return;
    if (!CLIENT_STATE.selectedBuildingId) { card.classList.add('hidden'); return; }
    
    const b = window.CU2_BUILDINGS.find(item => item.id === CLIENT_STATE.selectedBuildingId);
    if (!b) return;

    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="p-4 bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl relative">
        <button id="close-building-card" class="absolute top-3 right-3 text-slate-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg shrink-0"><i class="fas ${b.icon}"></i></div>
          <div>
            <span class="text-xs font-bold text-amber-400 tracking-wider uppercase">${b.code}</span>
            <h3 class="font-extrabold text-base text-white leading-tight">${b.name}</h3>
            <p class="text-xs text-sky-300 mb-2">${b.faculty}</p>
            <p class="text-xs text-slate-300 mb-3">${b.description}</p>
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-800">
          <h4 class="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5"><i class="fas fa-shield-alt"></i> Puntos Limpios:</h4>
          <ul class="text-xs text-slate-300 space-y-1 mb-3">
            ${b.safePoints.map(sp => `<li class="flex items-center gap-1.5"><i class="fas fa-check-circle text-emerald-400 text-[10px]"></i> ${sp}</li>`).join('')}
          </ul>
          <div class="flex gap-2">
            <button id="btn-filter-here" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex-1 transition"><i class="fas fa-search mr-1"></i> Ver productos aquí</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('close-building-card')?.addEventListener('click', () => selectBuilding(b.id));
    document.getElementById('btn-filter-here')?.addEventListener('click', () => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' }));
  }

  function setupBuildingSelector() {
    const select = document.getElementById('select-building-quick');
    if (!select) return;
    select.innerHTML = '<option value="">Todos los Edificios</option>' + window.CU2_BUILDINGS.map(b => `<option value="${b.id}">${b.code} - ${b.name}</option>`).join('');
    select.addEventListener('change', (e) => {
      CLIENT_STATE.selectedBuildingId = e.target.value || null;
      updateActivePinUI();
      showBuildingDetailCard();
      renderProductsView();
    });
  }

  // EVENTOS Y NAVEGACIÓN
  function setupEventListeners() {
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      CLIENT_STATE.searchQuery = e.target.value;
      renderProductsView();
    });
    document.querySelectorAll('[data-view-target]').forEach(t => t.addEventListener('click', (e) => {
      e.preventDefault(); switchView(t.getAttribute('data-view-target'));
    }));
    document.getElementById('cart-checkout-form')?.addEventListener('submit', handleProcessOrder);
    document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal'))));
    document.querySelectorAll('.trigger-open-cart').forEach(btn => btn.addEventListener('click', () => {
      renderCartModal(); openModal('cart-modal');
    }));
  }

  function switchView(viewName) {
    CLIENT_STATE.currentView = viewName;
    ['catalog', 'map', 'docs'].forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) v === viewName ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (viewName === 'map') { renderMapPins(); updateActivePinUI(); }
  }

  function openModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } }
  function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('hidden'); document.body.style.overflow = ''; } }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-5 right-5 z-[100] flex flex-col space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200' : type === 'warning' ? 'bg-amber-900/90 border-amber-500 text-amber-200' : 'bg-sky-900/90 border-sky-500 text-sky-200';
    toast.className = `p-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-2xl flex items-center space-x-2 pointer-events-auto transition ${color}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

})();