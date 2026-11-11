---
title: Política de privacidad - Your Personal Diary
description: Cómo guarda y protege tus datos Your Personal Diary (las aplicaciones para Android, Windows, Mac y iPhone y el sitio web; la de iPhone, cuando se publique).
languages: Idiomas
otherPage: Cómo eliminar tu cuenta
---

# Política de privacidad - Your Personal Diary

Fecha de entrada en vigor: {{EFFECTIVE_DATE}}

## En resumen

- Your Personal Diary es un único servicio con cinco formas de acceso: la **aplicación para Android** (Google Play), la **aplicación para Windows** (Microsoft Store o un archivo de instalación), la **aplicación para Mac** (una descarga o el Mac App Store), la **aplicación para iPhone** (App Store, cuando se publique) y el **sitio web** [{{SITE_URL}}]({{SITE_URL}}). Todas usan el mismo servidor y la misma cuenta.
- Tu diario se guarda en nuestro servidor en un archivo cifrado con una clave derivada de tu contraseña. Los datos de tu cuenta también se guardan allí.
- Usamos tus datos solo para que tu diario funcione. Sin publicidad, sin analítica, sin seguimiento, y no vendemos ni compartimos tus datos.
- Conoce los límites: mientras tienes la sesión iniciada, el servidor tiene tu diario abierto en su memoria, y quien opera el servidor podría, técnicamente, restablecer tu contraseña y leer tu diario. La sección 4 lo explica con claridad.
- Puedes eliminar tu cuenta y tu diario en cualquier momento en **Ajustes - Eliminar la cuenta**.

## 1. Quiénes somos

El servicio lo opera {{PUBLISHER_NAME}} ("nosotros"), responsable de tus datos personales (el "responsable del tratamiento"). Contacto: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Esta política se aplica a la aplicación para Android, a la aplicación para Windows, a la aplicación para Mac, a la aplicación para iPhone (cuando se publique) y al sitio web. Muestran el mismo diario y siguen las mismas reglas; cuando una aplicación se comporta de otra manera, esta política lo indica.

## 2. Qué guardamos en el servidor y dónde

El servidor funciona en el proveedor de alojamiento Fly.io, en su centro de datos de **Fráncfort, Alemania (Unión Europea)**. Guarda:

- **Datos de la cuenta:** tu nombre, apellidos, nombre de usuario y dirección de correo electrónico, un identificador de cuenta, el idioma en que usas la aplicación, cuándo se creó la cuenta y cuándo iniciaste sesión por última vez. Al crear la cuenta, también guardamos un registro de tu confirmación de que has leído esta política y las [Condiciones de uso]({{TERMS_URL}}) y las aceptas: el momento de la confirmación y las fechas de entrada en vigor de las versiones que confirmaste. Si cambias tu dirección de correo, la dirección anterior y la fecha del cambio se conservan con la cuenta hasta que vuelvas a cambiarla o elimines la cuenta. La aplicación no cifra estos datos porque el servidor los necesita para que inicies sesión y para escribirte, así que quien opera el servidor puede verlos.
- **Tu contraseña:** no se guarda. El servidor solo conserva un valor derivado de ella (scrypt) que le permite comprobarla.
- **Tu diario:** las entradas (texto y los campos opcionales estado de ánimo, emociones, energía, estrés, sueño, actividad física, acontecimientos, personas, lugar, notas y etiquetas), los hábitos y sus registros, y tus ajustes. Cada cuenta tiene su propio archivo de diario cifrado.
- **Sesiones:** para cada dispositivo en el que tienes la sesión iniciada: el tipo de dispositivo ("Ordenador", "Teléfono" o "Navegador"), cuándo empezó la sesión, cuándo se usó por última vez y cuándo termina. El token de sesión solo se guarda como hash. Con "Recordarme", la sesión también contiene la clave de tu diario, cifrada con la clave del servidor (sección 4).
- **Solicitudes de restablecimiento de contraseña:** un hash del enlace y del código, válidos durante 30 minutos y de un solo uso.
- **La clave de las copias sin conexión** de tus dispositivos (sección 5), guardada dentro de tu diario cifrado.
- **Los ajustes de envío de correo del operador** (la propia cuenta de Gmail del operador, con su contraseña guardada cifrada). No contienen nada sobre ti.
- **Un registro técnico** de los eventos de arranque y de los errores. No contiene contenido del diario, ni direcciones de correo, ni direcciones IP.

