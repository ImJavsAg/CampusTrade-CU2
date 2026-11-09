// Definiciones del sistema LoboTrade CU2 (BUAP)
// NO se incluyen datos de prueba: el catálogo inicia limpio para producción real.

window.CATEGORIES = [
  { id: 'all', name: 'Todos los Productos', icon: 'fa-border-all' },
  { id: 'dulces', name: 'Gomitas y Botanas', icon: 'fa-candy-cane' },
  { id: 'postres', name: 'Postres Caseros', icon: 'fa-cookie-bite' },
  { id: 'comida', name: 'Comida y Desayunos', icon: 'fa-utensils' },
  { id: 'bebidas', name: 'Bebidas Frías & Café', icon: 'fa-coffee' },
  { id: 'electronica', name: 'Cables & Tech', icon: 'fa-bolt' },
  { id: 'papeleria', name: 'Papelería & Útiles', icon: 'fa-pencil-ruler' }
];

// Almacén inicial vacío (sin productos ni pedidos ficticios)
window.INITIAL_PRODUCTS = [];
window.INITIAL_SELLERS = [];
window.INITIAL_ORDERS = [];