/* Instanced rain streaks and the sunny <-> raining transition. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;

  /**
   * @param blockHeightAt  function(x, z) -> y at which the building stops rain
   *                       (terrace, lower roof, bulkhead, or 0 for open ground)
   */
  function RainSystem(scene, roof, blockHeightAt, dropCount) {
    this.roof = roof;
    this.blockHeightAt = blockHeightAt || function () { return 0; };
    this.enabled = false;
    this.intensity = 1;      // target density, 0..1
    this.density = 0;        // current density, ramps toward intensity
    this.speed = 1;
    this.wind = 0.15;
    this.dropCount = dropCount || 2200;

    var geo = new THREE.BoxGeometry(0.010, 0.34, 0.010);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x9ccbe8, transparent: true, opacity: 0.5
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.dropCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'RainSystem';
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // spawn volume covers the whole plot, so rain falls on house and garden
    this.spanX = 13.0;
    this.z0 = -12.0;
    this.z1 = 12.0;
    this.spawnY = 14;

    this.pos = [];
    this.spd = [];
    this._dummy = new THREE.Object3D();
    for (var i = 0; i < this.dropCount; i++) {
      this.pos.push(new THREE.Vector3(0, -20, 0));
      this.spd.push(5.5 + Math.random() * 2.5);
    }
  }

  RainSystem.prototype.start = function () {
    this.enabled = true;
    this.mesh.visible = true;
  };

  RainSystem.prototype.stop = function () { this.enabled = false; };

  RainSystem.prototype._respawn = function (i) {
    this.pos[i].set(
      (Math.random() * 2 - 1) * this.spanX,
      this.spawnY + Math.random() * 4,
      this.z0 + Math.random() * (this.z1 - this.z0)
    );
  };

  RainSystem.prototype.update = function (dt) {
    var target = this.enabled ? this.intensity : 0;
    this.density += SRR.clamp(target - this.density, -dt * 0.7, dt * 0.7);
    if (!this.mesh.visible) { return; }

    var active = Math.floor(this.dropCount * this.density);
    var anyAlive = false;

    for (var i = 0; i < this.dropCount; i++) {
      var p = this.pos[i];

      if (i < active && p.y < -15 && this.enabled) { this._respawn(i); }

      if (p.y > -15) {
        anyAlive = true;
        p.y -= this.spd[i] * this.speed * dt;
        p.x += this.wind * dt;

        // whichever surface is highest at this point stops the drop
        var ch = this.roof.canopyHeightAt(p.x, p.z);
        var hitCanopy = ch !== null && p.y < ch && p.y > ch - 0.6;
        var hitDeck = p.y < this.blockHeightAt(p.x, p.z) + 0.04;

        if (hitCanopy || hitDeck) {
          if (this.enabled && i < active) { this._respawn(i); } else { p.y = -20; }
        }
      }

      this._dummy.position.copy(p);
      this._dummy.rotation.z = -this.wind * 0.08;
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.enabled && !anyAlive) { this.mesh.visible = false; }
  };

  /* ------------------------------------------------------------------ */

  function WeatherManager(sceneMgr, lighting, rain) {
    this.sceneMgr = sceneMgr;
    this.lighting = lighting;
    this.rain = rain;
    this.isRaining = false;
    this.t = 0;                 // 0 sunny .. 1 raining
  }

  WeatherManager.prototype.startRain = function () {
    this.isRaining = true;
    this.rain.start();
  };

  WeatherManager.prototype.stopRain = function () {
    this.isRaining = false;
    this.rain.stop();
  };

  WeatherManager.prototype.update = function (dt) {
    var target = this.isRaining ? 1 : 0;
    this.t += SRR.clamp(target - this.t, -dt * 0.5, dt * 0.5);
    this.sceneMgr.setWeatherTone(this.t);
    this.lighting.setWeather(this.t);
    this.rain.update(dt);
  };

  SRR.RainSystem = RainSystem;
  SRR.WeatherManager = WeatherManager;
}(window.SRR));