**El recorrido** ("Omitir - solo quiero mirar", en la aplicación para Android) crea un diario de invitado temporal con datos de ejemplo. Solo existe en la memoria del servidor, termina solo al cabo de 30 minutos y nunca se guarda.

Como en cualquier sitio web, el servidor y el proveedor de alojamiento reciben la dirección IP de tu dispositivo cuando se conecta. El servidor la usa solo en su memoria: para limitar cuántas solicitudes pueden llegar desde una misma red (inicio de sesión, registro y las demás funciones de la cuenta, restablecimiento de contraseña, el recorrido y las copias de seguridad) y para el bloqueo del inicio de sesión. Estos contadores abarcan como mucho las últimas 24 horas, y la dirección nunca se escribe en el registro ni en el almacenamiento.

## 3. Cómo usamos tus datos

- **Para prestar el servicio:** iniciar sesión, guardar tu diario y mantenerlo igual en todos tus dispositivos, la búsqueda, las estadísticas y las conclusiones sobre tus propias entradas, las copias de seguridad, las exportaciones y los recordatorios. Las preguntas de búsqueda se responden en el servidor y no se guardan en él.
- **Correo electrónico:** solo para tus mensajes de restablecimiento de contraseña y para avisos de seguridad (tu contraseña se cambió con un mensaje de restablecimiento; la dirección de correo de tu cuenta se cambió). Se escriben en el idioma guardado con los datos de tu cuenta; el servidor no abre tu diario para escribirlos. Sin boletines ni marketing.
- **Nunca:** ni publicidad, ni herramientas de analítica o seguimiento, ni elaboración de perfiles, ni venta de datos, ni uso de tu diario para entrenar ninguna IA.

Base jurídica (para usuarios de la Unión Europea y leyes similares): tratamos tus datos para prestar el servicio en el que te registraste (ejecución de un contrato, artículo 6.1.b del RGPD) y para mantenerlo seguro (nuestro interés legítimo, artículo 6.1.f: límites de intentos, bloqueos, el registro técnico). Tu diario puede contener información sensible, por ejemplo sobre tu salud o tus creencias, si decides escribirla. La tratamos solo para guardártela y mostrártela, porque nos lo pediste al escribirla (tu consentimiento explícito, artículo 9.2.a); puedes eliminarla en cualquier momento editando o borrando entradas (la sección 7 indica cómo se borra el texto antiguo).

## 4. Cómo se protege tu diario y de qué no te protege

Qué lo protege:

- El archivo de diario de cada cuenta está cifrado con AES-256-GCM. La clave se deriva de tu contraseña con scrypt. Cualquier cambio en el archivo se detecta.
- Los discos del proveedor de alojamiento también están cifrados (cifrado en reposo).
- Todas las conexiones entre tus dispositivos y el servidor usan HTTPS (TLS).

Lo que debes saber:

- **Mientras tienes la sesión iniciada, tu diario está descifrado en la memoria del servidor**, para que el servidor pueda mostrarlo, buscar en él y analizarlo por ti. No es cifrado "de extremo a extremo".
- **Quien opera el servidor puede, técnicamente, restablecer cualquier contraseña.** Para que "¿Has olvidado la contraseña?" funcione sin perder tu diario, el servidor guarda para cada cuenta una copia de la clave del diario, cifrada con una clave del servidor (una "clave de recuperación"). La clave del servidor se guarda como secreto de la plataforma de alojamiento, fuera de los archivos almacenados, de modo que una copia de los archivos por sí sola no abre nada. Aun así, quien controla el servidor y sus secretos -el operador y, en principio, el proveedor de alojamiento- podría restablecer la contraseña de cualquier cuenta y leer su diario sin conocer la contraseña. Nos comprometemos a no hacerlo. No tenemos ninguna herramienta para ello, y nuestras herramientas de administración nunca abren un diario. Si no estás dispuesto a confiar en este compromiso, no guardes en el servicio nada que no quieras que lea otra persona.
- **Una solicitud para restablecer la contraseña no abre tu diario.** El mensaje de restablecimiento y los avisos de seguridad se escriben en el idioma guardado con los datos de tu cuenta (sección 2), así que una solicitud -tuya o de cualquiera que escriba tu dirección de correo- deja tu diario cerrado. Solo cuando el restablecimiento se completa con el enlace o el código del mensaje, el servidor abre tu diario con la clave de recuperación, para volver a cifrarlo con tu nueva contraseña.

