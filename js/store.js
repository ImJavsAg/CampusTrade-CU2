// CampusTrade CU2 - Almacén de Datos y Sistema de Autenticación
// Seguridad de Emprendedores y Transacciones en CU2 BUAP

(function () {
  'use strict';

  const STORAGE_KEYS = {
    SELLERS: 'campustrade_sellers_v2',
    PRODUCTS: 'campustrade_products_v2',
    ORDERS: 'campustrade_orders_v2',
    SESSION: 'campustrade_seller_session_v2',
    CART: 'campustrade_cart_v2'
  };

  // Helper de hashing simple para demostración de seguridad local
  function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + btoa(password.slice(0, 3));
  }

  const Store = {
    // Inicialización del almacén
    init() {
      if (!localStorage.getItem(STORAGE_KEYS.SELLERS)) {
        localStorage.setItem(STORAGE_KEYS.SELLERS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CART)) {
        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
      }
    },

    // Obtener todos los vendedores registrados
    getSellers() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SELLERS)) || [];
      } catch (e) {
        return [];
      }
    },

    // Guardar vendedores
    saveSellers(sellers) {
      localStorage.setItem(STORAGE_KEYS.SELLERS, JSON.stringify(sellers));
    },

    // Registro de nuevo emprendedor estudiantil
    registerSeller({ name, studentId, email, password, faculty, defaultBuilding, whatsapp }) {
      this.init();

      // Validaciones de seguridad y reglamento BUAP
      const cleanEmail = email.trim().toLowerCase();
      const cleanStudentId = studentId.trim();

      if (!name || !cleanStudentId || !cleanEmail || !password || !whatsapp) {
        return { success: false, error: 'Todos los campos obligatorios deben ser completados.' };
      }

      // Validar correo institucional BUAP
      const isBuapEmail = cleanEmail.endsWith('@alm.buap.mx') || cleanEmail.endsWith('@buap.mx') || cleanEmail.endsWith('@correo.buap.mx');
      if (!isBuapEmail) {
        return { 
          success: false, 
          error: 'Por seguridad del campus, debes registrarte con tu correo institucional (@alm.buap.mx o @buap.mx).' 
        };
      }

      if (password.length < 6) {
        return { success: false, error: 'La contraseña debe tener al menos 6 caracteres por seguridad.' };
      }

      const sellers = this.getSellers();

      // Verificar unicidad de correo
      if (sellers.some(s => s.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'Ya existe un emprendedor registrado con este correo institucional.' };
      }

      // Verificar unicidad de matrícula
      if (sellers.some(s => s.studentId === cleanStudentId)) {
        return { success: false, error: 'Esta matrícula ya se encuentra asociada a una cuenta de vendedor.' };
      }

      const newSeller = {
        id: 'vend_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: name.trim(),
        studentId: cleanStudentId,
        email: cleanEmail,
        passwordHash: hashPassword(password),
        faculty: faculty || 'Ing. en Ciencias de la Computación (ICC)',
        defaultBuilding: defaultBuilding || 'ema3',
        currentBuildingId: defaultBuilding || 'ema3',
        currentLocation: 'Campus CU2 - En espera de actualización',
        availableUntil: '15:00 hrs',
        whatsapp: whatsapp.replace(/[^0-9]/g, ''),
        rating: 5.0,
        reviewsCount: 0,
        isVerified: true,
        hasHygieneBadge: true,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      sellers.push(newSeller);
      this.saveSellers(sellers);

      // Iniciar sesión automáticamente
      this.setSession(newSeller);

      return { success: true, seller: this.sanitizeSeller(newSeller) };
    },

    // Inicio de sesión de vendedor
    loginSeller(email, password) {
      this.init();
      const cleanEmail = email.trim().toLowerCase();
      const sellers = this.getSellers();

      const seller = sellers.find(s => s.email.toLowerCase() === cleanEmail);
      if (!seller) {
        return { success: false, error: 'No se encontró ninguna cuenta con este correo institucional.' };
      }

      const expectedHash = hashPassword(password);
      if (seller.passwordHash !== expectedHash) {
        return { success: false, error: 'Contraseña incorrecta. Verifica tus credenciales de acceso.' };
      }

      this.setSession(seller);
      return { success: true, seller: this.sanitizeSeller(seller) };
    },

    // Gestión de sesión activa
    setSession(seller) {
      const sessionData = {
        sellerId: seller.id,
        email: seller.email,
        loginTime: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
    },

    getCurrentSeller() {
      try {
        const sessionRaw = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!sessionRaw) return null;
        const session = JSON.parse(sessionRaw);
        const sellers = this.getSellers();
        const seller = sellers.find(s => s.id === session.sellerId);
        return seller ? this.sanitizeSeller(seller) : null;
      } catch (e) {
        return null;
      }
    },

    logoutSeller() {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    },

    // Ocultar hash de contraseña al exponer el objeto
    sanitizeSeller(seller) {
      const { passwordHash, ...safeSeller } = seller;
      return safeSeller;
    },

    // Actualizar ubicación en vivo del vendedor
    updateSellerLocation(sellerId, { buildingId, locationText, availableUntil }) {
      const sellers = this.getSellers();
      const seller = sellers.find(s => s.id === sellerId);
      if (!seller) return false;

      if (buildingId) seller.currentBuildingId = buildingId;
      if (locationText) seller.currentLocation = locationText.trim();
      if (availableUntil) seller.availableUntil = availableUntil.trim();

      this.saveSellers(sellers);
      return true;
    },

    // GESTIÓN DE PRODUCTOS
    getProducts() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS)) || [];
      } catch (e) {
        return [];
      }
    },

    saveProducts(products) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    },

    // Productos públicos con datos del vendedor adjuntos
    getPublicProducts() {
      this.init();
      const products = this.getProducts();
      const sellers = this.getSellers();

      return products.map(prod => {
        const seller = sellers.find(s => s.id === prod.sellerId);
        return {
          ...prod,
          seller: seller ? this.sanitizeSeller(seller) : {
            name: 'Emprendedor CU2',
            faculty: 'BUAP',
            buildingId: 'ema3',
            currentLocation: 'Campus CU2',
            availableUntil: 'En horario de clases',
            rating: 5.0,
            reviewsCount: 1,
            isVerified: true,
            hasHygieneBadge: true,
            whatsapp: ''
          }
        };
      });
    },

    getSellerProducts(sellerId) {
      const products = this.getProducts();
      return products.filter(p => p.sellerId === sellerId);
    },

    createProduct(sellerId, { name, category, price, unit, stock, image, description, tags }) {
      // Filtro ético y legal BUAP
      const forbiddenKeywords = ['tarea', 'examen', 'tesis', 'ensayo escolar', 'cerveza', 'cigarro', 'vape', 'vodka', 'alcohol', 'droga'];
      const text = `${name} ${description}`.toLowerCase();
      const found = forbiddenKeywords.find(w => text.includes(w));
      if (found) {
        return {
          success: false,
          error: `Contenido no permitido ("${found}"). Está estrictamente prohibida la venta de tareas o sustancias reguladas según la normativa BUAP.`
        };
      }

      const products = this.getProducts();
      const newProduct = {
        id: 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        sellerId: sellerId,
        name: name.trim(),
        category: category || 'dulces',
        price: parseFloat(price) || 0,
        unit: unit.trim() || 'Pieza',
        stock: parseInt(stock, 10) || 1,
        image: image && image.trim() ? image.trim() : 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=600&auto=format&fit=crop&q=80',
        description: description ? description.trim() : '',
        tags: tags ? tags.map(t => t.trim()).filter(Boolean) : ['CU2'],
        createdAt: new Date().toISOString()
      };

      products.unshift(newProduct);
      this.saveProducts(products);
      return { success: true, product: newProduct };
    },

    deleteProduct(sellerId, productId) {
      const products = this.getProducts();
      const filtered = products.filter(p => !(p.id === productId && p.sellerId === sellerId));
      this.saveProducts(filtered);
      return true;
    },

    updateProductStock(productId, delta) {
      const products = this.getProducts();
      const prod = products.find(p => p.id === productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock + delta);
        this.saveProducts(products);
      }
    },

    // GESTIÓN DE PEDIDOS
    getOrders() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS)) || [];
      } catch (e) {
        return [];
      }
    },

    saveOrders(orders) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    },

    getSellerOrders(sellerId) {
      const orders = this.getOrders();
      return orders.filter(o => o.sellerId === sellerId);
    },

    createOrder({ sellerId, customerName, customerContact, items, total, deliveryPoint, deliveryTime, paymentMethod, notes }) {
      const orders = this.getOrders();
      const orderId = 'LOB-' + Math.floor(1000 + Math.random() * 9000);

      const newOrder = {
        id: orderId,
        sellerId: sellerId,
        customerName: customerName || 'Estudiante CU2',
        customerContact: customerContact || '',
        items: items,
        total: total,
        deliveryPoint: deliveryPoint,
        deliveryTime: deliveryTime,
        paymentMethod: paymentMethod,
        notes: notes || '',
        status: 'Pendiente',
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString()
      };

      // Descontar inventario
      items.forEach(it => {
        this.updateProductStock(it.id, -it.quantity);
      });

      orders.unshift(newOrder);
      this.saveOrders(orders);
      return { success: true, order: newOrder };
    },

    updateOrderStatus(sellerId, orderId, newStatus) {
      const orders = this.getOrders();
      const order = orders.find(o => o.id === orderId && o.sellerId === sellerId);
      if (!order) return false;

      order.status = newStatus;
      this.saveOrders(orders);
      return true;
    },

    deleteOrder(sellerId, orderId) {
      const orders = this.getOrders();
      const filtered = orders.filter(o => !(o.id === orderId && o.sellerId === sellerId));
      this.saveOrders(orders);
      return true;
    }
  };

  // Inicializar almacén seguro al cargar
  Store.init();
  window.CampusStore = Store;

})();
