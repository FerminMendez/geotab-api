# Geotab Data Extractor

Una herramienta Python para extraer datos de la plataforma Geotab y exportarlos a archivos CSV para análisis posterior.

## ¿Qué es Geotab?

Geotab es una plataforma líder de telemática vehicular que proporciona soluciones integrales de gestión de flotas. Permite a las empresas:

- 🚗 **Monitoreo en tiempo real** de vehículos y conductores
- 📍 **Seguimiento GPS** con ubicación precisa
- ⛽ **Análisis de consumo** de combustible
- 🔧 **Mantenimiento predictivo** basado en datos
- 📊 **Reportes detallados** de comportamiento de conducción
- ✅ **Cumplimiento normativo** y de seguridad

## Objetivo del Proyecto

Este proyecto permite **extraer y exportar datos** de la API de Geotab a archivos CSV organizados, facilitando:

- 📈 **Análisis de datos** con herramientas externas (Excel, Power BI, Python, R)
- 📋 **Reportes personalizados** para diferentes stakeholders
- 🗄️ **Respaldo de datos** históricos
- 🔄 **Integración** con otros sistemas empresariales

## 📊 Análisis Exploratorio de Datos (EDA)

Este proyecto incluye un **notebook de Jupyter (`eda.ipynb`)** con un análisis exploratorio de datos completo.

### ¿Qué es un EDA?

Un **Análisis Exploratorio de Datos (EDA)** es el proceso de examinar y analizar conjuntos de datos para resumir sus características principales, identificar patrones, detectar anomalías y formular hipótesis. En el contexto de datos de Geotab, el EDA incluye:

- 🔍 **Exploración de estructura**: Análisis de tipos de datos, valores nulos y duplicados
- 📈 **Análisis estadístico**: Distribuciones, tendencias centrales y dispersión
- 🕐 **Patrones temporales**: Análisis de comportamientos por hora, día y semana
- 🚗 **Métricas de flota**: Rendimiento de vehículos, eficiencia de combustible
- 👥 **Comportamiento de conductores**: Patrones de uso y seguridad
- ⚠️ **Análisis de fallas**: Identificación de problemas recurrentes
- 🗺️ **Distribución geográfica**: Análisis de zonas y rutas

El notebook EDA proporciona **insights valiosos** para la toma de decisiones operativas y estratégicas en la gestión de flotas.

## Características

### ✨ Mejoras Implementadas

- 🔒 **Seguridad**: Variables sensibles en archivo `.env`
- 📝 **Logging completo**: Registros detallados de todas las operaciones
- 📁 **Organización**: Archivos exportados con timestamps
- ⚡ **Configuración flexible**: Parámetros ajustables via variables de entorno
- 🛡️ **Manejo de errores**: Control robusto de excepciones
- 📊 **Estadísticas**: Reporte de exports exitosos y fallidos

### 📦 Datos Extraídos

- **Device**: Información de dispositivos/vehículos
- **Trip**: Datos de viajes realizados
- **User**: Usuarios del sistema
- **Zone**: Zonas geográficas definidas
- **Rule**: Reglas de negocio configuradas
- **FaultData**: Datos de fallas y diagnósticos

## Instalación

### Prerrequisitos

- Python 3.7 o superior
- Cuenta activa en Geotab con acceso a la API

### Pasos

1. **Clonar el repositorio:**

   ```bash
   git clone <repository-url>
   cd geotab-api
   ```

2. **Crear y activar entorno virtual:**

   ```bash
   # Crear entorno virtual
   python -m venv venv

   # Activar entorno virtual
   # En Windows:
   venv\Scripts\activate

   # En macOS/Linux:
   source venv/bin/activate
   ```

3. **Instalar dependencias:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configurar variables de entorno:**

   ```bash
   copy .env.example .env
   ```

   Editar `.env` con tus credenciales:

   ```env
   GEOTAB_USERNAME=tu_email@ejemplo.com
   GEOTAB_DATABASE=tu_base_de_datos
   GEOTAB_PASSWORD=tu_contraseña_segura

   # Configuración opcional
   EXPORT_DIRECTORY=./exports
   MAX_RECORDS_PER_BATCH=500
   ```

## Uso

### Extracción de Datos

```bash
# Asegúrate de que el entorno virtual esté activado
python get_geotab_data.py
```

### Análisis de Datos (EDA)

Después de extraer los datos, puedes ejecutar el análisis exploratorio:

