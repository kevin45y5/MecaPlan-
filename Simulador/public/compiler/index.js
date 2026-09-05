// Public entry point for @horang-corp/avr-gcc-wasm.
//
// Two ways to use it:
//   1. compile({ source, sensors }) — runs the build in a dedicated Worker
//      (off the main thread, fresh memory per build). Recommended for apps.
//   2. buildFirmware({ source, sensors }) — runs the build in the current
//      thread/worker directly. Re-exported from ./firmware-builder.js.

export { buildFirmware, SENSOR, setAssetsBase } from "./firmware-builder.js";

let nextBuildId = 1;

/**
 * Compile firmware in a dedicated module Worker and resolve with the result.
 *
 * @param {{
 *   source?: string,            // firmware source (e.g. the contents of a .ino/.cpp file)
 *   sensors?: string[],         // SENSOR.OLED / SENSOR.TOF toggles
 *   assetsBase?: string | URL,  // where tools/ and assets/ are served from
 * }} [options]
 * @returns {Promise<object>} build result ({ hex, flashBytes, fitsTarget, timings, ... })
 */
export function compile(options = {}) {
  const { source, sensors = [], assetsBase } = options;
  const id = nextBuildId++;
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

  return new Promise((resolve, reject) => {
    worker.addEventListener(
      "message",
      (event) => {
        const { ok, result, error } = event.data;
        worker.terminate();
        if (ok) {
          resolve(result);
        } else {
          reject(Object.assign(new Error(error.message), { stack: error.stack }));
        }
      },
      { once: true },
    );

    worker.addEventListener(
      "error",
      (event) => {
        worker.terminate();
        reject(new Error(event.message || "Firmware worker failed"));
      },
      { once: true },
    );

    // assetsBase may be a URL instance; URL is not reliably structured-clonable
    // across browsers, so pass a string. setAssetsBase() re-parses it.
    worker.postMessage({ id, source, sensors, assetsBase: assetsBase == null ? undefined : String(assetsBase) });
  });
}
