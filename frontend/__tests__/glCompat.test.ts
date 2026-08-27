// three r163+ rejects any context that is `instanceof WebGLRenderingContext`,
// and expo-gl 57 makes its WebGL2 contexts satisfy exactly that. These pin the
// narrow escape hatch: hide the global only for a real WebGL2 context, only for
// the length of the call, and always put it back.
import { createWithWebGL2Context } from '../src/lib/glCompat';

class FakeWebGL1 {}
class FakeWebGL2 extends FakeWebGL1 {} // expo-gl's hierarchy, not the browser's

const g = globalThis as any;
let saved1: unknown;
let saved2: unknown;

beforeEach(() => {
  saved1 = g.WebGLRenderingContext;
  saved2 = g.WebGL2RenderingContext;
  g.WebGLRenderingContext = FakeWebGL1;
  g.WebGL2RenderingContext = FakeWebGL2;
});

afterEach(() => {
  g.WebGLRenderingContext = saved1;
  g.WebGL2RenderingContext = saved2;
});

describe('createWithWebGL2Context', () => {
  it('hides the WebGL1 global while constructing, for a WebGL2 context', () => {
    let seen: unknown = 'not called';
    createWithWebGL2Context(new FakeWebGL2(), () => {
      seen = g.WebGLRenderingContext;
      return 'renderer';
    });
    expect(seen).toBeUndefined();
  });

  it('restores the global afterwards', () => {
    createWithWebGL2Context(new FakeWebGL2(), () => 'renderer');
    expect(g.WebGLRenderingContext).toBe(FakeWebGL1);
  });

  it('restores the global even when the constructor throws', () => {
    expect(() =>
      createWithWebGL2Context(new FakeWebGL2(), () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(g.WebGLRenderingContext).toBe(FakeWebGL1);
  });

  it('leaves a genuine WebGL1 context alone, so three still rejects it', () => {
    let seen: unknown = 'not called';
    createWithWebGL2Context(new FakeWebGL1(), () => {
      seen = g.WebGLRenderingContext;
      return 'renderer';
    });
    expect(seen).toBe(FakeWebGL1);
  });

  it('returns whatever the constructor returned', () => {
    expect(createWithWebGL2Context(new FakeWebGL2(), () => 'renderer')).toBe('renderer');
  });
});
