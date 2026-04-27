-- ============================================
-- YAX ESTUDIO — Schema de base de datos
-- ============================================

CREATE DATABASE IF NOT EXISTS yax_estudio;
USE yax_estudio;

-- --------------------------------------------
-- CATÁLOGOS
-- --------------------------------------------

CREATE TABLE cat_metodo_pago (
  id_metodo_pago INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(50) NOT NULL
);

CREATE TABLE cat_tipo_producto (
  id_tipo_producto INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(50) NOT NULL
);

CREATE TABLE cat_categoria_gasto (
  id_categoria_gasto INT AUTO_INCREMENT PRIMARY KEY,
  nombre             VARCHAR(50) NOT NULL,
  activo             TINYINT(1) DEFAULT 1
);

-- --------------------------------------------
-- PRODUCTOS
-- --------------------------------------------

CREATE TABLE productos (
  id_producto      INT AUTO_INCREMENT PRIMARY KEY,
  id_tipo_producto INT NOT NULL,
  nombre           VARCHAR(100) NOT NULL,
  costo_produccion DECIMAL(10,2) DEFAULT 0.00,
  precio_venta     DECIMAL(10,2) NOT NULL,
  activo           TINYINT(1) DEFAULT 1,
  FOREIGN KEY (id_tipo_producto) REFERENCES cat_tipo_producto(id_tipo_producto)
);

-- --------------------------------------------
-- SESIÓN DE CAJA
-- --------------------------------------------

CREATE TABLE sesion_caja (
  id_sesion       INT AUTO_INCREMENT PRIMARY KEY,
  usuario         VARCHAR(100) NOT NULL,
  monto_inicial   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monto_final_real DECIMAL(10,2) DEFAULT NULL,
  estado          ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  fecha_inicio    DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_fin       DATETIME DEFAULT NULL
);

-- --------------------------------------------
-- VENTAS
-- --------------------------------------------

CREATE TABLE venta (
  id_venta  INT AUTO_INCREMENT PRIMARY KEY,
  id_sesion INT NOT NULL,
  estado    ENUM('ABIERTA','PAGADA','CANCELADA') NOT NULL DEFAULT 'ABIERTA',
  nota      VARCHAR(255) DEFAULT NULL,
  fecha     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_sesion) REFERENCES sesion_caja(id_sesion)
);

CREATE TABLE detalle_venta (
  id_detalle               INT AUTO_INCREMENT PRIMARY KEY,
  id_venta                 INT NOT NULL,
  id_producto              INT NOT NULL,
  cantidad                 INT NOT NULL,
  precio_unitario_historico DECIMAL(10,2) NOT NULL,
  subtotal                 DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_venta)    REFERENCES venta(id_venta),
  FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- --------------------------------------------
-- GASTOS
-- --------------------------------------------

CREATE TABLE gastos (
  id_gasto           INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria_gasto INT NOT NULL,
  id_sesion          INT NOT NULL,
  monto              DECIMAL(10,2) NOT NULL,
  descripcion        VARCHAR(255) DEFAULT NULL,
  fecha              DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_categoria_gasto) REFERENCES cat_categoria_gasto(id_categoria_gasto),
  FOREIGN KEY (id_sesion)          REFERENCES sesion_caja(id_sesion)
);

-- --------------------------------------------
-- DEVOLUCIONES
-- --------------------------------------------

CREATE TABLE devoluciones (
  id_devolucion  INT AUTO_INCREMENT PRIMARY KEY,
  id_venta       INT NOT NULL,
  id_sesion      INT NOT NULL,
  motivo         VARCHAR(255) DEFAULT NULL,
  total_devuelto DECIMAL(10,2) NOT NULL,
  fecha          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_venta)   REFERENCES venta(id_venta),
  FOREIGN KEY (id_sesion)  REFERENCES sesion_caja(id_sesion)
);

CREATE TABLE detalle_devolucion (
  id_detalle_devolucion    INT AUTO_INCREMENT PRIMARY KEY,
  id_devolucion            INT NOT NULL,
  id_producto              INT NOT NULL,
  cantidad                 INT NOT NULL,
  precio_unitario_historico DECIMAL(10,2) NOT NULL,
  subtotal                 DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id_devolucion),
  FOREIGN KEY (id_producto)   REFERENCES productos(id_producto)
);

-- --------------------------------------------
-- MOVIMIENTOS DE CAJA
-- --------------------------------------------

CREATE TABLE movimiento_caja (
  id_movimiento  INT AUTO_INCREMENT PRIMARY KEY,
  id_sesion      INT NOT NULL,
  id_metodo_pago INT NOT NULL,
  tipo           ENUM('INGRESO','EGRESO') NOT NULL,
  monto          DECIMAL(10,2) NOT NULL,
  id_venta       INT DEFAULT NULL,
  id_gasto       INT DEFAULT NULL,
  id_devolucion  INT DEFAULT NULL,
  fecha          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_sesion)      REFERENCES sesion_caja(id_sesion),
  FOREIGN KEY (id_metodo_pago) REFERENCES cat_metodo_pago(id_metodo_pago),
  FOREIGN KEY (id_venta)       REFERENCES venta(id_venta),
  FOREIGN KEY (id_gasto)       REFERENCES gastos(id_gasto),
  FOREIGN KEY (id_devolucion)  REFERENCES devoluciones(id_devolucion)
);

-- --------------------------------------------
-- DATOS BASE (catálogos mínimos)
-- --------------------------------------------

INSERT INTO cat_metodo_pago (nombre) VALUES ('Efectivo'), ('Transferencia');
INSERT INTO cat_tipo_producto (nombre) VALUES ('Playera'), ('Servicio Diseño');
INSERT INTO cat_categoria_gasto (nombre) VALUES ('Insumos'), ('Comida Staff');

INSERT INTO productos (id_tipo_producto, nombre, costo_produccion, precio_venta)
VALUES
  (1, 'Playera Basica Negra',  100.00, 250.00),
  (2, 'Diseño Personalizado',    0.00, 300.00);