## 5. Qué se guarda en tu dispositivo

En cada dispositivo en el que usas el servicio:

- tu token de sesión (para que sigas con la sesión iniciada), el último nombre de usuario, tus preferencias de idioma y de visualización, y tus preguntas de búsqueda recientes (se borran al cerrar la sesión).

**Sin conexión.** Si la aplicación no puede llegar al servidor, sigue funcionando: lo que escribes se guarda en tu dispositivo, cifrado, y se sube al servidor automáticamente cuando vuelve la conexión, aunque la aplicación se haya cerrado entretanto. En las aplicaciones para Windows, Mac, Android y iPhone, si elegiste "Recordarme", la aplicación también guarda una copia cifrada de lo que te mostró recientemente (las entradas recientes, los hábitos, los datos de hoy, el mes del calendario y tus ajustes) para que puedas leerlo sin conexión; si no, esa copia solo existe en memoria mientras la aplicación está abierta. El servidor guarda la clave de estas copias dentro de tu diario cifrado; con "Recordarme", las aplicaciones para Windows, Mac, Android y iPhone también la guardan en el dispositivo, protegida por la protección de datos de Windows, por el Keychain de macOS, por el Android Keystore o por el Keychain de iOS, para que la aplicación pueda abrirse sin conexión. Tu contraseña y tu clave de recuperación nunca se guardan en el dispositivo. En las aplicaciones que guardan esa clave en el dispositivo con "Recordarme", la aplicación también guarda una copia de ella cifrada con una clave derivada de tu contraseña, para que puedas desbloquear la aplicación sin conexión escribiendo tu contraseña; la contraseña en sí no se guarda, y esta copia se borra junto con la clave: cuando cierras la sesión, cuando la sesión termina o cuando se elimina la cuenta. Alguien con una copia de los datos de este dispositivo podría intentar adivinar tu contraseña contra esa copia sin necesitar tu cuenta de usuario del dispositivo, con un coste por intento igual que contra el servidor pero sin límite en el número de intentos; lo que la protege es una contraseña fuerte. Para que cada cambio se suba exactamente una vez, la aplicación también guarda, cifrado, un registro de los cambios que subió en los últimos 7 días.

- **Aplicación para Windows:** estas copias se guardan en las carpetas de datos de la aplicación dentro de tu perfil de usuario de Windows (en la versión de Microsoft Store, en la carpeta del propio paquete de la aplicación). La clave está protegida por la protección de datos de Windows (DPAPI) y solo funciona para tu usuario de Windows.
- **Aplicación para Android:** estas copias se guardan en el almacenamiento privado de la aplicación, que otras aplicaciones no pueden leer y que queda excluido de las copias de seguridad. La clave está protegida por el Android Keystore.
- **Aplicación para Mac:** estas copias se guardan en la carpeta de la aplicación dentro de la Biblioteca (Library) de tu usuario (Application Support/app.yourpersonaldiary.mac). La clave se guarda como un elemento del llavero de inicio de sesión (login keychain) de tu usuario de Mac, con el nombre "Your Personal Diary offline key", y nunca se sincroniza con iCloud Keychain; está protegida por la contraseña con la que inicias sesión en el Mac y solo la aplicación puede leerla. Una copia de tu cuenta de usuario hecha con Migration Assistant o con Time Machine lleva el elemento, que sigue protegido por esa contraseña. Cuando la aplicación se distribuya con la firma de Apple, el elemento pasará al llavero que se queda solo en este Mac.
- **Aplicación para iPhone:** estas copias se guardan en el almacenamiento privado de la aplicación, excluido de la copia de seguridad de iCloud. La clave se guarda en el Keychain de iOS, disponible solo en este dispositivo después de que se haya desbloqueado una vez, y se elimina cuando cierras la sesión.
- **Sitio web:** en el navegador solo se guardan, cifrados, los cambios que aún no se han subido, el registro de los últimos 7 días y los avisos sobre cambios en conflicto (ver más abajo), pero ninguna copia de lo que has leído; la clave se queda en memoria y desaparece al cerrar la página.

Cuando vuelve la conexión, la aplicación sube los cambios que hiciste, en el orden en que los hiciste, cada uno exactamente una vez. Si la misma entrada, hábito o ajuste también se cambió en otro dispositivo, se conserva el cambio más reciente y la aplicación te lo dice en una línea; la otra versión sigue disponible para ti en este dispositivo hasta que cierres el aviso.

