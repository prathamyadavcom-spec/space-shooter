(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const container = $("game-container");
  const WORLD = { x: 16, z: 11 };
  const CAMPAIGN_WAVES = 5;
  const stateUI = {
    menu: $("menu-screen"), how: $("how-screen"), pause: $("pause-screen"),
    result: $("gameover-screen"), hud: $("hud")
  };

  let scene, camera, renderer, clock, player, starField;
  let state = "MENU", mode = "CAMPAIGN";
  let score = 0, kills = 0, health = 3, wave = 1, waveKills = 0;
  let elapsed = 0, spawnTimer = 0, bannerTimer = 0, pickupTimer = 0;
  let fireCooldown = 0, damageCooldown = 0, rapidTimer = 0, spreadTimer = 0, shieldTimer = 0;
  let soundOn = true, audioContext = null, mouseDown = false, gameOverHandled = false;
  let aimPoint = new THREE.Vector3(0, 0, 0), nextId = 1;
  let keys = Object.create(null), touchMove = { x: 0, z: 0 }, touchFiring = false;
  let bestScore = readBest();
  const enemies = [], shots = [], enemyShots = [], pickups = [], particles = [], decorations = [];

  const ui = {
    score: $("score"), wave: $("wave"), health: $("health"), kills: $("kills"),
    best: $("menu-best"), banner: $("wave-banner"), bannerTitle: $("wave-title"),
    bannerKicker: $("wave-kicker"), pickup: $("pickup-message")
  };

  function readBest() {
    try { return Number(localStorage.getItem("galaxySurvivorBest")) || 0; }
    catch { return 0; }
  }
  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem("galaxySurvivorBest", String(bestScore)); } catch {}
    }
    ui.best.textContent = String(bestScore).padStart(6, "0");
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#080a20");
    scene.fog = new THREE.FogExp2("#080a20", 0.009);

    camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 180);
    camera.position.set(0, 29, 13);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#b4d7ff", "#25204d", 2.1));
    const sun = new THREE.DirectionalLight("#ffffff", 2);
    sun.position.set(-5, 15, 8);
    scene.add(sun);
    const blueLight = new THREE.PointLight("#54dfff", 28, 35);
    blueLight.position.set(-8, 5, -5);
    scene.add(blueLight);
    const purpleLight = new THREE.PointLight("#a76cff", 24, 35);
    purpleLight.position.set(8, 4, 5);
    scene.add(purpleLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 65),
      new THREE.MeshStandardMaterial({ color: "#11142f", roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.22;
    scene.add(floor);

    const grid = new THREE.GridHelper(60, 40, "#4842a0", "#24264d");
    grid.position.y = -0.17;
    grid.material.transparent = true;
    grid.material.opacity = 0.48;
    scene.add(grid);

    const boundaryMat = new THREE.MeshBasicMaterial({ color: "#47dcff", transparent: true, opacity: 0.65 });
    addBoundary(-WORLD.x, 0, 0, boundaryMat, 0.08, 0.08, WORLD.z * 2);
    addBoundary(WORLD.x, 0, 0, boundaryMat, 0.08, 0.08, WORLD.z * 2);
    addBoundary(0, 0, -WORLD.z, boundaryMat, WORLD.x * 2, 0.08, 0.08);
    addBoundary(0, 0, WORLD.z, boundaryMat, WORLD.x * 2, 0.08, 0.08);

    createStars();
    createDecorations();
    createPlayer();
    clock = new THREE.Clock();
    bindEvents();
    ui.best.textContent = String(bestScore).padStart(6, "0");
    resize();
    animate();
  }

  function addBoundary(x, y, z, material, sx, sy, sz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  }

  function createStars() {
    const count = 1000, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const a = new THREE.Color("#73dcff"), b = new THREE.Color("#bfa0ff");
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - .5) * 135;
      positions[i * 3 + 1] = Math.random() * 25 + 2;
      positions[i * 3 + 2] = (Math.random() - .5) * 110;
      const c = Math.random() > .5 ? a : b;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    starField = new THREE.Points(geo, new THREE.PointsMaterial({ size: .14, vertexColors: true, transparent: true, opacity: .9 }));
    scene.add(starField);
  }

  function createDecorations() {
    const colors = ["#4b4c80", "#635187", "#375a78", "#765b8f"];
    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(.3 + Math.random() * .7, 1),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: .95, flatShading: true })
      );
      mesh.position.set((Math.random() - .5) * 58, -.02, (Math.random() - .5) * 43);
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      mesh.userData.spin = (Math.random() - .5) * .35;
      scene.add(mesh); decorations.push(mesh);
    }
  }

  function createPlayer() {
    player = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(.62, 1.75, 6),
      new THREE.MeshStandardMaterial({ color: "#71efff", emissive: "#0878ad", emissiveIntensity: .65, metalness: .3, roughness: .3, flatShading: true })
    );
    body.rotation.x = Math.PI / 2; body.position.y = .45; player.add(body);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(.31, 12, 10),
      new THREE.MeshStandardMaterial({ color: "#e5ffff", emissive: "#50dfff", emissiveIntensity: 1.3, metalness: .3, roughness: .15 })
    );
    cockpit.scale.set(.72, .45, 1.1); cockpit.position.set(0, .82, .1); player.add(cockpit);

    const wingMat = new THREE.MeshStandardMaterial({ color: "#a78bfa", emissive: "#5225b7", emissiveIntensity: .5, flatShading: true });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(.15, .14, 1), wingMat);
      wing.position.set(side * .48, .28, -.08); wing.rotation.y = side * -.18; player.add(wing);
    }

    const engine = new THREE.Mesh(
      new THREE.ConeGeometry(.23, .85, 8),
      new THREE.MeshBasicMaterial({ color: "#ff8af3", transparent: true, opacity: .85 })
    );
    engine.rotation.x = -Math.PI / 2; engine.position.set(0, .3, -.8); player.add(engine);
    player.userData.engine = engine;

    const shield = new THREE.Mesh(
      new THREE.TorusGeometry(.9, .035, 6, 36),
      new THREE.MeshBasicMaterial({ color: "#5feaff", transparent: true, opacity: .8 })
    );
    shield.rotation.x = Math.PI / 2; shield.position.y = .1; shield.name = "shield"; shield.visible = false; player.add(shield);

    player.position.set(0, 0, 5);
    player.userData.speed = 10;
    scene.add(player);
  }

  function material(color, emissive = color) {
    return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .38, roughness: .55, metalness: .12, flatShading: true });
  }

  function spawnEnemy(type) {
    if (state !== "PLAYING") return;
    const cfg = {
      scout: { r: .58, hp: 1, speed: 3.35, points: 100, color: "#ff779b" },
      chaser: { r: .76, hp: 2, speed: 2.3, points: 150, color: "#ffac64" },
      heavy: { r: 1.03, hp: 5, speed: 1.25, points: 250, color: "#b88bff" }
    }[type];

    const group = new THREE.Group();
    const geo = type === "scout" ? new THREE.OctahedronGeometry(cfg.r, 0)
      : type === "chaser" ? new THREE.IcosahedronGeometry(cfg.r, 1)
      : new THREE.DodecahedronGeometry(cfg.r, 1);
    const core = new THREE.Mesh(geo, material(cfg.color));
    core.position.y = .45; group.add(core);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * .22, 10, 8), new THREE.MeshBasicMaterial({ color: "#fff1ff" }));
    eye.position.set(0, .65, cfg.r * .8); group.add(eye);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * 1.2, 10, 8), new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: .1, depthWrite: false }));
    aura.position.y = .42; group.add(aura);

    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const edge = Math.floor(Math.random() * 4);
      x = edge === 0 ? -WORLD.x + 1 : edge === 1 ? WORLD.x - 1 : Math.random() * WORLD.x * 2 - WORLD.x;
      z = edge === 2 ? -WORLD.z + 1 : edge === 3 ? WORLD.z - 1 : Math.random() * WORLD.z * 2 - WORLD.z;
      if (Math.hypot(x - player.position.x, z - player.position.z) > 7) break;
    }
    group.position.set(x, 0, z); scene.add(group);
    enemies.push({
      id: nextId++, mesh: group, type, radius: cfg.r, hp: cfg.hp, speed: cfg.speed * (1 + (wave - 1) * .055),
      points: cfg.points, phase: Math.random() * Math.PI * 2, shootTimer: 1.7 + Math.random() * 1.8, alive: true
    });
  }

  function addProjectile(position, direction, friendly = true) {
    const color = friendly ? "#68f4ff" : "#ff638d";
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(friendly ? .13 : .16, 8, 6), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(position); mesh.position.y = .55; scene.add(mesh);
    const light = new THREE.PointLight(color, .6, 2);
    light.position.copy(mesh.position); scene.add(light);
    (friendly ? shots : enemyShots).push({
      mesh, light, velocity: direction.clone().normalize().multiplyScalar(friendly ? 20 : 7),
      life: friendly ? 1.6 : 3.2, damage: 1
    });
  }

  function removeProjectile(p, list, index) {
    scene.remove(p.mesh); scene.remove(p.light);
    p.mesh.geometry.dispose(); p.mesh.material.dispose();
    list.splice(index, 1);
  }

  function spawnPickup(position) {
    const types = ["RAPID FIRE", "SPREAD SHOT", "SHIELD", "ENERGY"];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = { "RAPID FIRE": "#ffe16b", "SPREAD SHOT": "#ff8be7", "SHIELD": "#62eaff", "ENERGY": "#75ffae" };
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(.46, 0),
      new THREE.MeshStandardMaterial({ color: colors[type], emissive: colors[type], emissiveIntensity: 1.0, roughness: .25 })
    );
    mesh.position.set(position.x, .65, position.z); scene.add(mesh);
    pickups.push({ mesh, type, life: 12, phase: Math.random() * Math.PI * 2 });
  }

  function showPickup(text) {
    ui.pickup.textContent = text; pickupTimer = 1.5;
  }

  function applyPickup(p) {
    if (p.type === "RAPID FIRE") rapidTimer = Math.max(rapidTimer, 8);
    if (p.type === "SPREAD SHOT") spreadTimer = Math.max(spreadTimer, 8);
    if (p.type === "SHIELD") shieldTimer = Math.max(shieldTimer, 6);
    if (p.type === "ENERGY") { health = Math.min(3, health + 1); score += 25; }
    const ring = player.getObjectByName("shield");
    if (ring) ring.visible = shieldTimer > 0;
    showPickup(p.type + " ACTIVATED!");
    playSound("pickup"); updateHUD();
  }

  function burst(position, color, count = 9) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.05 + Math.random() * .08, 5, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      mesh.position.copy(position); scene.add(mesh);
      const angle = Math.random() * Math.PI * 2, speed = 1.5 + Math.random() * 4.5;
      particles.push({
        mesh, velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 2, Math.sin(angle) * speed),
        life: .35 + Math.random() * .5, maxLife: .85
      });
    }
  }

  function disposeObject(object) {
    object.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => mat.dispose());
      }
    });
    scene.remove(object);
  }

  function ensureAudio() {
    if (!soundOn) return;
    try {
      if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext = new AudioCtx();
      }
      if (audioContext.state === "suspended") audioContext.resume();
    } catch {}
  }

  function playSound(kind) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioContext || audioContext.state !== "running") return;
    const tones = {
      shoot: [540, .045, "square", .022], hit: [180, .09, "triangle", .045],
      explosion: [85, .18, "sawtooth", .045], pickup: [760, .14, "sine", .045],
      damage: [105, .2, "sawtooth", .04], wave: [420, .2, "sine", .035], victory: [880, .3, "sine", .05]
    };
    const [freq, duration, type, volume] = tones[kind] || tones.hit;
    try {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * .62), audioContext.currentTime + duration);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(); osc.stop(audioContext.currentTime + duration);
    } catch {}
  }

  function bindEvents() {
    addEventListener("resize", resize);
    addEventListener("keydown", e => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      keys[key] = true;
      if (e.repeat) return;
      if (key === "p" || key === "escape") {
        if (state === "PLAYING") pauseGame();
        else if (state === "PAUSED") resumeGame();
      }
      if (key === "r" && state === "GAME_OVER") startGame(mode);
      if (key === "m") toggleSound();
    });
    addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
    addEventListener("blur", () => {
      keys = Object.create(null); mouseDown = false; touchFiring = false;
      if (state === "PLAYING") pauseGame();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state === "PLAYING") pauseGame();
    });

    renderer.domElement.addEventListener("pointermove", updateAim);
    renderer.domElement.addEventListener("pointerdown", e => {
      if (e.pointerType === "touch" || state !== "PLAYING") return;
      mouseDown = true; ensureAudio(); fire();
    });
    addEventListener("pointerup", () => { mouseDown = false; });

    $("campaign-btn").addEventListener("click", () => startGame("CAMPAIGN"));
    $("endless-btn").addEventListener("click", () => startGame("ENDLESS"));
    $("how-btn").addEventListener("click", () => showScreen("how"));
    $("back-btn").addEventListener("click", () => showScreen("menu"));
    $("pause-btn").addEventListener("click", () => state === "PLAYING" ? pauseGame() : state === "PAUSED" ? resumeGame() : null);
    $("resume-btn").addEventListener("click", resumeGame);
    $("pause-menu-btn").addEventListener("click", () => showScreen("menu"));
    $("restart-btn").addEventListener("click", () => startGame(mode));
    $("result-menu-btn").addEventListener("click", () => showScreen("menu"));
    $("sound-btn").addEventListener("click", toggleSound);

    // Touch joystick.
    const joystick = $("joystick"), knob = $("joystick-knob");
    let joyPointer = null;
    function moveJoystick(e) {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = rect.width * .32, length = Math.hypot(dx, dy);
      if (length > max) { dx = dx / length * max; dy = dy / length * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchMove.x = dx / max;
      touchMove.z = dy / max;
    }
    joystick.addEventListener("pointerdown", e => {
      joyPointer = e.pointerId; joystick.setPointerCapture(joyPointer); moveJoystick(e); ensureAudio();
    });
    joystick.addEventListener("pointermove", e => { if (e.pointerId === joyPointer) moveJoystick(e); });
    const resetJoystick = e => {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null; touchMove = { x: 0, z: 0 }; knob.style.transform = "translate(0, 0)";
    };
    joystick.addEventListener("pointerup", resetJoystick);
    joystick.addEventListener("pointercancel", resetJoystick);

    const fireButton = $("touch-fire");
    fireButton.addEventListener("pointerdown", e => {
      e.preventDefault(); touchFiring = true; ensureAudio();
      fireButton.setPointerCapture(e.pointerId);
    });
    fireButton.addEventListener("pointerup", () => { touchFiring = false; });
    fireButton.addEventListener("pointercancel", () => { touchFiring = false; });
    fireButton.addEventListener("lostpointercapture", () => { touchFiring = false; });
  }

  function updateAim(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, point)) aimPoint.copy(point);
  }

  function resize() {
    if (!camera || !renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.setSize(innerWidth, innerHeight);
  }

  function toggleSound() {
    soundOn = !soundOn;
    $("sound-btn").textContent = soundOn ? "♫" : "×";
    $("sound-btn").setAttribute("aria-label", soundOn ? "Mute sound" : "Enable sound");
    if (soundOn) { ensureAudio(); playSound("pickup"); }
  }

  function hideScreens() {
    Object.values(stateUI).forEach(el => {
      if (el !== stateUI.hud) el.classList.add("hidden");
    });
  }

  function showScreen(name) {
    hideScreens();
    if (name === "menu" || name === "how") {
      state = name === "menu" ? "MENU" : "HOW";
      stateUI[name].classList.remove("hidden");
      stateUI.hud.classList.add("hidden");
      $("pause-btn").classList.add("hidden");
      keys = Object.create(null); mouseDown = false; touchFiring = false;
    } else if (name === "pause") {
      state = "PAUSED"; stateUI.pause.classList.remove("hidden");
      stateUI.hud.classList.remove("hidden"); $("pause-btn").classList.remove("hidden");
      keys = Object.create(null); mouseDown = false; touchFiring = false;
    } else if (name === "result") {
      state = "GAME_OVER"; stateUI.result.classList.remove("hidden");
      stateUI.hud.classList.add("hidden"); $("pause-btn").classList.add("hidden");
      keys = Object.create(null); mouseDown = false; touchFiring = false;
    }
  }

  function clearDynamicObjects() {
    for (const list of [enemies, pickups, particles]) {
      while (list.length) {
        const item = list.pop();
        if (item.mesh) disposeObject(item.mesh);
      }
    }
    for (const list of [shots, enemyShots]) {
      while (list.length) {
        const item = list.pop();
        scene.remove(item.mesh); scene.remove(item.light);
        item.mesh.geometry.dispose(); item.mesh.material.dispose();
      }
    }
  }

  function startGame(selectedMode) {
    ensureAudio();
    clearDynamicObjects();
    mode = selectedMode; state = "PLAYING";
    score = 0; kills = 0; health = 3; wave = 1; waveKills = 0;
    elapsed = 0; spawnTimer = .8; bannerTimer = 2.1; pickupTimer = 0;
    fireCooldown = 0; damageCooldown = 0; rapidTimer = 0; spreadTimer = 0; shieldTimer = 0;
    gameOverHandled = false; keys = Object.create(null); mouseDown = false;
    touchMove = { x: 0, z: 0 }; touchFiring = false;
    player.position.set(0, 0, 5); player.rotation.set(0, 0, 0); player.visible = true;
    aimPoint.set(0, 0, 0);
    const shield = player.getObjectByName("shield");
    if (shield) shield.visible = false;
    ui.bannerTitle.textContent = "SECTOR 01";
    ui.bannerKicker.textContent = "INCOMING TRANSMISSION";
    ui.banner.classList.remove("hidden");
    ui.pickup.textContent = "";
    hideScreens(); stateUI.hud.classList.remove("hidden"); $("pause-btn").classList.remove("hidden");
    updateHUD(); playSound("wave");
  }

  function pauseGame() {
    if (state !== "PLAYING") return;
    showScreen("pause");
  }
  function resumeGame() {
    if (state !== "PAUSED") return;
    ensureAudio(); stateUI.pause.classList.add("hidden");
    state = "PLAYING"; stateUI.hud.classList.remove("hidden"); $("pause-btn").classList.remove("hidden");
    clock.getDelta();
  }

  function finishGame(victory) {
    if (gameOverHandled) return;
    gameOverHandled = true; saveBest();
    $("result-eyebrow").textContent = victory ? "MISSION ACCOMPLISHED" : "SIGNAL LOST";
    $("result-title").innerHTML = victory ? "MISSION <span>COMPLETE</span>" : "MISSION <span>FAILED</span>";
    $("result-copy").textContent = victory ? "Outstanding, pilot. The galaxy is safe... for now." : "Your ship has reached its limit. Ready to try again?";
    $("final-score").textContent = score.toLocaleString();
    $("final-kills").textContent = String(kills);
    $("final-wave").textContent = String(wave);
    showScreen("result");
    playSound(victory ? "victory" : "explosion");
  }

  function updateHUD() {
    ui.score.textContent = String(score).padStart(6, "0");
    ui.wave.innerHTML = mode === "CAMPAIGN" ? `${String(wave).padStart(2, "0")} <small>/ 05</small>` : `${String(wave).padStart(2, "0")} <small>/ ∞</small>`;
    ui.kills.textContent = String(kills);
    ui.health.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement("span");
      pip.textContent = "♥";
      if (i >= health) pip.classList.add("lost");
      ui.health.appendChild(pip);
    }
  }

  function fire() {
    if (state !== "PLAYING" || fireCooldown > 0) return;
    fireCooldown = rapidTimer > 0 ? .105 : .23;
    const dir = new THREE.Vector3(aimPoint.x - player.position.x, 0, aimPoint.z - player.position.z);
    if (dir.lengthSq() < .001) dir.set(0, 0, -1);
    dir.normalize();
    player.rotation.y = Math.atan2(dir.x, dir.z);
    const origin = player.position.clone().add(dir.clone().multiplyScalar(.95));
    if (spreadTimer > 0) {
      [-.25, 0, .25].forEach(angle => addProjectile(origin, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle), true));
    } else addProjectile(origin, dir, true);
    playSound("shoot");
  }

  function damagePlayer() {
    if (state !== "PLAYING" || damageCooldown > 0) return;
    if (shieldTimer > 0) { burst(player.position, "#62eaff", 5); playSound("hit"); return; }
    health = Math.max(0, health - 1); damageCooldown = 1.05;
    burst(player.position, "#ff628f", 12); playSound("damage"); updateHUD();
    if (health === 0) finishGame(false);
  }

  function destroyEnemy(enemy, index) {
    if (!enemy.alive) return;
    enemy.alive = false; score += enemy.points; kills++; waveKills++;
    const pos = enemy.mesh.position.clone();
    burst(pos, enemy.type === "heavy" ? "#b88bff" : "#ff91b7", 11);
    disposeObject(enemy.mesh); enemies.splice(index, 1);
    if (Math.random() < .24) spawnPickup(pos);
    playSound("explosion"); updateHUD();
  }

  function updatePlayer(dt) {
    const x = Number(keys.d || keys.arrowright) - Number(keys.a || keys.arrowleft) + touchMove.x;
    const z = Number(keys.s || keys.arrowdown) - Number(keys.w || keys.arrowup) + touchMove.z;
    const move = new THREE.Vector3(x, 0, z);
    if (move.lengthSq() > 1) move.normalize();
    player.position.addScaledVector(move, player.userData.speed * dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD.x + .7, WORLD.x - .7);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD.z + .7, WORLD.z - .7);

    const ax = aimPoint.x - player.position.x, az = aimPoint.z - player.position.z;
    if (ax * ax + az * az > .01) player.rotation.y = Math.atan2(ax, az);
    player.rotation.z = THREE.MathUtils.clamp(-x * .09, -.16, .16);
    player.userData.engine.scale.setScalar(.8 + Math.random() * .35);
    if (mouseDown || keys[" "] || touchFiring) fire();

    if (damageCooldown > 0) {
      damageCooldown -= dt;
      player.visible = Math.floor(damageCooldown * 13) % 2 === 0;
    } else player.visible = true;

    fireCooldown = Math.max(0, fireCooldown - dt);
    rapidTimer = Math.max(0, rapidTimer - dt);
    spreadTimer = Math.max(0, spreadTimer - dt);
    shieldTimer = Math.max(0, shieldTimer - dt);
    const shield = player.getObjectByName("shield");
    if (shield) { shield.visible = shieldTimer > 0; shield.rotation.z += dt * .7; }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const toPlayer = new THREE.Vector3(player.position.x - e.mesh.position.x, 0, player.position.z - e.mesh.position.z);
      const distance = toPlayer.length();
      if (distance > .001) toPlayer.normalize();
      const movement = toPlayer.clone();
      if (e.type === "scout") {
        movement.x += Math.sin(elapsed * 2.2 + e.phase) * .15;
        movement.z += Math.cos(elapsed * 2.2 + e.phase) * .15;
      }
      if (distance > 1.2) e.mesh.position.addScaledVector(movement.normalize(), e.speed * dt);
      else damagePlayer();

      e.mesh.rotation.x += dt * .45; e.mesh.rotation.z += dt * .55;
      e.mesh.position.y = Math.sin(elapsed * 2 + e.phase) * .07;

      if (e.type === "heavy" || e.type === "chaser") {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && distance < 14 && state === "PLAYING") {
          addProjectile(e.mesh.position.clone(), player.position.clone().sub(e.mesh.position), false);
          e.shootTimer = e.type === "heavy" ? 2.5 : 3.6;
        }
      }
      if (distance < e.radius + .38) damagePlayer();
      if (state !== "PLAYING") return;
    }
  }

  function updateProjectiles(dt, list, friendly) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.light.position.copy(p.mesh.position);
      if (p.life <= 0 || Math.abs(p.mesh.position.x) > WORLD.x + 3 || Math.abs(p.mesh.position.z) > WORLD.z + 3) {
        removeProjectile(p, list, i); continue;
      }
      if (friendly) {
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (p.mesh.position.distanceTo(e.mesh.position) < e.radius + .22) {
            e.hp -= p.damage; burst(p.mesh.position, "#68f4ff", 3); playSound("hit");
            if (e.hp <= 0) destroyEnemy(e, j);
            removeProjectile(p, list, i); hit = true; break;
          }
        }
        if (hit) continue;
      } else if (p.mesh.position.distanceTo(player.position) < .72) {
        damagePlayer(); removeProjectile(p, list, i);
      }
    }
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.life -= dt; p.phase += dt;
      p.mesh.rotation.y += dt * 1.7; p.mesh.rotation.x += dt * .8;
      p.mesh.position.y = .65 + Math.sin(p.phase * 3) * .12;
      if (p.mesh.position.distanceTo(player.position) < 1.15) {
        applyPickup(p); disposeObject(p.mesh); pickups.splice(i, 1);
      } else if (p.life <= 0) { disposeObject(p.mesh); pickups.splice(i, 1); }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(Math.max(0, 1 - dt * 1.5));
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) { disposeObject(p.mesh); particles.splice(i, 1); }
    }
  }

  function updateWaves(dt) {
    spawnTimer -= dt;
    const targetKills = 5 + wave * 3;
    if (spawnTimer <= 0 && waveKills < targetKills) {
      const roll = Math.random();
      const type = wave >= 3 && roll > .82 ? "heavy" : wave >= 2 && roll > .55 ? "chaser" : "scout";
      spawnEnemy(type);
      spawnTimer = Math.max(.48, 1.55 - wave * .12);
    }

    if (waveKills >= targetKills && enemies.length === 0) {
      if (mode === "CAMPAIGN" && wave >= CAMPAIGN_WAVES) {
        score += 1000; updateHUD(); finishGame(true); return;
      }
      score += 500; wave++; waveKills = 0; spawnTimer = 2;
      bannerTimer = 2.2;
      ui.bannerTitle.textContent = "SECTOR " + String(wave).padStart(2, "0");
      ui.bannerKicker.textContent = "SECTOR CLEARED · BONUS +500";
      ui.banner.classList.remove("hidden");
      playSound("wave"); updateHUD();
    }
  }

  function updateEffects(dt) {
    if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) ui.banner.classList.add("hidden");
    if (pickupTimer > 0 && (pickupTimer -= dt) <= 0) ui.pickup.textContent = "";
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), .04);
    elapsed += dt;
    starField.rotation.y += dt * .002;
    decorations.forEach(d => { d.rotation.y += dt * d.userData.spin; d.rotation.x += dt * d.userData.spin * .5; });

    if (state === "PLAYING") {
      updatePlayer(dt);
      updateEnemies(dt);
      updateProjectiles(dt, shots, true);
      updateProjectiles(dt, enemyShots, false);
      updatePickups(dt);
      updateParticles(dt);
      updateWaves(dt);
      updateEffects(dt);
      if (score > bestScore) ui.best.textContent = String(score).padStart(6, "0");
    } else updateParticles(dt);

    renderer.render(scene, camera);
  }

  init();
})();
