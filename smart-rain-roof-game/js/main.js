/* Bootstrap: build the world, wire the simulation, run the loop. */
(function (SRR) {
  'use strict';

  var TEST = /[?&]test=1/.test(window.location.search);
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('stage');

  /* ---------------- core ---------------- */
  var rendererMgr = new SRR.RendererManager(canvas, TEST);
  var sceneMgr = new SRR.SceneManager();
  var scene = sceneMgr.scene;
  var lighting = new SRR.LightingManager(scene);
  var cameraMgr = new SRR.CameraManager(canvas);

  /* ---------------- world ---------------- */
  var ground = new SRR.Ground(scene);
  var house = new SRR.House(scene);
  var roof = new SRR.RoofSystem(scene);
  var servo = new SRR.ServoMotor(scene);
  var sensor = new SRR.RainSensor(scene);
  var arduino = new SRR.Arduino(scene);
  var rack = new SRR.ClothesRack(scene);
  var wiring = new SRR.Wiring(scene, { sensor: sensor, arduino: arduino, servo: servo });

  /* ---------------- teaching modes ---------------- */
  var teachParts = {
    house: house, roof: roof, servo: servo, sensor: sensor,
    arduino: arduino, rack: rack, wiring: wiring
  };
  var build = new SRR.BuildGuide(teachParts);
  // The rack and clothes establish the problem from frame one; only the smart
  // protection-system parts are hidden until the learner installs them.
  build.reset();
  var exploded = new SRR.ExplodedView(teachParts);

  /* ---------------- weather + simulation ---------------- */
  var rain = new SRR.RainSystem(
    scene, roof,
    function (x, z) { return house.blockHeightAt(x, z); },
    REDUCED ? 900 : 2600
  );
  var weather = new SRR.WeatherManager(sceneMgr, lighting, rain);
  var controller = new SRR.SimulationController({
    weather: weather,
    sensor: sensor,
    arduino: arduino,
    servo: servo,
    roof: roof
  });

  /* ---------------- UI ---------------- */
  var ui = new SRR.UIController({
    controller: controller,
    weather: weather,
    cameraManager: cameraMgr,
    sensor: sensor,
    roof: roof,
    servo: servo,
    lighting: lighting,
    build: build,
    exploded: exploded,
    scene: scene,
    pickTargets: [
      { key: 'sensor',  objects: [sensor.group] },
      { key: 'servo',   objects: [servo.group] },
      { key: 'arduino', objects: [arduino.group, arduino.battery] },
      { key: 'roof',    objects: [roof.root] },
      { key: 'rack',    objects: [rack.group] },
      { key: 'house',   objects: [house.group] }
    ]
  });

  var codePanel = new SRR.CodePanel({
    controller: controller,
    weather: weather,
    ui: ui
  });
  ui.attachCodePanel(codePanel);
  var story = new SRR.StoryGuide({
    cameraManager: cameraMgr,
    controller: controller,
    codePanel: codePanel
  });

  /* ---------------- resize ---------------- */
  function onResize() { rendererMgr.resize(cameraMgr.camera); }
  window.addEventListener('resize', onResize);
  onResize();

  /* ---------------- loop ---------------- */
  var clock = new THREE.Clock();
  var elapsed = 0;

  function tick(dt) {
    elapsed += dt;
    controller.update(dt);
    weather.update(dt);
    exploded.update(dt);
    rack.update(elapsed, weather.t);
    cameraMgr.update(dt);
    ui.updateStatus();
    ui.updateLabels();
    ui.updateCallouts();
    rendererMgr.render(scene, cameraMgr.camera);
  }

  var lastFrameAt = performance.now();

  function frame() {
    window.requestAnimationFrame(frame);
    lastFrameAt = performance.now();
    tick(Math.min(clock.getDelta(), 0.05));
  }

  // stalled-rAF fallback: browsers pause requestAnimationFrame for hidden or
  // occluded tabs, which would freeze the state machine mid-demo; when no
  // frame has run for a while, keep the simulation alive at 4 Hz instead
  window.setInterval(function () {
    if (!TEST && performance.now() - lastFrameAt > 400) {
      clock.getDelta();          // discard the gap so dt stays sane
      tick(0.25);
    }
  }, 250);

  if (TEST) {
    // deterministic stepping so a hidden/throttled tab cannot starve the loop
    window.__sim = {
      controller: controller, weather: weather, roof: roof, servo: servo,
      sensor: sensor, arduino: arduino, rain: rain, ui: ui,
      cameraMgr: cameraMgr, scene: scene, house: house, rack: rack,
      ground: ground, build: build, exploded: exploded, wiring: wiring
    };
    window.__advance = function (seconds, step) {
      step = step || 1 / 60;
      var n = Math.round(seconds / step);
      for (var i = 0; i < n; i++) { tick(step); }
      return n;
    };
    window.__cap = function (size, q) {
      size = size || 480;
      var c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      c.getContext('2d').drawImage(canvas, 0, 0, size, size);
      return c.toDataURL('image/jpeg', q || 0.6);
    };
    tick(0.016);
  } else {
    frame();
  }
}(window.SRR));
