/* Procedural canvas textures. Nothing is fetched, so the page still runs from
   file://. All of them are small, tiling, and deliberately fine-grained: the
   surfaces should read as smooth modern finishes, not as pattern. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  function canvas(size) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    return cv;
  }

  function finish(cv, repeatX, repeatY, srgb) {
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 4;
    if (srgb !== false) { t.colorSpace = THREE.SRGBColorSpace; }
    return t;
  }

  /** Fine speckle, used to break up flat paint without reading as noise. */
  function speckle(g, size, count, light, dark, maxAlpha) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * maxAlpha;
      g.fillStyle = (Math.random() > 0.5 ? light : dark).replace('$A', a.toFixed(3));
      g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
  }

  var cache = {};
  function memo(key, make) {
    if (!cache[key]) { cache[key] = make(); }
    return cache[key];
  }

  /* ---------------- architectural finishes ---------------- */

  /** Smooth troweled plaster / render. `hex` is a CSS colour string. */
  SRR.texPlaster = function (hex) {
    return memo('plaster' + hex, function () {
      var s = 256, cv = canvas(s), g = cv.getContext('2d');
      g.fillStyle = hex;
      g.fillRect(0, 0, s, s);
      // very soft trowel clouds
      for (var i = 0; i < 26; i++) {
        var r = 30 + Math.random() * 70;
        var grd = g.createRadialGradient(
          Math.random() * s, Math.random() * s, 0,
          Math.random() * s, Math.random() * s, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.05)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      }
      speckle(g, s, 2600, 'rgba(255,255,255,$A)', 'rgba(0,0,0,$A)', 0.05);
      return finish(cv, 3, 3);
    });
  };

  /** Fine polished concrete for the terrace deck and paving. */
  SRR.texConcrete = function () {
    return memo('concrete', function () {
      var s = 256, cv = canvas(s), g = cv.getContext('2d');
      g.fillStyle = '#b9b8b4';
      g.fillRect(0, 0, s, s);
      for (var i = 0; i < 20; i++) {
        var grd = g.createRadialGradient(
          Math.random() * s, Math.random() * s, 0,
          Math.random() * s, Math.random() * s, 40 + Math.random() * 80);
        grd.addColorStop(0, 'rgba(255,255,255,0.06)');
        grd.addColorStop(1, 'rgba(120,120,118,0.04)');
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      }
      speckle(g, s, 4200, 'rgba(255,255,255,$A)', 'rgba(60,60,58,$A)', 0.10);
      return finish(cv, 4, 4);
    });
  };

  /** Warm timber with a straight grain, for the slat screen and soffits. */
  SRR.texWood = function () {
    return memo('wood', function () {
      var s = 256, cv = canvas(s), g = cv.getContext('2d');
      g.fillStyle = '#b2793f';
      g.fillRect(0, 0, s, s);
      for (var y = 0; y < s; y += 1) {
        var v = Math.sin(y * 0.55) * 0.5 + Math.sin(y * 0.13) * 0.5;
        g.fillStyle = 'rgba(' + (v > 0 ? '255,226,180' : '96,58,22') + ','
                    + (0.05 + Math.abs(v) * 0.07).toFixed(3) + ')';
        g.fillRect(0, y, s, 1);
      }
      // occasional darker grain lines
      for (var i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(88,52,18,' + (0.06 + Math.random() * 0.12).toFixed(3) + ')';
        g.fillRect(0, Math.random() * s, s, 1 + Math.random() * 1.5);
      }
      return finish(cv, 2, 2);
    });
  };

  /** Mown lawn: dense fine speckle, no visible tiling. */
  SRR.texLawn = function () {
    return memo('lawn', function () {
      var s = 256, cv = canvas(s), g = cv.getContext('2d');
      g.fillStyle = '#4c7a33';
      g.fillRect(0, 0, s, s);
      for (var i = 0; i < 14000; i++) {
        var light = Math.random() > 0.5;
        g.fillStyle = light
          ? 'rgba(126,171,84,' + (0.10 + Math.random() * 0.30).toFixed(3) + ')'
          : 'rgba(38,64,26,' + (0.10 + Math.random() * 0.30).toFixed(3) + ')';
        g.fillRect(Math.random() * s, Math.random() * s, 1, 1 + Math.random() * 2);
      }
      return finish(cv, 14, 14);
    });
  };

  /* ---------------- canopy fabric ---------------- */

  /**
   * Woven awning cloth: warp and weft threads plus fibre slubs. Also used as a
   * bump map so the weave catches the light instead of reading as flat colour.
   */
  SRR.texFabric = function () {
    return memo('fabric', function () {
      var s = 256, cv = canvas(s), g = cv.getContext('2d');
      g.fillStyle = '#efc637';
      g.fillRect(0, 0, s, s);
      for (var i = 0; i < s; i += 4) {
        var lit = (i / 4) % 2 === 0;
        g.fillStyle = lit ? 'rgba(255,246,205,0.16)' : 'rgba(120,84,10,0.13)';
        g.fillRect(i, 0, 2, s);
        g.fillStyle = lit ? 'rgba(120,84,10,0.13)' : 'rgba(255,246,205,0.16)';
        g.fillRect(0, i, s, 2);
      }
      for (var n = 0; n < 1100; n++) {
        g.fillStyle = Math.random() > 0.5
          ? 'rgba(255,244,196,0.18)' : 'rgba(108,74,8,0.16)';
        g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1);
      }
      return finish(cv, 7, 7);
    });
  };
}(window.SRR));
