# Zappr ⚡

![License](https://img.shields.io/github/license/pedruhb/Zappr)
![Latest release](https://img.shields.io/github/v/release/pedruhb/Zappr)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)

[Português (Brasil)](README.md) · [English](README.en.md) · **Español**

Cliente de escritorio moderno y de alto rendimiento para WhatsApp Web construido con Electron para **Linux** e **Windows**, con soporte nativo de llamadas de voz y video, compartir pantalla, múltiples cuentas aisladas en pestañas con barra lateral estilo Discord, distribución inteligente de enlaces `whatsapp://`, control granular de audio por sesión y distintivos de mensajes no leídos en tiempo real.

<p align="center">
  <img src="docs/screenshots/whatsapp-qrcode.png" alt="Zappr Interfaz Principal" width="850">
</p>

---

## ✨ Características y Novedades

### 👥 Múltiples Sesiones Aisladas en Pestañas

- **Barra lateral estilo Discord**: Administrá cuentas ilimitadas de WhatsApp simultáneamente en una sola ventana elegante.
- **Aislamiento total de sesión**: Cada pestaña opera dentro de una partición aislada de Electron (`persist:partition`), manteniendo datos, logins y cookies 100% independientes y seguros.
- **Reorganización por Arrastar y Soltar (Drag & Drop)**: Reordená fácilmente tus cuentas en la barra lateral arrastrando los íconos hacia arriba o abajo con indicador visual verde y animación fluida.
- **Sincronización de Foto de Perfil de WhatsApp**: Obtené y aplicá automáticamente la foto oficial de tu perfil de WhatsApp con un solo clic en el editor de sesión o directamente desde el menú contextual de clic derecho.
- **Indicador de Estado (Esperando código QR)**: Distintivo ámbar pulsante en la barra lateral indicando en tiempo real cuando una sesión esté desconectada o esperando lectura del código QR.
- **Recargar Sesión Individual**: Recargá una pestaña puntual desde el menú de clic derecho sin reiniciar toda la aplicación.
- **Identificación visual rápida**: Personalizá el avatar de cada sesión con fotos personalizadas (recorte cuadrado y compresión automática en WebP) o iniciales dinámicas de alto contraste.
- **Cambio instantáneo**: Alternancia ultrarrápida entre pestañas gestionada vía `WebContentsView`, manteniendo bajo el consumo de memoria y conservando todas las conexiones activas en segundo plano.

### 🔴 Badges de Mensajes No Leídos en Tiempo Real

- **Contador individual por sesión**: Cada ícono en la barra lateral muestra un badge con la cantidad exacta de conversaciones no leídas, obtenido directamente de la interfaz de WhatsApp Web.
- **Animación suave de pop**: Efecto _bounce_ al recibir nuevos mensajes para alertarte discretamente.
- **Sincronización global**: Integración con el contador del dock o barra de tareas del sistema operativo.

### 💾 Copia de Seguridad y Restauración

- **Exportación e Importación con un clic**: Guardá el orden de tus sesiones, nombres, avatares, colores y preferencias de enrutamiento de enlaces en un archivo `.json` portable mediante el menú **Configuración > Exportar/Importar**.
- **Migración simple**: Transferí tus cuentas y configuraciones a otra computadora o restaurá copias de seguridad al instante.

### 🔀 Distribuição Inteligente de Enlaces (`whatsapp://` y `wa.me`)

- **Manejador nativo de protocolo**: Zappr se registra en Linux y Windows para interceptar enlaces `whatsapp://` y URLs `wa.me`.
- **Enrutamiento automático a la sesión inactiva por más tiempo**: Activá la opción de asignación automática para distribuir los mensajes entrantes por rotación inteligente (_round-robin_), dirigiendo el contacto a la sesión que hace más tiempo no atiende enlaces.
- **Envío automático con cuenta regresiva**: Editá y previsualizá el mensaje en el modal antes del envío o activá el envío automático con barra de cuenta regresiva y cancelación rápida.
- **Selector moderno con atajos de teclado**:
  - Seleccioná la sesión presionando el número correspondiente (`1` a `6`).
  - Navegá con flechas y confirmá con `Enter` o hacé doble clic sobre el elemento.
  - Ocultá sesiones específicas del selector para evitar envíos accidentales en cuentas personales.

### 🔊 Control de Audio Granular por Sesión

- **Ajuste individual de volumen**: Configurá el volumen de notificaciones de cada cuenta por separado (**100%**, **75%**, **50%**, **25%**, **10%** o **Silenciado**).
- **Silencio rápido con un clic**: Silenciá cualquier cuenta al instante desde el menú de clic derecho.
- **Indicador visual de silencio**: Se muestra un distintivo de altavoz tachado sobre la foto de la sesión silenciada.

### 🎨 Personalización de Colores y Temas

- **Colores independientes**: Asigná un color exclusivo a cada cuenta mediante el selector de colores nativo (con soporte a código HEX o paleta predefinida).
- **Barra de título dinámica**: La barra superior sincroniza su tono automáticamente con el color de la sesión activa.
- **Detalles visuales adaptativos**: Indicadores laterales (_pill_), bordes y sombras _glow_ se ajustan al color elegido.

### 🌐 Soporte Multi-idioma (Predeterminado: Português do Brasil)

- Zappr viene configurado por defecto en **Português do Brasil (`pt-BR`)**, con soporte completo para **Inglés (`en`)** y **Español (`es`)**.
- Cambiá de idioma en cualquier momento desde el menú **Archivo > Idioma** sin necesidad de reiniciar.

### 🔄 Actualizaciones Automáticas y Modal Acerca de

- **Verificador Integrado de Actualizaciones**: Comprobá si hay nuevas versiones disponibles directamente en la ventana Acerca de Zappr con barra de progreso de descarga y notas de versión vía GitHub Releases.

### 💬 Navegación y Enlaces Externos Seguros

- Los enlaces recibidos en los chats (Zoom, Google Meet, YouTube, sitios externos) se abren en tu navegador web predeterminado.
- Menú contextual nativo con opción para copiar enlaces fácilmente.

---

## 📸 Capturas de Pantalla

|                            Interfaz Principal y Múltiples Cuentas                             |                           Edición de Sesión y Foto de WhatsApp                           |
| :-------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------: |
|     <img src="docs/screenshots/whatsapp-qrcode.png" alt="Interfaz Principal" width="420">     |      <img src="docs/screenshots/edit-session.png" alt="Editar Sesión" width="420">       |
|                          **Control Granular de Volumen por Sesión**                           |                     **Personalización de Colores y Barra Dinámica**                      |
| <img src="docs/screenshots/session-settings-volume.png" alt="Control de Volumen" width="420"> | <img src="docs/screenshots/edit-session-color.png" alt="Color de la Sesión" width="420"> |
|                     **Distribución Inteligente de Enlaces (whatsapp://)**                     |                   **Acerca de Zappr y Verificador de Actualizaciones**                   |
|     <img src="docs/screenshots/whatsapp-link.png" alt="Enlaces de WhatsApp" width="420">      |       <img src="docs/screenshots/app-about.png" alt="Acerca de Zappr" width="420">       |

---

## ⌨️ Atajos de Teclado

| Atajo                             | Acción                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| `Ctrl + 1` a `Ctrl + 9`           | Cambiar directamente a la sesión correspondiente                 |
| `Ctrl + N`                        | Añadir una nueva sesión de WhatsApp                              |
| `Ctrl + R` / `F5`                 | Recargar la sesión activa                                        |
| `Ctrl + Shift + R`                | Forzar recarga de la sesión activa (limpia caché de renderizado) |
| `Ctrl + +` / `Ctrl + -`           | Aumentar o disminuir zoom                                        |
| `Ctrl + 0`                        | Restaurar zoom predeterminado (100%)                             |
| `F11`                             | Alternar pantalla completa                                       |
| `1` a `9` _(en modal de enlaces)_ | Elegir sesión para abrir el enlace                               |
| `Enter` _(en modal de enlaces)_   | Abrir enlace en la sesión seleccionada                           |
| `Esc`                             | Cerrar modales y diálogos                                        |

---

## 🚀 Instalación

Descargá la última versión desde la sección de [Releases](https://github.com/pedruhb/Zappr/releases):

### Linux (Ubuntu / Debian / Mint)

```bash
sudo apt install ./zappr_<version>_amd64.deb
```

### Linux (AppImage)

```bash
chmod +x Zappr-*.AppImage
./Zappr-*.AppImage
```

### Windows

Descargá el instalador o ejecutable portátil desde la página de versiones y ejecutalo directamente.

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consultá el archivo [LICENSE](LICENSE) para más información.

_Agradecimiento especial a los contribuidores originales del proyecto TuxChat._