Si la aplicación ofrece desbloquear con el bloqueo de pantalla de tu dispositivo (Windows Hello, Touch ID o la contraseña del Mac, Face ID / Touch ID o el código del iPhone, o el bloqueo de pantalla o la huella de Android), la comprobación la hace el sistema operativo. Nada sobre tu huella, tu cara o tu PIN llega a la aplicación ni a nosotros. Los recordatorios de hábitos de las aplicaciones para Android y iPhone se programan en el propio dispositivo; no interviene ningún servicio de notificaciones push.

Archivos que creas tú: una **copia de seguridad** está cifrada con una contraseña; una **exportación** (TXT, CSV, JSON o PDF) es un archivo normal y legible. Tú decides dónde guardarlos, y cualquiera que obtenga un archivo exportado puede leerlo.

## 6. Quién más recibe datos

Usamos dos proveedores de servicios. Tratan los datos solo por cuenta nuestra, para hacer funcionar el servicio:

- **Fly.io, Inc.** (Estados Unidos): alojamiento del servidor en Fráncfort, Alemania. Sus sistemas contienen los archivos de diario cifrados, los datos de las cuentas y el resto de los datos de la sección 2, y reciben datos de conexión como las direcciones IP. Como Fly.io es una empresa estadounidense, puede acceder a los datos desde fuera de la Unión Europea; esto está cubierto por sus condiciones de tratamiento de datos. Su política de privacidad: `fly.io/legal/privacy-policy`.
- **Google (Gmail)**: envía los mensajes de restablecimiento de contraseña y los avisos de seguridad. Google recibe el mensaje, tu dirección de correo, y el nombre y el nombre de usuario que contiene. Un mensaje nunca contiene nada de tu diario. Política de privacidad de Google: `policies.google.com/privacy`.

Las tiendas de aplicaciones también tratan datos según sus propias políticas de privacidad cuando descargas las aplicaciones: **Google Play** para la aplicación para Android, **Microsoft Store** para la aplicación para Windows, y el **App Store** y el **Mac App Store** (Apple) para las aplicaciones para iPhone y Mac (por ejemplo, instalaciones, valoraciones e informes de errores que recogen sus sistemas). Las aplicaciones no contienen código de ellas ni de nadie más que les envíe datos.

No vendemos, alquilamos ni compartimos tus datos personales con nadie más. Solo revelaríamos datos si la ley lo exigiera.

## 7. Cuánto tiempo conservamos los datos y cómo eliminarlos

