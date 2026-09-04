/* Shared math, material and mesh helpers. Attaches to the global SRR namespace. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  SRR.D2R = Math.PI / 180;

  SRR.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  SRR.lerp = function (a, b, t) { return a + (b - a) * t; };

  SRR.easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /** Standard material shorthand. */
  SRR.std = function (color, rough, metal, extra) {
    var opts = {
      color: color,
      roughness: rough === undefined ? 0.75 : rough,
      metalness: metal === undefined ? 0 : metal
    };
    if (extra) { for (var k in extra) { opts[k] = extra[k]; } }
    return new THREE.MeshStandardMaterial(opts);
  };

  /** Box mesh sized in world units, shadows on. */
  SRR.box = function (w, h, d, mat, name) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (name) { m.name = name; }
    return m;
  };

  /** Y-axis cylinder, shadows on. */
  SRR.cyl = function (r, h, mat, name, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (name) { m.name = name; }
    return m;
  };

  /** Normalize degrees into [0, 360). */
  SRR.norm360 = function (deg) {
    var d = deg % 360;
    return d < 0 ? d + 360 : d;
  };
}(window.SRR));
