import createCc1plus from "./tools/cc1plus.mjs";
import createAvrAs from "./tools/avr-as.mjs";
import createAvrLd from "./tools/avr-ld.mjs";
import createObjcopy from "./tools/avr-objcopy.mjs";

export const SENSOR = Object.freeze({
  OLED: "OLED",
  TOF: "TOF",
});

const MCU = "atmega328p";
const MULTILIB = "avr5";
const UNO_APP_FLASH_BYTES = 32256;
const WASM_FILE_BY_TOOL = Object.freeze({
  cc1plus: "cc1plus.wasm",
  "avr-as": "avr-as.wasm",
  "avr-ld": "avr-ld.wasm",
  "avr-objcopy": "avr-objcopy.wasm",
});
const INITIAL_LINEAR_MEMORY_BYTES = Object.freeze({
  cc1plus: 4 * 1024 * 1024,
  "avr-as": 4 * 1024 * 1024,
  "avr-ld": 4 * 1024 * 1024,
  "avr-objcopy": 4 * 1024 * 1024,
});

const assetCache = new Map();
let manifestPromise;

// Base URL that contains the `tools/` and `assets/` directories shipped with
// this package. Defaults to the package's own location so it works out of the
// box, but consumers (e.g. apps that copy these files to a static directory)
// can override it via setAssetsBase() or the `assetsBase` build option.
let assetsBase = new URL("./", import.meta.url);

/**
 * Override where `tools/` and `assets/` are served from.
 * @param {string | URL} base Absolute URL or path ending in `/`.
 */
export function setAssetsBase(base) {
  const fallback = typeof self !== "undefined" && self.location ? self.location.href : import.meta.url;
  assetsBase = new URL(base, fallback);
  manifestPromise = undefined;
}

function assetUrl(path) {
  return new URL(`assets/${path.replace(/^\/+/, "")}`, assetsBase);
}