- Conservamos tu cuenta y tu diario hasta que los elimines. Las sesiones terminan al cabo de 12 horas, o de 90 días con "Recordarme". Las solicitudes de restablecimiento de contraseña caducan a los 30 minutos. Las copias de un dispositivo se mantienen hasta que cierras la sesión en ese dispositivo.
- **Eliminar tu cuenta en la aplicación o en el sitio web:** inicia sesión, abre **Ajustes - Eliminar la cuenta**, introduce tu contraseña y confirma. Esto elimina de inmediato del servidor tu cuenta, tu diario, tus hábitos y tus ajustes, tu sesión en todos los dispositivos y cualquier solicitud de restablecimiento de contraseña, y elimina la copia sin conexión del dispositivo que usas. Los cambios que aún esperan en tus otros dispositivos ya no se podrán subir y se perderán.
- **Copias en las copias de seguridad del servidor:** el proveedor de alojamiento hace una instantánea diaria del almacenamiento del servidor. Las copias de una cuenta eliminada en esas instantáneas se borran automáticamente en un plazo de 30 días.
- **Archivos cifrados del servidor:** para poder recuperarse de un desastre, quien opera el servidor hace aproximadamente una vez al mes una copia cifrada de todo el almacenamiento del servidor (un "archivo del servidor"); el servidor guarda solo los 2 más recientes, y quien lo opera guarda como máximo los 3 más recientes sin conexión, en una unidad no conectada a internet, de modo que las copias de una cuenta eliminada desaparecen de ellos a medida que los sustituyen otros más recientes, normalmente en un plazo de tres meses.
- **Las entradas borradas o modificadas** desaparecen de la aplicación al instante, y su texto antiguo se borra del archivo de tu diario en el servidor cuando se guarda el cambio, un momento después: el servidor sobrescribe los datos borrados en lugar de solo marcar el espacio como libre. La versión anterior del archivo, que el servidor conserva por si falla un guardado, se sustituye en el siguiente guardado. El texto borrado antes de que existiera esta protección se borra la primera vez que se abre tu diario después de la actualización (por ejemplo, cuando inicias sesión). En el servidor, las versiones anteriores quedan después solo en las instantáneas diarias del almacenamiento, durante un máximo de 30 días, y, cifradas, en el espacio sin usar de su disco hasta que ese espacio se vuelva a usar; las copias de seguridad que hiciste antes conservan el texto que contienen. Al eliminar tu cuenta se borra el archivo completo.
- **Si no puedes iniciar sesión:** escribe a [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) desde la dirección de correo registrada en tu cuenta. Confirmaremos la solicitud y eliminaremos la cuenta en un plazo de 30 días. Todos los detalles: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Desinstalar la aplicación no elimina tu cuenta.** Si es lo que quieres, elimínala antes en Ajustes. Cerrar la sesión borra las copias y la clave de ese dispositivo; si aún hay cambios pendientes de subir, la aplicación pregunta antes. En Windows, al desinstalar la versión descargada (archivo de instalación) se conserva la copia cifrada salvo que elijas eliminar los datos de la aplicación; para estar seguro, cierra antes la sesión. En un Mac, mover la aplicación a la Papelera conserva las copias cifradas en tu Biblioteca (Library) y la clave en tu llavero hasta que cierres la sesión o las elimines; cierra antes la sesión. Al eliminar la aplicación para iPhone se borra su almacenamiento; el elemento del Keychain se elimina cuando cierras la sesión: para estar seguro, cierra antes la sesión.
- Por ahora no eliminamos automáticamente las cuentas inactivas. Si empezamos a hacerlo, lo indicaremos aquí antes de que se aplique.

## 8. Medidas de seguridad

- Solo HTTPS; el servidor rechaza las conexiones que no llegan por su dirección segura.
- Límites a los intentos de inicio de sesión y de registro. Tras 10 contraseñas incorrectas, el inicio de sesión desde esa red se bloquea durante 15 minutos, y los siguientes intentos sobre la cuenta se ralentizan.
- El diario se bloquea solo tras un periodo de inactividad. Cambiar la contraseña o la dirección de correo y eliminar la cuenta requieren tu contraseña.
- La clave del servidor se guarda fuera de los archivos almacenados, y solo el operador puede administrar el servidor.
- Quien pueda ejecutar programas como tu usuario de Windows o de Mac, o quien tenga el control total de un teléfono rooteado o con jailbreak, podría leer la copia guardada para "Recordarme".

Ningún sistema puede prometer una seguridad perfecta. Elige una contraseña fuerte que no uses en ningún otro sitio, mantén tus dispositivos actualizados y guarda una copia de seguridad.

## 9. Tus derechos

Puedes ver, corregir, exportar y eliminar tus datos tú mismo: tu perfil está en Ajustes, cada entrada se puede editar o borrar, **Ajustes - Copia de seguridad** y la exportación crean una copia que puedes llevarte a otro lugar, y **Eliminar la cuenta** lo borra todo. También puedes escribirnos para pedir una copia de tus datos, su rectificación, su supresión o la limitación del tratamiento, o para oponerte a él, y puedes retirar un consentimiento en cualquier momento. Respondemos en un plazo de 30 días. También tienes derecho a reclamar ante una autoridad de protección de datos: en la Unión Europea, la autoridad de tu país; en Israel, la Autoridad de Protección de la Privacidad.

## 10. Menores

El servicio no está dirigido a menores. Debes tener al menos {{MINIMUM_AGE}} años para crear una cuenta. No recopilamos a sabiendas datos de nadie más joven. Si crees que un menor de esa edad ha creado una cuenta, escríbenos y la eliminaremos.

## 11. No es una herramienta médica

Las conclusiones de la aplicación describen posibles relaciones en tus propias entradas. No demuestran causa y efecto y no son consejo médico ni psicológico.

## 12. Cambios en esta política

Cuando cambien el servicio o esta política, actualizaremos esta página y la fecha de entrada en vigor que figura arriba. Si un cambio afecta a lo que hacemos con tus datos, lo indicaremos en esta página antes de que se aplique.

## 13. Contacto

Preguntas sobre la privacidad o sobre tus datos: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
