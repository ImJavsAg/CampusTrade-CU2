// CampusTrade CU2 - Aplicación Pública para Compradores y Estudiantes
// Conexión directa con CampusStore (sin datos de prueba)

(function () {
  'use strict';

  // ESTADO LOCAL DE NAVEGACIÓN Y CARRITO
  const CLIENT_STATE = {
    cart: [],
    activeCategory: 'all',
    selectedBuildingId: null,
    searchQuery: '',
    currentView: 'catalog' // 'catalog', 'map', 'docs'
  };

  // CARGAR CARRITO PERSISTENTE
  function loadCart() {
    try {
      const stored = localStorage.getItem('campustrade_cart_v2');
      if (stored) {
        CLIENT_STATE.cart = JSON.parse(stored);
      }
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
    renderProducts();
    renderMapPins();
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

  // ACTUALIZAR ESTADO DE BOTÓN VENDEDOR EN NAVBAR
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

  // RENDERIZADO DE CATEGORÍAS
  function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = window.CATEGORIES.map(cat => {
      const isActive = CLIENT_STATE.activeCategory === cat.id;
      return `
        <button class="category-pill px-4 py-2 rounded-full text-xs sm:text-sm font-medium flex items-center space-x-2 transition-all ${
          isActive 
            ? 'active' 
            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
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
        renderProducts();
      });
    });
  }

  // RENDERIZADO DE PRODUCTOS REALES (SIN DATOS DE PRUEBA)
  function renderProducts() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('products-empty');
    const activeFilterTag = document.getElementById('active-filter-tag');
    if (!grid) return;

    const allProducts = window.CampusStore.getPublicProducts();

    let filtered = allProducts.filter(product => {
      const matchesCat = CLIENT_STATE.activeCategory === 'all' || product.category === CLIENT_STATE.activeCategory;

      const q = CLIENT_STATE.searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        product.name.toLowerCase().includes(q) ||
        (product.description && product.description.toLowerCase().includes(q)) ||
        product.seller.name.toLowerCase().includes(q) ||
        (product.tags && product.tags.some(t => t.toLowerCase().includes(q)));

      const matchesBuilding = !CLIENT_STATE.selectedBuildingId || 
        (product.seller && product.seller.currentBuildingId === CLIENT_STATE.selectedBuildingId);

      return matchesCat && matchesSearch && matchesBuilding;
    });

    // Tag indicador de filtro por edificio
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
          renderProducts();
        });
      } else {
        activeFilterTag.innerHTML = '';
      }
    }

    // Si no hay productos en la plataforma
    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (allProducts.length === 0) {
          emptyState.innerHTML = `
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
              <i class="fas fa-store"></i>
            </div>
            <h3 class="font-extrabold text-base text-white">Catálogo listo para el Campus CU2</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Actualmente no hay productos registrados. Si eres estudiante y vendes dulces, postres, desayunos o artículos en CU2, crea tu cuenta de vendedor y publica tus productos hoy mismo.
            </p>
            <div class="mt-4">
              <a href="./portal-vendedor.html" class="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/25">
                <i class="fas fa-user-plus"></i> Registrarme como Vendedor CU2
              </a>
            </div>
          `;
        } else {
          emptyState.innerHTML = `
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-2xl">
              <i class="fas fa-search"></i>
            </div>
            <h3 class="font-bold text-base text-slate-200">No encontramos productos con estos filtros</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Prueba cambiando de categoría o seleccionando otro edificio del campus.</p>
          `;
        }
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    grid.innerHTML = filtered.map(prod => {
      const inStock = prod.stock > 0;
      const seller = prod.seller;

      return `
        <div class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group">
          <div class="relative">
            <img src="${prod.image}" alt="${prod.name}" class="w-full h-44 object-cover object-center group-hover:scale-105 transition duration-500 bg-slate-900" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'">
            
            <span class="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md text-amber-400 font-extrabold text-sm px-2.5 py-1 rounded-lg border border-amber-500/30">
              $${prod.price.toFixed(2)} MXN
            </span>

            <span class="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-semibold ${
              inStock ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'bg-red-950/80 text-red-300 border border-red-500/40'
            }">
              ${inStock ? `${prod.stock} disponibles` : 'Agotado'}
            </span>

            ${seller.hasHygieneBadge ? `
              <span class="absolute bottom-2 left-3 bg-sky-950/90 text-sky-300 border border-sky-400/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow">
                <i class="fas fa-shield-alt text-sky-400"></i> Sello Higiene
              </span>
            ` : ''}
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span class="truncate font-semibold text-slate-200">
                  <i class="fas fa-user-circle text-amber-400 mr-1"></i>${seller.name}
                </span>
                <span class="text-[10px] text-sky-400 font-medium">
                  ${seller.faculty ? seller.faculty.split(' ')[0] : 'BUAP'}
                </span>
              </div>

              <h3 class="font-bold text-slate-100 text-base leading-snug line-clamp-1 mb-1" title="${prod.name}">
                ${prod.name}
              </h3>
              
              <p class="text-xs text-slate-400 line-clamp-2 mb-3">
                ${prod.description || 'Producto verificado de estudiante emprendedor.'}
              </p>

              <!-- Ubicación del vendedor en vivo -->
              <div class="bg-slate-900/90 rounded-xl p-2 border border-slate-800 text-[11px] mb-3 space-y-1">
                <div class="flex items-center text-sky-300 truncate">
                  <i class="fas fa-map-pin text-sky-400 mr-1.5 w-3 text-center"></i>
                  <span class="truncate font-medium">${seller.currentLocation || 'Campus CU2'}</span>
                </div>
                <div class="flex items-center text-slate-400 justify-between">
                  <span class="text-[10px] text-slate-400">
                    <i class="fas fa-clock mr-1"></i>Hasta ${seller.availableUntil || '15:00 hrs'}
                  </span>
                  <span class="text-[10px] text-amber-400 font-medium">
                    ${prod.unit}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button class="btn-quick-order flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg shadow-amber-500/20" data-id="${prod.id}">
                <i class="fas fa-shopping-basket"></i> Pedir
              </button>

              ${seller.whatsapp ? `
                <button class="btn-whatsapp bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-2 px-3 rounded-xl text-xs flex items-center justify-center transition" title="Preguntar por WhatsApp" data-whatsapp="${seller.whatsapp}" data-name="${prod.name}">
                  <i class="fab fa-whatsapp text-sm"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Listeners
    grid.querySelectorAll('.btn-quick-order').forEach(btn => {
      btn.addEventListener('click', () => {
        addToCart(btn.getAttribute('data-id'));
      });
    });

    grid.querySelectorAll('.btn-whatsapp').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-whatsapp');
        const prodName = btn.getAttribute('data-name');
        const cleanPhone = num.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola! Vi tu producto "${prodName}" en CampusTrade CU2. ¿Sigue disponible hoy?`)}`;
        window.open(url, '_blank');
      });
    });
  }

  // CARRITO
  function addToCart(productId) {
    const products = window.CampusStore.getPublicProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
      showToast('Este producto se encuentra agotado temporalmente', 'warning');
      return;
    }

    const existing = CLIENT_STATE.cart.find(item => item.productId === productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        showToast(`Stock máximo disponible (${product.stock})`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      CLIENT_STATE.cart.push({
        productId: product.id,
        quantity: 1,
        sellerId: product.sellerId
      });
    }

    saveCart();
    showToast(`¡"${product.name}" añadido al pedido!`, 'success');
  }

  function removeFromCart(productId) {
    CLIENT_STATE.cart = CLIENT_STATE.cart.filter(item => item.productId !== productId);
    saveCart();
    renderCartModal();
  }

  function updateCartQuantity(productId, delta) {
    const item = CLIENT_STATE.cart.find(i => i.productId === productId);
    const products = window.CampusStore.getPublicProducts();
    const product = products.find(p => p.id === productId);
    if (!item || !product) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(productId);
    } else if (newQty > product.stock) {
      showToast(`Stock máximo disponible (${product.stock})`, 'warning');
    } else {
      item.quantity = newQty;
      saveCart();
      renderCartModal();
    }
  }

  function updateCartBadges() {
    const totalCount = CLIENT_STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('.cart-badge-count');
    badges.forEach(b => {
      b.textContent = totalCount;
      if (totalCount > 0) {
        b.classList.remove('hidden');
      } else {
        b.classList.add('hidden');
      }
    });
  }

  // MODAL DE CHECKOUT
  function renderCartModal() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-amount');
    const emptyNotice = document.getElementById('cart-empty-notice');
    const checkoutForm = document.getElementById('cart-checkout-form');
    if (!container || !totalEl) return;

    if (CLIENT_STATE.cart.length === 0) {
      container.innerHTML = '';
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      if (checkoutForm) checkoutForm.classList.add('hidden');
      totalEl.textContent = '$0.00';
      return;
    }

    if (emptyNotice) emptyNotice.classList.add('hidden');
    if (checkoutForm) checkoutForm.classList.remove('hidden');

    let total = 0;
    const products = window.CampusStore.getPublicProducts();

    container.innerHTML = CLIENT_STATE.cart.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return '';
      const subtotal = prod.price * item.quantity;
      total += subtotal;

      return `
        <div class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl border border-slate-800">
          <div class="flex items-center space-x-3">
            <img src="${prod.image}" class="w-12 h-12 rounded-lg object-cover bg-slate-800" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'">
            <div>
              <h4 class="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1">${prod.name}</h4>
              <p class="text-xs text-amber-400 font-semibold">$${prod.price.toFixed(2)} c/u</p>
              <p class="text-[10px] text-slate-400">Vendedor: ${prod.seller ? prod.seller.name : 'Estudiante'}</p>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <div class="flex items-center bg-slate-800 rounded-lg border border-slate-700">
              <button class="btn-qty-minus text-slate-400 hover:text-white px-2 py-1 text-xs" data-id="${prod.id}">-</button>
              <span class="text-xs font-bold px-2 text-white">${item.quantity}</span>
              <button class="btn-qty-plus text-slate-400 hover:text-white px-2 py-1 text-xs" data-id="${prod.id}">+</button>
            </div>
            <button class="btn-cart-remove text-red-400 hover:text-red-300 p-1.5" data-id="${prod.id}">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    totalEl.textContent = `$${total.toFixed(2)} MXN`;

    container.querySelectorAll('.btn-qty-minus').forEach(b => {
      b.addEventListener('click', () => updateCartQuantity(b.getAttribute('data-id'), -1));
    });
    container.querySelectorAll('.btn-qty-plus').forEach(b => {
      b.addEventListener('click', () => updateCartQuantity(b.getAttribute('data-id'), 1));
    });
    container.querySelectorAll('.btn-cart-remove').forEach(b => {
      b.addEventListener('click', () => removeFromCart(b.getAttribute('data-id')));
    });

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
        const option = document.createElement('option');
        option.value = `${b.code}: ${sp}`;
        option.textContent = `${b.code}: ${sp}`;
        optGroup.appendChild(option);
      });

      select.appendChild(optGroup);
    });
  }

  // PROCESAR PEDIDO REAL
  function handleProcessOrder(e) {
    e.preventDefault();

    if (CLIENT_STATE.cart.length === 0) {
      showToast('El carrito está vacío', 'warning');
      return;
    }

    const customerName = document.getElementById('checkout-customer-name')?.value.trim() || 'Estudiante CU2';
    const customerContact = document.getElementById('checkout-customer-contact')?.value.trim() || '';
    const deliveryPoint = document.getElementById('checkout-delivery-point')?.value || 'Explanada EMA 3';
    const deliveryTime = document.getElementById('checkout-delivery-time')?.value || 'Inmediato';
    const paymentMethod = document.getElementById('checkout-payment-method')?.value || 'Efectivo contra entrega';
    const notes = document.getElementById('checkout-notes')?.value.trim() || '';

    const products = window.CampusStore.getPublicProducts();
    const orderItems = [];
    let total = 0;
    let mainSellerId = null;
    let mainSellerWhatsapp = '';

    CLIENT_STATE.cart.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        orderItems.push({
          id: p.id,
          name: p.name,
          quantity: item.quantity,
          price: p.price
        });
        total += p.price * item.quantity;
        if (!mainSellerId) {
          mainSellerId = p.sellerId;
          mainSellerWhatsapp = p.seller.whatsapp || '';
        }
      }
    });

    if (!mainSellerId) {
      showToast('No fue posible identificar al vendedor', 'warning');
      return;
    }

    const res = window.CampusStore.createOrder({
      sellerId: mainSellerId,
      customerName,
      customerContact,
      items: orderItems,
      total,
      deliveryPoint,
      deliveryTime,
      paymentMethod,
      notes
    });

    if (res.success) {
      // Limpiar carrito
      CLIENT_STATE.cart = [];
      saveCart();

      closeModal('cart-modal');
      renderProducts(); // Actualizar stock público

      // Mostrar éxito
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
    const waText = encodeURIComponent(
      `🐺 *PEDIDO CAMPUSTRADE CU2 (#${order.id})*\n\n` +
      `¡Hola! Soy *${order.customerName}*. Acabo de solicitarte el siguiente pedido para entrega en el campus CU2:\n\n` +
      `• ${itemsSummary}\n\n` +
      `💰 *Total:* $${order.total.toFixed(2)} MXN\n` +
      `📍 *Punto Seguro de Entrega:* ${order.deliveryPoint}\n` +
      `🕒 *Horario:* ${order.deliveryTime}\n` +
      `💳 *Método de Pago:* ${order.paymentMethod}\n` +
      `${order.notes ? `📝 *Notas:* ${order.notes}\n` : ''}\n` +
      `¿Me confirmas si puedes entregármelo en ese punto? ¡Gracias!`
    );

    const waBtn = document.getElementById('btn-whatsapp-order');
    if (waBtn) {
      const cleanPhone = (whatsappNumber || '').replace(/[^0-9]/g, '');
      if (cleanPhone) {
        waBtn.href = `https://wa.me/${cleanPhone}?text=${waText}`;
        waBtn.classList.remove('hidden');
      } else {
        waBtn.classList.add('hidden');
      }
    }

    openModal('order-success-modal');
  }

  // MAPA INTERACTIVO
  function renderMapPins() {
    const pinsContainer = document.getElementById('map-pins-overlay');
    if (!pinsContainer) return;

    const products = window.CampusStore.getPublicProducts();

    pinsContainer.innerHTML = window.CU2_BUILDINGS.map(b => {
      const isSelected = CLIENT_STATE.selectedBuildingId === b.id;
      const count = products.filter(p => p.seller && p.seller.currentBuildingId === b.id).length;

      return `
        <div class="map-pin ${isSelected ? 'active' : ''}" style="top: ${b.topPercent}%; left: ${b.leftPercent}%;" data-building-id="${b.id}" title="${b.name}">
          <div class="pin-circle">
            <i class="fas ${b.icon}"></i>
          </div>
          <div class="pin-pulse"></div>
          <div class="bg-slate-900/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none border border-slate-700">
            ${b.code} ${count > 0 ? `(${count})` : ''}
          </div>
        </div>
      `;
    }).join('');

    pinsContainer.querySelectorAll('.map-pin').forEach(pin => {
      pin.addEventListener('click', () => {
        const buildingId = pin.getAttribute('data-building-id');
        selectBuilding(buildingId);
      });
    });
  }

  function selectBuilding(buildingId) {
    if (CLIENT_STATE.selectedBuildingId === buildingId) {
      CLIENT_STATE.selectedBuildingId = null;
    } else {
      CLIENT_STATE.selectedBuildingId = buildingId;
    }

    updateActivePinUI();
    showBuildingDetailCard();
    renderProducts();
  }

  function updateActivePinUI() {
    const pins = document.querySelectorAll('.map-pin');
    pins.forEach(pin => {
      if (pin.getAttribute('data-building-id') === CLIENT_STATE.selectedBuildingId) {
        pin.classList.add('active');
      } else {
        pin.classList.remove('active');
      }
    });
  }

  function showBuildingDetailCard() {
    const card = document.getElementById('building-detail-card');
    if (!card) return;

    if (!CLIENT_STATE.selectedBuildingId) {
      card.classList.add('hidden');
      return;
    }

    const b = window.CU2_BUILDINGS.find(item => item.id === CLIENT_STATE.selectedBuildingId);
    if (!b) return;

    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="p-4 bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl relative">
        <button id="close-building-card" class="absolute top-3 right-3 text-slate-400 hover:text-white p-1">
          <i class="fas fa-times"></i>
        </button>

        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
            <i class="fas ${b.icon}"></i>
          </div>
          <div>
            <span class="text-xs font-bold text-amber-400 tracking-wider uppercase">${b.code}</span>
            <h3 class="font-extrabold text-base text-white leading-tight">${b.name}</h3>
            <p class="text-xs text-sky-300 mb-2">${b.faculty}</p>
            <p class="text-xs text-slate-300 leading-relaxed mb-3">${b.description}</p>
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-800">
          <h4 class="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
            <i class="fas fa-shield-alt text-amber-400"></i> Puntos Limpios de Entrega:
          </h4>
          <ul class="text-xs text-slate-300 space-y-1 mb-3">
            ${b.safePoints.map(sp => `<li class="flex items-center gap-1.5"><i class="fas fa-check-circle text-emerald-400 text-[10px]"></i> ${sp}</li>`).join('')}
          </ul>

          <div class="flex items-center gap-2">
            <button id="btn-filter-here" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex-1 transition">
              <i class="fas fa-search mr-1"></i> Ver productos aquí
            </button>
            <button id="btn-clear-selection" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs transition">
              Cerrar filtro
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-building-card')?.addEventListener('click', () => {
      CLIENT_STATE.selectedBuildingId = null;
      updateActivePinUI();
      showBuildingDetailCard();
      renderProducts();
    });

    document.getElementById('btn-clear-selection')?.addEventListener('click', () => {
      CLIENT_STATE.selectedBuildingId = null;
      updateActivePinUI();
      showBuildingDetailCard();
      renderProducts();
    });

    document.getElementById('btn-filter-here')?.addEventListener('click', () => {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function setupBuildingSelector() {
    const select = document.getElementById('select-building-quick');
    if (!select) return;

    select.innerHTML = '<option value="">Todos los Edificios de CU2</option>' +
      window.CU2_BUILDINGS.map(b => `<option value="${b.id}">${b.code} - ${b.name}</option>`).join('');

    select.addEventListener('change', (e) => {
      CLIENT_STATE.selectedBuildingId = e.target.value || null;
      updateActivePinUI();
      showBuildingDetailCard();
      renderProducts();
    });
  }

  // LISTENERS GENERALES
  function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        CLIENT_STATE.searchQuery = e.target.value;
        renderProducts();
      });
    }

    document.querySelectorAll('[data-view-target]').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const target = trigger.getAttribute('data-view-target');
        switchView(target);
      });
    });

    const checkoutForm = document.getElementById('cart-checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', handleProcessOrder);
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.getAttribute('data-close-modal'));
      });
    });

    document.querySelectorAll('.trigger-open-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        renderCartModal();
        openModal('cart-modal');
      });
    });
  }

  function switchView(viewName) {
    CLIENT_STATE.currentView = viewName;
    const views = ['catalog', 'map', 'docs'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewName) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (viewName === 'map') {
      renderMapPins();
      updateActivePinUI();
    }
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-5 right-5 z-[100] flex flex-col space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200' :
                       type === 'warning' ? 'bg-amber-900/90 border-amber-500 text-amber-200' :
                       'bg-sky-900/90 border-sky-500 text-sky-200';

    toast.className = `p-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-2xl flex items-center space-x-2 transition pointer-events-auto ${colorClass}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

})();
