// ============================================================
// sugoi_project :: configuración de cliente.
// Este archivo se carga como SCRIPT NORMAL (no módulo) ANTES de
// los módulos, exponiendo window.SUGOI_CONFIG.
// ============================================================

window.SUGOI_CONFIG = (() => {
  // Usa la misma variable que el contenedor web si estuviera inyectada;
  // por defecto cadena vacía = mismo origen (proxy nginx).
  const apiBase =
    (typeof window.SUGOI_API_BASE !== 'undefined' && window.SUGOI_API_BASE) || '';

  return {
    // BASE_URL de la API. Déjalo '' para usar el proxy de nginx en Docker.
    // En desarrollo standalone puedes apuntar a: 'http://localhost:3001'
    API_BASE: apiBase,

    // Editor de código: 'textarea' (sin deps) o 'codemirror' (mejor UX)
    EDITOR: 'textarea',

    // Opciones de lienzo (más grande para que pines y cables no queden apretados)
    GRID_SIZE: 24,

    // Precios simulados (BOM) en USD (mercado internacional aproximado).
    // Arduino Uno clon: entre $4.00 y $8.00 USD. Los valores están redondeados
    // a cifras limpias para una UI monetaria coherente.
    PRICE_TABLE: {
      // Microcontroladores
      arduino_uno: { name: 'Arduino Uno R3 (clon)', unitPrice: 5.0 },
      arduino_nano: { name: 'Arduino Nano (clon)', unitPrice: 3.0 },
      arduino_mega: { name: 'Arduino Mega 2560 (clon)', unitPrice: 12.0 },
      esp32_devkit: { name: 'ESP32 DevKit V1', unitPrice: 8.0 },
      attiny85: { name: 'ATtiny85', unitPrice: 2.0 },
      rp2040: { name: 'Raspberry Pi Pico (RP2040)', unitPrice: 6.0 },
      protoboard: { name: 'Protoboard 830 puntos', unitPrice: 2.0 },
      // Fuentes
      vcc: { name: 'Fuente 5V', unitPrice: 1.0 },
      gnd: { name: 'Tierra GND', unitPrice: 0.0 },
      // Pasivos
      resistor: { name: 'Resistencia 220', unitPrice: 0.1 },
      potentiometer: { name: 'Potenciometro 10k', unitPrice: 0.3 },
      slide_pot: { name: 'Potenciometro deslizante', unitPrice: 0.5 },
      photoresistor: { name: 'Fotorresistencia LDR', unitPrice: 0.2 },
      ntc_temp: { name: 'Sensor de temperatura NTC', unitPrice: 0.5 },
      tilt_switch: { name: 'Sensor de inclinacion', unitPrice: 0.3 },
      // LEDs
      led_red: { name: 'LED 5mm rojo', unitPrice: 0.1 },
      led_green: { name: 'LED 5mm verde', unitPrice: 0.1 },
      led_blue: { name: 'LED 5mm azul', unitPrice: 0.1 },
      led_rgb: { name: 'LED RGB 5mm', unitPrice: 0.5 },
      led_bar: { name: 'Barra de 10 LEDs', unitPrice: 1.5 },
      led_ring: { name: 'Anillo de 12 LEDs', unitPrice: 2.5 },
      neopixel: { name: 'NeoPixel individual', unitPrice: 0.5 },
      neopixel_matrix: { name: 'Matriz NeoPixel 8x8', unitPrice: 3.0 },
      // Botones e interruptores
      button: { name: 'Pulsador tactil 6x6', unitPrice: 0.15 },
      button_6mm: { name: 'Pulsador 6mm', unitPrice: 0.1 },
      slide_switch: { name: 'Interruptor deslizante', unitPrice: 0.2 },
      dip_switch: { name: 'DIP Switch 8x', unitPrice: 0.5 },
      membrane_keypad: { name: 'Teclado matricial 4x4', unitPrice: 2.0 },
      rotary: { name: 'Dial rotatorio', unitPrice: 0.5 },
      // Actuadores
      buzzer: { name: 'Buzzer 5V', unitPrice: 0.3 },
      servo: { name: 'Servo SG90', unitPrice: 8.0 },
      stepper: { name: 'Motor paso a paso 28BYJ-48', unitPrice: 5.0 },
      relay: { name: 'Modulo rele 5V', unitPrice: 2.0 },
      // Sensores
      dht22: { name: 'Sensor DHT22', unitPrice: 3.0 },
      hc_sr04: { name: 'Sensor ultrasonico HC-SR04', unitPrice: 3.0 },
      pir: { name: 'Sensor PIR HC-SR501', unitPrice: 2.0 },
      flame: { name: 'Sensor de llama', unitPrice: 1.5 },
      gas: { name: 'Sensor de gas MQ-2', unitPrice: 3.0 },
      sound: { name: 'Sensor de sonido', unitPrice: 1.0 },
      mpu6050: { name: 'IMU MPU6050', unitPrice: 5.0 },
      hx711: { name: 'Modulo HX711', unitPrice: 3.0 },
      joystick: { name: 'Joystick analogico', unitPrice: 2.0 },
      ir_receiver: { name: 'Receptor IR', unitPrice: 1.5 },
      // Displays
      seg7: { name: 'Display 7 segmentos', unitPrice: 0.5 },
      lcd1602: { name: 'LCD 16x2', unitPrice: 4.0 },
      lcd2004: { name: 'LCD 20x4', unitPrice: 6.0 },
      oled: { name: 'OLED 0.96" SSD1306', unitPrice: 6.0 },
      tft: { name: 'TFT ILI9341 2.8"', unitPrice: 12.0 },
      microsd: { name: 'Modulo MicroSD', unitPrice: 3.0 },
      rtc: { name: 'RTC DS1307', unitPrice: 3.0 },
    },

    // Margen comercial aplicado al BOM (porcentaje)
    BOM_MARKUP: 0.15,

    // Moneda del BOMahora USD, antes MXN
    CURRENCY: 'USD',
  };
})();