```bash
# Abrir el notebook de Jupyter
jupyter notebook eda.ipynb
```

**Nota**: Asegúrate de tener Jupyter instalado. Si no lo tienes:

```bash
pip install jupyter
```

### Estructura de Archivos Generados

```
exports/
├── geotab_export.log
├── Device_20231106_143022.csv
├── Trip_20231106_143045.csv
├── User_20231106_143102.csv
├── Zone_20231106_143118.csv
├── Rule_20231106_143135.csv
└── FaultData_20231106_143152.csv
```

## Configuración

### Variables de Entorno

| Variable                | Descripción                    | Valor por Defecto |
| ----------------------- | ------------------------------ | ----------------- |
| `GEOTAB_USERNAME`       | Email de usuario Geotab        | _Requerido_       |
| `GEOTAB_DATABASE`       | Nombre de la base de datos     | _Requerido_       |
| `GEOTAB_PASSWORD`       | Contraseña de acceso           | _Requerido_       |
| `EXPORT_DIRECTORY`      | Directorio de exportación      | `./exports`       |
| `MAX_RECORDS_PER_BATCH` | Registros por lote de progreso | `500`             |

### Personalización

Para modificar los tipos de datos a extraer, edita la lista `ENTITY_TYPES_TO_FETCH` en `get_geotab_data.py`:

```python
ENTITY_TYPES_TO_FETCH = [
    "Device",
    "Trip",
    "User",
    "Zone",
    "Rule",
    "FaultData",
    # "LogRecord",  # ⚠️ EXTREMADAMENTE GRANDE
    # "StatusData", # ⚠️ EXTREMADAMENTE GRANDE
]
```

⚠️ **Advertencia**: `LogRecord` y `StatusData` pueden contener millones de registros y requerir horas para descargar.

## Logs y Monitoreo

El sistema genera logs detallados en:

- **Archivo**: `exports/geotab_export.log`
- **Consola**: Salida en tiempo real

Ejemplos de logs:

```
2023-11-06 14:30:15 - INFO - Starting Geotab data export process...
2023-11-06 14:30:16 - INFO - Successfully authenticated with Geotab!
2023-11-06 14:30:20 - INFO - Fetched 1500 Devices so far...
2023-11-06 14:30:25 - INFO - Successfully exported 'Device_20231106_143025.csv' with 2347 records.
```

## Seguridad

### 🔒 Buenas Prácticas Implementadas

- ✅ Credenciales en variables de entorno (no en código)
- ✅ Archivo `.env` excluido del control de versiones
- ✅ Ejemplo de configuración sin datos sensibles
- ✅ Validación de variables requeridas

### ⚠️ Recomendaciones Adicionales

- Usa credenciales con permisos mínimos necesarios
- Rota contraseñas regularmente
- Considera usar un gestor de secretos en producción
- Monitorea el acceso a la API de Geotab

## Solución de Problemas

### Error de Autenticación

```
Authentication failed: Invalid credentials
```

**Solución**: Verifica que las credenciales en `.env` sean correctas.

### Error de Conexión

```
Connection timeout
```

**Solución**: Verifica tu conexión a internet y que el servidor Geotab esté accesible.

### Archivos Muy Grandes

```
Memory error while processing LogRecord
```

**Solución**: Evita extraer `LogRecord` y `StatusData` o procésalos en lotes más pequeños.

## Estructura del Proyecto

```
geotab-api/
├── .env.example          # Plantilla de configuración
├── .env                  # Tu configuración (no versionado)
├── .gitignore           # Archivos excluidos del control de versiones
├── requirements.txt     # Dependencias Python
├── README.md           # Esta documentación
├── get_geotab_data.py  # Script principal de extracción
├── eda.ipynb           # Notebook de análisis exploratorio (EDA)
├── venv/               # Entorno virtual (no versionado)
└── exports/            # Directorio de archivos generados
    ├── *.csv          # Datos exportados
    └── *.log          # Logs del sistema
```

## Dependencias

- **mygeotab**: Cliente oficial de la API de Geotab
- **python-dotenv**: Gestión de variables de entorno
- **requests**: Cliente HTTP (dependencia de mygeotab)

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para preguntas o problemas:

- 📧 Abrir un issue en GitHub
- 📚 Consultar la [documentación oficial de Geotab](https://developers.geotab.com/)
- 🔗 Revisar los [ejemplos de la API](https://github.com/Geotab/sdk-python-samples)
