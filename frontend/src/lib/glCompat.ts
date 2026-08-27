// Getting three.js to accept expo-gl's context on a device.
//
// three r163 dropped WebGL1. It enforces that with one line, and this is its
// only reference to the class anywhere in the library:
//
//     if (typeof WebGLRenderingContext !== 'undefined' &&
//         context instanceof WebGLRenderingContext) throw ...
//
// expo-gl 57 hands us a WebGL2 context -- `ExpoWebGLRenderingContext extends
// WebGL2RenderingContext` -- but it also made WebGL2RenderingContext *inherit*
// from WebGLRenderingContext, which browsers do not do. So the context passes
// three's WebGL1 test despite being WebGL2, and the renderer refuses a context
// it would drive perfectly well. On web the browser's own classes are used and
// none of this arises, which is why the viewer renders in a browser and showed a
// blank canvas on the phone.
//
// So: hide the WebGL1 global for exactly the length of the constructor call, and
// only when the context really is WebGL2. A genuinely WebGL1 device still gets
// three's error, which is correct -- it cannot run this renderer.

export function createWithWebGL2Context<T>(gl: unknown, create: () => T): T {
  const g = globalThis as unknown as {
    WebGLRenderingContext?: unknown;
    WebGL2RenderingContext?: new () => unknown;
  };

  const isWebGL2 =
    typeof g.WebGL2RenderingContext !== 'undefined' && gl instanceof g.WebGL2RenderingContext;

  if (!isWebGL2) return create();

  const saved = g.WebGLRenderingContext;
  g.WebGLRenderingContext = undefined;
  try {
    return create();
  } finally {
    // Restored even if the constructor throws: leaving the global blank would
    // break every later feature-detect in the app, not just this one.
    g.WebGLRenderingContext = saved;
  }
}
