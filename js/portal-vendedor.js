// CampusTrade CU2 - Lógica del Portal Exclusivo del Vendedor
// Autenticación real (Firebase Authentication), perfil de vendedor, productos y pedidos en Firestore.
// Ya no depende de store.js ni de localStorage.

(function () {
  'use strict';

  // ==========================================================
  // ESTADO
  // ==========================================================
  let currentUser = null;      // Usuario de Firebase Auth
  let currentSeller = null;    // Perfil del vendedor (documento vendedores/{uid})
  let activeTab = 'orders';    // 'orders' o 'products'
  let registering = false;     // Evita que onAuthStateChanged interfiera mientras se crea la cuenta

  let sellerProducts = [];
  let sellerOrders = [];
  let unsubscribeProducts = null;
  let unsubscribeOrders = null;

  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';

  // Filtro ético y legal BUAP
  const FORBIDDEN_KEYWORDS = ['tarea', 'examen', 'tesis', 'ensayo escolar', 'cerveza', 'cigarro', 'vape', 'vodka', 'alcohol', 'droga'];

  const BUAP_EMAIL_REGEX = /^[^\s@]+@(alm\.|correo\.)?buap\.mx$/;

  // ==========================================================
  // UTILIDADES
  // ==========================================================
  // Escapa texto antes de insertarlo con innerHTML (los datos vienen de una base pública)
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function toMillis(ts) {
    // serverTimestamp() llega como null en el snapshot local mientras se confirma en el servidor
    return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
  }

  function formatDate(ts) {
    return new Date(toMillis(ts)).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function onlyDigits(value) {
    return String(value ?? '').replace(/[^0-9]/g, '');
  }

  function categoryName(id) {
    const cat = (window.CATEGORIES || []).find((c) => c.id === id);
    return cat ? cat.name : (id || 'Sin categoría');
  }

  function authErrorMessage(error) {
    switch (error && error.code) {
      case 'auth/email-already-in-use':
        return 'Ya existe un emprendedor registrado con este correo institucional.';
      case 'auth/invalid-email':
        return 'El correo no tiene un formato válido.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Correo o contraseña incorrectos. Verifica tus credenciales de acceso.';
      case 'auth/user-disabled':
        return 'Esta cuenta fue deshabilitada. Contacta a los administradores.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión con Firebase. Revisa tu internet.';
      case 'auth/operation-not-allowed':
        return 'El acceso con correo y contraseña no está activado en Firebase (Authentication → Sign-in method).';
      default:
        return 'No se pudo completar la operación (' + ((error && (error.code || error.message)) || 'error desconocido') + ').';
    }
  }

  // ==========================================================
  // ARRANQUE
  // ==========================================================
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof auth === 'undefined' || typeof db === 'undefined') {
      showAlert('Firebase no está inicializado en esta página. Recarga con Ctrl+Shift+R.', 'error');
      return;
    }

    // Mientras Firebase restaura la sesión no mostramos el login (evita un parpadeo)
    document.getElementById('auth-section')?.classList.add('hidden');

    setupEventListeners();
    auth.onAuthStateChanged(handleAuthChange);
  });

  async function handleAuthChange(user) {
    if (registering) return; // el registro llama a esta función cuando termina

    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const navControls = document.getElementById('nav-user-controls');

    if (!user) {
      currentUser = null;
      currentSeller = null;
      stopListening();
      authSection?.classList.remove('hidden');
      dashboardSection?.classList.add('hidden');
      navControls?.classList.add('hidden');
      return;
    }

    try {
      const snap = await db.collection('vendedores').doc(user.uid).get();
      if (!snap.exists) {
        // Cuenta de Auth sin perfil de vendedor (registro interrumpido)
        await auth.signOut();
        showAlert('Tu cuenta no tiene perfil de vendedor. Regístrate de nuevo con tus datos completos.', 'error');
        return;
      }

      currentUser = user;
      currentSeller = profileToSeller(user.uid, snap.data());

      authSection?.classList.add('hidden');
      dashboardSection?.classList.remove('hidden');
      navControls?.classList.remove('hidden');
      renderDashboard();
    } catch (error) {
      console.error('Error al cargar el perfil del vendedor:', error);
      authSection?.classList.remove('hidden');
      showAlert('No se pudo cargar tu perfil (' + (error.code || error.message) + '). Revisa las reglas de Firestore.', 'error');
    }
  }

  function profileToSeller(uid, data) {
    return {
      id: uid,
      name: data.nombre || '',
      studentId: data.matricula || '',
      email: data.email || (currentUser && currentUser.email) || '',
      faculty: data.facultad || '',
      defaultBuilding: data.edificioBase || 'ema3',
      currentBuildingId: data.edificioActual || data.edificioBase || 'ema3',
      currentLocation: data.ubicacionActual || '',
      availableUntil: data.disponibleHasta || '15:00 hrs',
      whatsapp: data.whatsapp || ''
    };
  }

  // ==========================================================
  // FIRESTORE: ESCUCHAS EN TIEMPO REAL
  // ==========================================================
  function stopListening() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    sellerProducts = [];
    sellerOrders = [];
  }

  function startListening() {
    stopListening();
    if (!currentSeller) return;

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

    unsubscribeOrders = db.collection('pedidos')
      .where('vendedorId', '==', currentSeller.id)
      .onSnapshot((snapshot) => {
        sellerOrders = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.fechaCreacion) - toMillis(a.fechaCreacion));
        renderSellerOrders();
        updateKPIs();
      }, (error) => {
        console.error('Error al escuchar tus pedidos:', error);
        showNotificationToast('No se pudieron cargar tus pedidos (' + (error.code || error.message) + ')', 'error');
      });
  }

  // ==========================================================
  // EVENTOS
  // ==========================================================
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

    // Iniciar sesión
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const pass = document.getElementById('login-password').value;
        const submitBtn = formLogin.querySelector('button[type="submit"]');

        if (submitBtn) submitBtn.disabled = true;
        try {
          await auth.signInWithEmailAndPassword(email, pass);
          hideAlert();
          document.getElementById('login-password').value = '';
          // onAuthStateChanged muestra el panel
        } catch (error) {
          showAlert(authErrorMessage(error), 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Recuperar contraseña
    document.getElementById('btn-forgot-password')?.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      if (!email) {
        showAlert('Escribe tu correo institucional arriba y vuelve a pulsar "¿Olvidaste tu contraseña?".', 'error');
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          showAlert(authErrorMessage(error), 'error');
          return;
        }
      }
      // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados
      showAlert('Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña. Revisa también el spam.', 'success');
    });

    // Registro de vendedor
    const formRegister = document.getElementById('form-register');
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = formRegister.querySelector('button[type="submit"]');

        const name = document.getElementById('reg-name').value.trim();
        const studentId = document.getElementById('reg-studentid').value.trim();
        const whatsapp = onlyDigits(document.getElementById('reg-whatsapp').value);
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const pass = document.getElementById('reg-password').value;
        const faculty = document.getElementById('reg-faculty').value;
        const building = document.getElementById('reg-building').value;

        // Validaciones (las reglas de Firestore vuelven a validar en el servidor)
        if (!name || name.length > 100) return showAlert('Escribe tu nombre completo (máximo 100 caracteres).', 'error');
        if (!/^\d{6,12}$/.test(studentId)) return showAlert('La matrícula debe contener solo números (6 a 12 dígitos).', 'error');
        if (!/^\d{8,15}$/.test(whatsapp)) return showAlert('Escribe un WhatsApp válido, solo números (8 a 15 dígitos).', 'error');
        if (!BUAP_EMAIL_REGEX.test(email)) {
          return showAlert('Por seguridad del campus, debes registrarte con tu correo institucional (@alm.buap.mx o @buap.mx).', 'error');
        }
        if (pass.length < 6) return showAlert('La contraseña debe tener al menos 6 caracteres por seguridad.', 'error');

        if (submitBtn) submitBtn.disabled = true;
        registering = true;
        let cred = null;

        try {
          cred = await auth.createUserWithEmailAndPassword(email, pass);
          const uid = cred.user.uid;
          await cred.user.updateProfile({ displayName: name });

          // Perfil + reserva de matrícula (la matrícula no se puede registrar dos veces)
          const batch = db.batch();
          batch.set(db.collection('matriculas').doc(studentId), { uid });
          batch.set(db.collection('vendedores').doc(uid), {
            nombre: name,
            matricula: studentId,
            email,
            facultad: faculty,
            edificioBase: building,
            edificioActual: building,
            ubicacionActual: 'Campus CU2 - En espera de actualización',
            disponibleHasta: '15:00 hrs',
            whatsapp,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
          });
          await batch.commit();
        } catch (error) {
          console.error('Error en el registro:', error);
          // Si la cuenta de Auth se creó pero el perfil falló, se elimina para no dejar cuentas a medias
          if (cred && cred.user) {
            try { await cred.user.delete(); } catch (e2) { await auth.signOut().catch(() => {}); }
          }
          registering = false;
          if (submitBtn) submitBtn.disabled = false;

          if (error.code === 'permission-denied') {
            showAlert('No se pudo completar el registro: esa matrícula ya está asociada a otra cuenta o los datos no son válidos.', 'error');
          } else {
            showAlert(authErrorMessage(error), 'error');
          }
          return;
        }

        // Correo de verificación (necesario para publicar productos)
        try { await cred.user.sendEmailVerification(); } catch (err) { console.warn('No se pudo enviar el correo de verificación:', err); }

        registering = false;
        if (submitBtn) submitBtn.disabled = false;
        formRegister.reset();
        await handleAuthChange(auth.currentUser);
        showNotificationToast('¡Cuenta creada! Revisa tu correo institucional para verificarla.', 'success');
      });
    }

    // Verificación de correo
    document.getElementById('btn-resend-verification')?.addEventListener('click', async () => {
      if (!currentUser) return;
      try {
        await currentUser.sendEmailVerification();
        showNotificationToast('Correo de verificación reenviado a ' + currentUser.email, 'success');
      } catch (error) {
        showNotificationToast(authErrorMessage(error), 'error');
      }
    });

    document.getElementById('btn-check-verification')?.addEventListener('click', async () => {
      if (!currentUser) return;
      try {
        await currentUser.reload();
        await currentUser.getIdToken(true); // refresca el token para que las reglas vean email_verified = true
        updateVerifyBanner();
        if (currentUser.emailVerified) {
          showNotificationToast('¡Correo verificado! Ya puedes publicar productos.', 'success');
        } else {
          showNotificationToast('Aún no aparece como verificado. Abre el enlace del correo y vuelve a intentarlo.', 'info');
        }
      } catch (error) {
        showNotificationToast(authErrorMessage(error), 'error');
      }
    });

    // Cerrar sesión
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      if (confirm('¿Deseas cerrar tu sesión de vendedor?')) {
        try { await auth.signOut(); } catch (error) { showNotificationToast(authErrorMessage(error), 'error'); }
      }
    });

    // Guardar ubicación en vivo
    const btnSaveLocation = document.getElementById('btn-save-location');
    if (btnSaveLocation) {
      btnSaveLocation.addEventListener('click', async () => {
        if (!currentSeller) return;
        const buildingId = document.getElementById('dash-location-building').value;
        const locationText = document.getElementById('dash-location-text').value.trim().slice(0, 120);
        const availableUntil = document.getElementById('dash-location-time').value.trim().slice(0, 40);

        btnSaveLocation.disabled = true;
        try {
          await db.collection('vendedores').doc(currentSeller.id).update({
            edificioActual: buildingId,
            ubicacionActual: locationText,
            disponibleHasta: availableUntil
          });

          currentSeller.currentBuildingId = buildingId;
          currentSeller.currentLocation = locationText;
          currentSeller.availableUntil = availableUntil;

          // El catálogo público filtra por product.vendedorEdificio:
          // si el vendedor cambia de edificio se actualizan sus productos.
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
          console.error('Error al guardar la ubicación:', error);
          showNotificationToast('No se pudo guardar la ubicación (' + (error.code || error.message) + ')', 'error');
        } finally {
          btnSaveLocation.disabled = false;
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

    // Modal de producto
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

    // Publicar producto (Firestore)
    const formProduct = document.getElementById('form-modal-product');
    if (formProduct) {
      formProduct.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentSeller || !currentUser) {
          alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          window.location.reload();
          return;
        }

        if (!currentUser.emailVerified) {
          alert('Primero verifica tu correo institucional (revisa el aviso amarillo en tu panel).');
          return;
        }

        const nombre = document.getElementById('prod-name').value.trim();
        const descripcion = document.getElementById('prod-description').value.trim();
        const precio = parseFloat(document.getElementById('prod-price').value);
        const stock = parseInt(document.getElementById('prod-stock').value, 10);

        if (!nombre || nombre.length > 120) return alert('El nombre es obligatorio (máximo 120 caracteres).');
        if (!Number.isFinite(precio) || precio <= 0 || precio >= 100000) return alert('Escribe un precio válido mayor a $0.');
        if (!Number.isInteger(stock) || stock < 0 || stock >= 10000) return alert('Escribe un stock válido (entero entre 0 y 9999).');
        if (descripcion.length > 500) return alert('La descripción no puede pasar de 500 caracteres.');

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
          precio,
          unidad: document.getElementById('prod-unit').value.trim().slice(0, 60),
          stock,
          imagen: document.getElementById('prod-image').value.trim(),
          descripcion,
          etiquetas: document.getElementById('prod-tags').value.trim().slice(0, 200),

          // Datos del vendedor (las reglas comprueban que coincidan con tu perfil)
          vendedorId: currentSeller.id,
          vendedorNombre: currentSeller.name,
          vendedorWhatsapp: currentSeller.whatsapp,
          vendedorEdificio: document.getElementById('dash-location-building')?.value || currentSeller.defaultBuilding,

          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          await db.collection('productos').add(nuevoProducto);
          closeProductModal();
          showNotificationToast(`¡"${nuevoProducto.nombre}" publicado en el catálogo público de CU2!`, 'success');
          // No hace falta refrescar: el listener actualiza la lista solo.
        } catch (error) {
          console.error('Error al guardar en Firebase:', error);
          alert('No se pudo publicar el producto: ' + (error.code || error.message));
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  // ==========================================================
  // RENDER DEL PANEL
  // ==========================================================
  function updateVerifyBanner() {
    const banner = document.getElementById('verify-banner');
    if (!banner || !currentUser) return;
    const emailEl = document.getElementById('verify-banner-email');
    if (emailEl) emailEl.textContent = currentUser.email || '';
    banner.classList.toggle('hidden', currentUser.emailVerified === true);
  }

  function renderDashboard() {
    if (!currentSeller) return;

    document.getElementById('dash-seller-name').textContent = currentSeller.name;
    document.getElementById('dash-seller-faculty').innerHTML = `<i class="fas fa-graduation-cap text-amber-400 mr-1"></i>${esc(currentSeller.faculty)}`;
    document.getElementById('dash-seller-id').innerHTML = `<i class="fas fa-id-card text-sky-400 mr-1"></i>Matrícula: ${esc(currentSeller.studentId)}`;
    document.getElementById('dash-seller-email').innerHTML = `<i class="fas fa-envelope text-indigo-400 mr-1"></i>${esc(currentSeller.email)}`;
    document.getElementById('dash-seller-phone').innerHTML = `<i class="fab fa-whatsapp text-emerald-400 mr-1"></i>${esc(currentSeller.whatsapp)}`;

    const selectBuilding = document.getElementById('dash-location-building');
    const inputLoc = document.getElementById('dash-location-text');
    const inputTime = document.getElementById('dash-location-time');

    if (selectBuilding) selectBuilding.value = currentSeller.currentBuildingId || 'ema3';
    if (inputLoc) inputLoc.value = currentSeller.currentLocation || '';
    if (inputTime) inputTime.value = currentSeller.availableUntil || '15:00 hrs';

    updateVerifyBanner();
    renderSellerOrders();
    renderSellerProducts();
    updateKPIs();
    startListening();
  }

  // ==========================================================
  // PEDIDOS (Firestore: colección "pedidos")
  // ==========================================================
  function renderSellerOrders() {
    if (!currentSeller) return;

    const orders = sellerOrders;
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
      const estado = order.estado || 'Pendiente';
      const isPreparing = estado === 'En preparación';
      const isReady = estado === 'Listo para entrega';
      const isDelivered = estado === 'Entregado';
      const isCancelled = estado === 'Cancelado';

      const statusColor = isDelivered ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
                          isReady ? 'bg-sky-950 text-sky-300 border-sky-500/40' :
                          isPreparing ? 'bg-purple-950 text-purple-300 border-purple-500/40' :
                          isCancelled ? 'bg-red-950 text-red-300 border-red-500/40' :
                          'bg-amber-950 text-amber-300 border-amber-500/40';

      const customerPhone = onlyDigits(order.compradorContacto);
      const waMsg = encodeURIComponent(`Hola ${order.compradorNombre}, sobre tu pedido #${order.codigo} en CampusTrade CU2...`);
      const items = Array.isArray(order.items) ? order.items : [];

      return `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-black text-amber-400 text-xs tracking-wider">#${esc(order.codigo)}</span>
            <span class="text-[10px] text-slate-500">${esc(formatDate(order.fechaCreacion))}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusColor}">
              ${esc(estado)}
            </span>
          </div>

          <div class="text-xs text-slate-200">
            <p><strong>Comprador:</strong> ${esc(order.compradorNombre)}</p>
            <p class="text-sky-300"><strong>Punto de Entrega:</strong> ${esc(order.puntoEntrega)}</p>
            <p class="text-slate-400"><strong>Horario:</strong> ${esc(order.horarioEntrega)}</p>
            <p class="text-amber-400/90"><strong>Pago:</strong> ${esc(order.metodoPago)}</p>
            ${order.notas ? `<p class="text-[11px] text-slate-400 italic">Notas: "${esc(order.notas)}"</p>` : ''}
          </div>

          <div class="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
            ${items.map((it) => `
              <div class="flex justify-between text-slate-300">
                <span>${esc(it.cantidad)}x ${esc(it.nombre)}</span>
                <span class="font-bold text-amber-400">$${((Number(it.precio) || 0) * (Number(it.cantidad) || 0)).toFixed(2)}</span>
              </div>
            `).join('')}
            <div class="pt-1.5 border-t border-slate-800 flex justify-between font-extrabold text-white text-xs">
              <span>Total a Cobrar:</span>
              <span class="text-amber-400">$${(Number(order.total) || 0).toFixed(2)} MXN</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <button class="btn-change-status bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-purple-500/30 transition" data-id="${esc(order.id)}" data-status="En preparación">
              Aceptar y preparar
            </button>
            <button class="btn-change-status bg-sky-900/60 hover:bg-sky-800 text-sky-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-sky-500/30 transition" data-id="${esc(order.id)}" data-status="Listo para entrega">
              Listo en Punto
            </button>
            <button class="btn-change-status bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition" data-id="${esc(order.id)}" data-status="Entregado">
              Entregado
            </button>
            <button class="btn-change-status bg-red-900/50 hover:bg-red-800 text-red-200 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-red-500/30 transition" data-id="${esc(order.id)}" data-status="Cancelado">
              Cancelar
            </button>

            ${customerPhone ? `
              <a href="https://wa.me/${customerPhone}?text=${waMsg}" target="_blank" rel="noopener" class="bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-500/30 transition ml-auto flex items-center gap-1">
                <i class="fab fa-whatsapp"></i> Chat
              </a>
            ` : ''}

            <button class="btn-delete-order text-slate-500 hover:text-red-400 p-1 ${customerPhone ? '' : 'ml-auto'}" data-id="${esc(order.id)}" title="Eliminar registro">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-change-status').forEach((btn) => {
      btn.addEventListener('click', () => {
        const order = sellerOrders.find((o) => o.id === btn.getAttribute('data-id'));
        if (order) changeOrderStatus(order, btn.getAttribute('data-status'));
      });
    });

    container.querySelectorAll('.btn-delete-order').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const order = sellerOrders.find((o) => o.id === btn.getAttribute('data-id'));
        if (!order) return;
        if (!confirm(`¿Eliminar el pedido #${order.codigo}?`)) return;
        try {
          await db.collection('pedidos').doc(order.id).delete();
        } catch (error) {
          console.error('Error al eliminar pedido:', error);
          showNotificationToast('No se pudo eliminar el pedido (' + (error.code || error.message) + ')', 'error');
        }
      });
    });
  }

  // Cambia el estado de un pedido. El inventario se descuenta cuando el vendedor ACEPTA el pedido
  // (cualquier estado distinto de Pendiente/Cancelado) y se devuelve si luego lo cancela.
  // Todo ocurre en una transacción para que stock y pedido nunca queden desincronizados.
  async function changeOrderStatus(order, newStatus) {
    if (!currentSeller) return;
    const orderRef = db.collection('pedidos').doc(order.id);
    const uid = currentSeller.id;
    let message = `Pedido #${order.codigo} marcado como: ${newStatus}`;

    try {
      await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) throw new Error('El pedido ya no existe.');

        const data = orderSnap.data();
        const alreadyDeducted = data.stockDescontado === true;
        const shouldDeduct = newStatus !== 'Pendiente' && newStatus !== 'Cancelado' && !alreadyDeducted;
        const shouldRestore = newStatus === 'Cancelado' && alreadyDeducted;

        const updates = { estado: newStatus };

        if (shouldDeduct || shouldRestore) {
          const items = Array.isArray(data.items) ? data.items : [];
          const refs = items.map((it) => db.collection('productos').doc(it.productoId));
          const snaps = await Promise.all(refs.map((r) => tx.get(r))); // todas las lecturas antes de escribir

          const changes = [];
          snaps.forEach((snap, i) => {
            // Se ignoran productos borrados o que no son tuyos
            if (!snap.exists || snap.data().vendedorId !== uid) return;
            const qty = parseInt(items[i].cantidad, 10) || 0;
            if (qty <= 0) return;

            if (shouldDeduct) {
              const available = parseInt(snap.data().stock, 10) || 0;
              if (available < qty) {
                throw new Error(`Stock insuficiente de "${items[i].nombre}" (hay ${available}, el pedido pide ${qty}). Ajusta tu inventario primero.`);
              }
            }
            changes.push({ ref: refs[i], delta: shouldDeduct ? -qty : qty });
          });

          changes.forEach((c) => tx.update(c.ref, { stock: firebase.firestore.FieldValue.increment(c.delta) }));
          updates.stockDescontado = shouldDeduct;
          message += shouldDeduct ? ' (inventario descontado)' : ' (inventario devuelto)';
        }

        tx.update(orderRef, updates);
      });

      showNotificationToast(message, 'info');
    } catch (error) {
      console.error('Error al cambiar el estado del pedido:', error);
      showNotificationToast(error.code ? 'No se pudo actualizar el pedido (' + error.code + ')' : error.message, 'error');
    }
  }

  // ==========================================================
  // PRODUCTOS (Firestore: colección "productos")
  // ==========================================================
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

    const totalDelivered = sellerOrders
      .filter((o) => o.estado === 'Entregado')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const pendingOrders = sellerOrders
      .filter((o) => o.estado !== 'Entregado' && o.estado !== 'Cancelado').length;

    const kpiSales = document.getElementById('kpi-sales-amount');
    const kpiPending = document.getElementById('kpi-pending-orders');
    const kpiProducts = document.getElementById('kpi-products-count');

    if (kpiSales) kpiSales.textContent = `$${totalDelivered.toFixed(2)}`;
    if (kpiPending) kpiPending.textContent = pendingOrders;
    if (kpiProducts) kpiProducts.textContent = sellerProducts.length;
  }

  // ==========================================================
  // ALERTAS Y NOTIFICACIONES
  // ==========================================================
  function showAlert(msg, type = 'error') {
    const alertEl = document.getElementById('auth-alert');
    if (!alertEl) return;

    // Si el login está oculto (sesión restaurándose), mostrarlo para que se lea el mensaje
    document.getElementById('auth-section')?.classList.remove('hidden');

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