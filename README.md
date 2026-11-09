# 🐺 CampusTrade CU2 (BUAP)
> **Proyecto de Innovación Tecnológica y Retribución Social**  
> **Carrera:** Ingeniería en Ciencias de la Computación (ICC) — Benemérita Universidad Autónoma de Puebla  
> **Sede:** Ciudad Universitaria 2 (CU2 - Ecocampus Valsequillo)

---

## 🌟 Descripción General
**CampusTrade CU2** es una plataforma web y aplicación progresiva (**PWA**) para la comunidad universitaria de la **BUAP en CU2**. Digitaliza, organiza y asegura el microemprendimiento estudiantil con:
1. **Catálogo Público de Estudiantes:** Los compradores exploran productos reales publicados por vendedores verificados y coordinan entregas en puntos limpios de CU2.
2. **Portal Apartado y Protegido para Vendedores:** Módulo independiente con autenticación (correo institucional `@alm.buap.mx`, matrícula y contraseña), donde el vendedor gestiona sus pedidos, ganancias e inventario en privado.
3. **Cero Datos de Prueba:** El sistema arranca limpio para producción real. Solo aparecen productos que los estudiantes registrados publiquen.
4. **Servidor Web Incorporado:** Ejecutable localmente con `start-server.bat` o desplegable en la nube con Netlify / Vercel en un clic.

---

## 🚀 Arquitectura y Módulos

```text
AntigravityCodeGem/
├── index.html                  # Tienda pública para compradores y mapa interactivo
├── portal-vendedor.html        # Portal privado y exclusivo para emprendedores
├── server.js                   # Servidor Web HTTP nativo Node.js (puerto 3000)
├── start-server.bat            # Script para iniciar el servidor local con un clic
├── netlify.toml                # Configuración de despliegue en la nube
├── manifest.json               # Configuración PWA para instalación móvil
├── service-worker.js           # Soporte offline y caché
├── assets/
│   ├── cu2-map.jpg             # Mapa oficial de CU2 Valsequillo
│   └── logo.svg                # Logotipo oficial Lobo CampusTrade
├── css/
│   └── styles.css              # Estilos responsivos, glassmorphism y pines del mapa
├── js/
│   ├── store.js                # Almacén de datos, cifrado y sesiones de vendedor
│   ├── map-data.js             # Coordenadas de edificios y puntos limpios de CU2
│   ├── initial-data.js         # Categorías (sin datos ficticios de prueba)
│   ├── portal-vendedor.js      # Lógica del dashboard y autenticación de vendedores
│   └── app.js                  # Lógica del catálogo público, carrito y pedidos
└── docs/
    ├── PROYECTO_INNOVACION_CAMPUSTRADE_CU2_BUAP.md # Justificación académica
    └── REQUISITOS_Y_PUBLICACION_SITIO_WEB.md       # Requisitos de hosting y dominio
```

---

## 💻 Cómo Iniciar el Sitio Web

### 1. En tu computadora (Servidor Local)
Haz doble clic en [start-server.bat](file:///c:/Users/javie/Documents/AntigravityCodeGem/start-server.bat).
* Se iniciará el servidor en: `http://localhost:3000`
* Enlace en tu red Wi-Fi para celulares: `http://[TU_IP]:3000`
* Portal exclusivo de vendedores: `http://localhost:3000/portal-vendedor.html`

### 2. Publicar en Internet Gratis (Netlify)
1. Ve a [https://app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta del proyecto.
3. Obtendrás tu URL pública con HTTPS gratis (ej. `https://campustrade-cu2.netlify.app`) en 30 segundos.
