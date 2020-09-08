import { compile, makeBuffer } from "./engine/gl";
import * as Camera from "./engine/camera";
import { identity, transform } from "./engine/math";
import { partialCube, partialCubeNormal } from "./shapes";
import { lightDirection, tileColor, backdropBase } from "./palette";

export let TILEGAP = 10,
  TILEWIDTH = 50,
  TILEHEIGHT = 600,
  STARTZPOS = 1000;

let program;

// Vertex shader
let vshader = `attribute vec4 aVertexPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uParentTransform;
uniform mat4 uProjectionMatrix;

varying vec3 vNormal;
varying float vDepth;

void main() {
  gl_Position = uProjectionMatrix * uParentTransform * uModelViewMatrix * aVertexPosition;
  vNormal = aNormal;
  vDepth = aVertexPosition.z/500.0;
}`;

// Fragment shader
let fshader = `precision mediump float;
uniform vec3 uLightDir;
uniform vec3 uColor;
uniform vec3 uBackdrop;

varying vec3 vNormal;
varying float vDepth;

void main() {
  float light = dot(normalize(vNormal), uLightDir);
  gl_FragColor = mix(vec4(uColor,1.), vec4(uBackdrop, 1.), vDepth);
  gl_FragColor.xyz *= light;
}`;

export let init = (gl) => {
  program = compile(gl, vshader, fshader);

  vertexBuffer = makeBuffer(
    gl,
    gl.ARRAY_BUFFER,
    partialCube(TILEWIDTH, TILEHEIGHT)
  );
  normalBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, partialCubeNormal());
};

export let createTileData = (x, y, type, startAtZero = false) => {
  switch (type) {
    case "a":
      return {
        type,
        zpos: 0,
        modelView: identity(),
      };
    case "x":
    // gap
    case "a":
    // basic non-interactive tile
    case "b":
    // destination tile
    case "c":
      return {
        type,
        zpos: STARTZPOS,
        modelView: transform(identity(), {
          x: x * TILEWIDTH + TILEGAP * x,
          y: y * TILEWIDTH + TILEGAP * y,
          z: startAtZero ? 0 : STARTZPOS,
        }),
      };
    default:
      return null;
  }
};

export let getTilesList = () => {
  return ["x", "a", "b", "c"];
};

export let setEnterPos = (tile, index) => {
  if (tile.zpos === 0) return;
  switch (tile.type) {
    // start tile, behaves similar to "b"
    case "x":
    // gap
    case "a":
    // basic non-interactive tile
    case "b":
    // destination tile
    case "c":
      // cleanup if tile moved too far away, else move it up normally
      let displace = tile.zpos < 0 ? -tile.zpos : -7 - (index + 1) * 5;
      transform(tile.modelView, { z: displace });
      tile.zpos += displace;
  }
};

export let checkTile = (tile) => {
  switch (tile.type) {
    // Win
    case "c":
      return 1;
    // Fall
    case "a":
      return 2;
    // Continue
    default:
      return 0;
  }
};

export let loadTileBuffer = (gl, parentTransform) => {
  program.use();

  vertexBuffer.bind(3, program.attribs.vertex);
  normalBuffer.bind(3, program.attribs.normal);

  gl.uniformMatrix4fv(program.uniforms.parentTransform, false, parentTransform);
  gl.uniformMatrix4fv(
    program.uniforms.projectionMatrix,
    false,
    Camera.projectionMatrix
  );
  gl.uniform3fv(program.uniforms.lightDir, lightDirection);
  gl.uniform3fv(program.uniforms.backdrop, backdropBase);
};

export let drawTile = (gl, tile) => {
  if (tile.type === "a") {
    return;
  }
  gl.uniform3fv(program.uniforms.color, tileColor[tile.type]);
  gl.uniformMatrix4fv(program.uniforms.modelMatrix, false, tile.modelView);
  gl.drawArrays(gl.TRIANGLES, 0, 18);
};