async function fetchBytes(path) {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchText(relativePath) {
  const key = `text:${relativePath}`;
  if (!assetCache.has(key)) {
    assetCache.set(key, fetch(new URL(relativePath, assetsBase)).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${relativePath}: ${res.status}`);
      return res.text();
    }));
  }
  return assetCache.get(key);
}

function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(new URL("assets/manifest.json", assetsBase)).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
      return res.json();
    });
  }
  return manifestPromise;
}

function ensureDir(fs, dir) {
  if (!dir || dir === "/") return;
  const parts = dir.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    try {
      fs.mkdir(current);
    } catch (error) {
      if (error?.errno !== 20) {
        try {
          fs.stat(current);
        } catch {
          throw error;
        }
      }
    }
  }
}

function writeFile(fs, path, data) {
  ensureDir(fs, path.split("/").slice(0, -1).join("/"));
  fs.writeFile(path, data);
}

function readFile(fs, path) {
  return fs.readFile(path);
}

function createModuleOptions(toolName, timings, stderr, memoryPeaks) {
  const startedAt = performance.now();
  memoryPeaks[toolName] = INITIAL_LINEAR_MEMORY_BYTES[toolName];
  return {
    noInitialRun: true,
    locateFile(path) {
      const wasmFile = path.endsWith(".wasm") ? WASM_FILE_BY_TOOL[toolName] || path : path;
      return new URL(`tools/${wasmFile}`, assetsBase).href;
    },
    print() {},
    printErr(line) {
      if (line) stderr.push(`[${toolName}] ${line}`);
    },
    onRuntimeInitialized() {
      timings[`${toolName}:initMs`] = performance.now() - startedAt;
    },
    onMemoryGrowth(bytes) {
      memoryPeaks[toolName] = Math.max(memoryPeaks[toolName] || 0, bytes);
    },
  };
}

async function runTool(toolName, factory, args, setup, outputPath, timings, stderr, memoryPeaks) {
  const start = performance.now();
  const mod = await factory(createModuleOptions(toolName, timings, stderr, memoryPeaks));
  try {
    if (setup) await setup(mod.FS);
  } catch (error) {
    throw new Error(`${toolName} setup failed: ${describeError(error)}`);
  }

  const runStart = performance.now();
  try {
    mod.callMain(args);
  } catch (error) {
    const message = String(error?.message || error);
    if (error?.status !== 0 && !/Program terminated with exit\(0\)/.test(message)) {
      throw new Error(`${toolName} failed: ${message}\n${stderr.slice(-20).join("\n")}`);
    }
  }
  timings[`${toolName}:runMs`] = performance.now() - runStart;
  timings[`${toolName}:totalMs`] = performance.now() - start;
  try {
    return outputPath ? readFile(mod.FS, outputPath) : undefined;
  } catch (error) {
    throw new Error(`${toolName} did not produce ${outputPath}: ${describeError(error)}\n${stderr.slice(-20).join("\n")}`);
  }
}

function describeError(error) {
  if (!error) return "unknown error";
  const details = [
    error.message || String(error),
    error.name && `name=${error.name}`,
    Number.isInteger(error.errno) && `errno=${error.errno}`,
    Number.isInteger(error.status) && `status=${error.status}`,
  ].filter(Boolean);
  return details.join(" ");
}

async function loadHeaders(fs, manifest, timings) {
  const start = performance.now();
  await Promise.all(manifest.headerFiles.map(async (virtualPath) => {
    writeFile(fs, virtualPath, await fetchBytes(`/fs${virtualPath}`));
  }));
  timings.headersFsMs = performance.now() - start;
}

function selectedObjectPaths(manifest, sensors) {
  return [
    "/objects/core_abi.o",
    ...manifest.objectGroups.base,
    ...(sensors.has(SENSOR.OLED) ? manifest.objectGroups.oled : []),
    ...(sensors.has(SENSOR.TOF) ? manifest.objectGroups.tof : []),
  ];
}

async function loadLinkInputs(fs, manifest, objectPaths, firmwareObject, timings) {
  const start = performance.now();
  writeFile(fs, "/build/HorangFirmware.o", firmwareObject);
  writeFile(fs, "/ldscripts/avr5.xn", await fetchBytes("/ldscripts/avr5.xn"));

  await Promise.all(objectPaths.map(async (virtualPath) => {
    writeFile(fs, virtualPath, await fetchBytes(virtualPath));
  }));

  await Promise.all(manifest.libs.map(async (virtualPath) => {
    writeFile(fs, virtualPath, await fetchBytes(virtualPath));
  }));

  timings.linkInputsFsMs = performance.now() - start;
}

function compileArgs(sensors) {
  return [
    "-quiet",
    "-imultilib", MULTILIB,
    "-D__AVR_ATmega328P__",
    "-D__AVR_DEVICE_NAME__=atmega328p",
    "-DF_CPU=16000000L",
    "-DARDUINO=10819",
    "-DARDUINO_AVR_UNO",
    "-DARDUINO_ARCH_AVR",
    `-DUSE_OLED=${sensors.has(SENSOR.OLED) ? 1 : 0}`,
    `-DUSE_TOF=${sensors.has(SENSOR.TOF) ? 1 : 0}`,
    "-isystem", "/sysroot/gcc/include",
    "-isystem", "/sysroot/avr/include",
    "-I", "/arduino/core",
    "-I", "/arduino/variant",
    "-I", "/arduino/libraries/Wire/src",
    "-I", "/arduino/libraries/SPI/src",
    "-I", "/arduino/libraries/Wire/src/utility",
    "-I", "/libraries/Servo/src",
    "-I", "/libraries/Servo/src/avr",
    "-I", "/libraries/Firmata",
    "-I", "/libraries/Firmata/utility",
    "-I", "/libraries/Adafruit_BMP085_Library",
    "-I", "/libraries/DHT_sensor_library",
    "-I", "/libraries/Adafruit_GFX_Library",
    "-I", "/libraries/Adafruit_SSD1306",
    "-I", "/libraries/VL53L0X",
    "-I", "/libraries/Adafruit_BusIO",
    "-I", "/libraries/Adafruit_Unified_Sensor",
    "/build/HorangFirmware.cpp",
    "-mn-flash=1",
    "-mno-skip-bug",
    "-quiet",
    "-dumpbase", "HorangFirmware.cpp",
    "-mmcu=avr5",
    "-auxbase-strip", "/build/HorangFirmware.s",
    "-Os",
    "-std=gnu++11",
    "-fpermissive",
    "-fno-exceptions",
    "-fno-threadsafe-statics",
    "-fno-rtti",
    "-fno-enforce-eh-specs",
    "-ffunction-sections",
    "-fdata-sections",
    "-o", "/build/HorangFirmware.s",
  ];
}

function linkerArgs(objectPaths) {
  return [
    "-m", MULTILIB,
    // The avr5 emulation defaults the SRAM (.data/.bss) origin to 0x800060,
    // but on the ATmega328P 0x60-0xFF are memory-mapped I/O registers and real
    // SRAM starts at 0x100. Without this, globals overlap the UART/timer
    // registers and the firmware malfunctions on-device (Serial emits garbage).
    // avr-gcc's device driver sets this automatically; the manual ld link must
    // pass it explicitly. RAMSTART for atmega328p is 0x100 -> 0x800100.
    "-Tdata=0x800100",
    "--gc-sections",
    "-o", "/build/HorangFirmware.elf",
    "/libs/crtatmega328p.o",
    "/build/HorangFirmware.o",
    ...objectPaths,
    "-L/libs",
    "-lm",
    "-lc",
    "-lgcc",
  ];
}

function countIntelHexDataBytes(hex) {
  let total = 0;
  for (const line of hex.split(/\r?\n/)) {
    if (!line) continue;
    if (line[0] !== ":" || line.length < 11) {
      throw new Error(`Invalid Intel HEX record: ${line}`);
    }

    const byteCount = Number.parseInt(line.slice(1, 3), 16);
    const recordType = Number.parseInt(line.slice(7, 9), 16);
    if (recordType === 0x00) total += byteCount;
  }
  return total;
}

/**
 * Compile Arduino firmware to Intel HEX in the browser.
 *
 * @param {string[] | {
 *   source?: string,            // firmware source; if omitted, the bundled src/HorangFirmware.cpp is fetched
 *   sensors?: string[],         // SENSOR.OLED / SENSOR.TOF toggles passed as -DUSE_* flags
 *   assetsBase?: string | URL,  // where tools/ and assets/ are served from
 * }} options Either a sensor array (legacy) or an options object.
 */
export async function buildFirmware(options = {}) {
  const opts = Array.isArray(options) ? { sensors: options } : options || {};
  if (opts.assetsBase) setAssetsBase(opts.assetsBase);

  const sensors = new Set(opts.sensors || []);
  const timings = {};
  const stderr = [];
  const memoryPeaks = {};
  const totalStart = performance.now();
  const manifest = await getManifest();
  const source = opts.source != null ? opts.source : await fetchText("src/HorangFirmware.cpp");

  const assembly = await runTool(
    "cc1plus",
    createCc1plus,
    compileArgs(sensors),
    async (fs) => {
      await loadHeaders(fs, manifest, timings);
      writeFile(fs, "/build/HorangFirmware.cpp", source);
    },
    "/build/HorangFirmware.s",
    timings,
    stderr,
    memoryPeaks,
  );

  const firmwareObject = await runTool(
    "avr-as",
    createAvrAs,
    ["-mmcu=atmega328p", "-o", "/build/HorangFirmware.o", "/build/HorangFirmware.s"],
    (fs) => writeFile(fs, "/build/HorangFirmware.s", assembly),
    "/build/HorangFirmware.o",
    timings,
    stderr,
    memoryPeaks,
  );

  const objectPaths = selectedObjectPaths(manifest, sensors);
  const elf = await runTool(
    "avr-ld",
    createAvrLd,
    linkerArgs(objectPaths),
    async (fs) => {
      await loadLinkInputs(fs, manifest, objectPaths, firmwareObject, timings);
    },
    "/build/HorangFirmware.elf",
    timings,
    stderr,
    memoryPeaks,
  );

  const hexBytes = await runTool(
    "avr-objcopy",
    createObjcopy,
    ["-O", "ihex", "-R", ".eeprom", "/build/HorangFirmware.elf", "/build/HorangFirmware.hex"],
    (fs) => writeFile(fs, "/build/HorangFirmware.elf", elf),
    "/build/HorangFirmware.hex",
    timings,
    stderr,
    memoryPeaks,
  );

  const hex = new TextDecoder().decode(hexBytes);
  const flashBytes = countIntelHexDataBytes(hex);
  timings.totalMs = performance.now() - totalStart;

  return {
    hex,
    sensors: [...sensors],
    target: {
      mcu: MCU,
      board: "arduino:avr:uno",
      appFlashBytes: UNO_APP_FLASH_BYTES,
    },
    bytes: hexBytes.byteLength,
    hexBytes: hexBytes.byteLength,
    flashBytes,
    fitsTarget: flashBytes <= UNO_APP_FLASH_BYTES,
    objectCount: objectPaths.length + 1,
    memory: {
      linearPeakBytesByTool: memoryPeaks,
      linearPeakBytesTotalSequential: Object.values(memoryPeaks).reduce((total, bytes) => total + bytes, 0),
    },
    timings,
    stderr,
  };
}
