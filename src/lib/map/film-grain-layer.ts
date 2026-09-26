import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";

import { FILM_GRAIN_SIZE, filmGrainPixels } from "./film-grain";

/**
 * Grain drawn inside the map's own canvas, so it pans with the geography and
 * never becomes a second composited layer over the WebGL view.
 *
 * A fill-pattern would be simpler, but MapLibre patterns live in tile space
 * and grow as you zoom, so the grain would turn into blobs at street level.
 * This layer keeps one texel per device pixel (a constant screen frequency)
 * and shifts the sample by the anchor's screen position, so a pan carries the
 * grain with the streets while a zoom doesn't enlarge it.
 *
 * Strength is lower on phones: the same texture at DPR 3 reads heavier, and
 * the old screen-fixed overlay was already too contrasty there.
 */
const ANCHOR = { lng: -122.4194, lat: 37.7749 };

const VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_offset;
uniform vec2 u_size;
uniform float u_strength;
out vec4 fragColor;
void main() {
  vec2 uv = fract((gl_FragCoord.xy + u_offset) / u_size);
  float n = texture(u_tex, uv).r;
  float g = (n - 0.5) * 2.0;
  float mag = abs(g) * u_strength;
  vec3 rgb = g > 0.0 ? vec3(mag) : vec3(0.0);
  fragColor = vec4(rgb, mag);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createFilmGrainLayer(): CustomLayerInterface {
  let map: MapLibreMap | null = null;
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let buffer: WebGLBuffer | null = null;
  let uTex: WebGLUniformLocation | null = null;
  let uOffset: WebGLUniformLocation | null = null;
  let uSize: WebGLUniformLocation | null = null;
  let uStrength: WebGLUniformLocation | null = null;
  let phoneQuery: MediaQueryList | null = null;
  let darkQuery: MediaQueryList | null = null;

  return {
    id: "film-grain",
    type: "custom",
    renderingMode: "2d",
    onAdd(next, gl) {
      map = next;
      phoneQuery = window.matchMedia("(max-width: 1023px), (pointer: coarse)");
      darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const vertex = compile(gl, gl.VERTEX_SHADER, VERT);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vertex || !fragment) return;
      const nextProgram = gl.createProgram();
      if (!nextProgram) return;
      gl.attachShader(nextProgram, vertex);
      gl.attachShader(nextProgram, fragment);
      gl.linkProgram(nextProgram);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(nextProgram));
        gl.deleteProgram(nextProgram);
        return;
      }
      program = nextProgram;
      uTex = gl.getUniformLocation(program, "u_tex");
      uOffset = gl.getUniformLocation(program, "u_offset");
      uSize = gl.getUniformLocation(program, "u_size");
      uStrength = gl.getUniformLocation(program, "u_strength");

      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        FILM_GRAIN_SIZE,
        FILM_GRAIN_SIZE,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        filmGrainPixels(),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    },
    render(gl) {
      if (!program || !vao || !texture || !map) return;
      const projected = map.project(ANCHOR);
      const ratio = map.getPixelRatio();
      // Stick the pattern to the anchor (pan) without scaling it (zoom).
      const offsetX = -projected.x * ratio;
      const offsetY = projected.y * ratio;
      const phone = phoneQuery?.matches ?? false;
      const dark = darkQuery?.matches ?? false;
      const strength = dark ? (phone ? 0.2 : 0.32) : phone ? 0.18 : 0.3;

      const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
      const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
      const prevActive = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
      const depth = gl.isEnabled(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE0);
      const prevTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;

      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uOffset, offsetX, offsetY);
      gl.uniform2f(uSize, FILM_GRAIN_SIZE, FILM_GRAIN_SIZE);
      gl.uniform1f(uStrength, strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindVertexArray(prevVao);
      gl.useProgram(prevProgram);
      gl.bindTexture(gl.TEXTURE_2D, prevTexture);
      gl.activeTexture(prevActive);
      if (depth) gl.enable(gl.DEPTH_TEST);
    },
    onRemove(_map, gl) {
      if (program) gl.deleteProgram(program);
      if (texture) gl.deleteTexture(texture);
      if (vao) gl.deleteVertexArray(vao);
      if (buffer) gl.deleteBuffer(buffer);
      program = null;
      texture = null;
      vao = null;
      buffer = null;
      map = null;
    },
  };
}
