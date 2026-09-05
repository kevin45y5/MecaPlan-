import { buildFirmware } from "./firmware-builder.js";

self.addEventListener("message", async (event) => {
  const { id, sensors, source, assetsBase } = event.data;

  try {
    const result = await buildFirmware({ sensors, source, assetsBase });
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: {
        message: String(error?.message || error),
        stack: error?.stack || "",
      },
    });
  }
});
