import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildIndustrialArena, type ArenaData } from './arena';
import { TacticalAudio } from './audio';
import { BotManager } from './bots';
import { EffectsPool } from './effects';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import type { EndReason, GamePhase, HitMarkerType, HudSnapshot, KillFeedItem, TouchInputState } from './types';
import { FirstPersonRifle } from './weapon';

const MATCH_DURATION = 120; // 2:00 tactical training round
const PLAYER_EYE_HEIGHT = 1.68;
const PLAYER_RADIUS = 0.42;
const PLAYER_HEIGHT = 1.82;
const GRAVITY = 22.5;
const JUMP_SPEED = 7.6;
const WALK_SPEED = 6.2;
const SPRINT_SPEED = 9.4;
const ADS_SPEED = 3.9;
const MAG_SIZE = 30;
const START_RESERVE = 150;
const FIRE_INTERVAL = 0.098; // ~612 RPM crisp assault rifle cadence
const RELOAD_DURATION = 1.65;

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function getWaveTarget(wave: number): number {
  return 6 + (wave - 1) * 3;
}

function getObjectiveForWave(wave: number): { title: string; desc: string } {
  if (wave === 1) {
    return {
      title: '第一阶段：基础清道',
      desc: '熟悉三条战术通道并清除标准训练靶机，爆头可造成双倍伤害',
    };
  }
  if (wave === 2) {
    return {
      title: '第二阶段：机动压制',
      desc: '机动突击靶机已部署，利用高台斜坡与右键开镜精准点射',
    };
  }
  return {
    title: `第${wave}阶段：全区高强度演练`,
    desc: '重装防爆靶机投入战场，保持连杀倍率并善用掩体规避火力',
  };
}

export class FrontlineEngine {
  private readonly container: HTMLElement;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private readonly isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private arena!: ArenaData;
  private rifle!: FirstPersonRifle;
  private bots!: BotManager;
  private effects!: EffectsPool;
  private audio = new TacticalAudio();
  private envRT: THREE.WebGLRenderTarget | null = null;

  private disposed = false;
  private frameId = 0;
  private lastFrameTime = 0;
  private hudSyncTimer = 0;

  // Game phase & match telemetry
  private phase: GamePhase = 'title';
  private endReason: EndReason = 'time';
  private score = 0;
  private kills = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private streak = 0;
  private maxStreak = 0;
  private wave = 1;
  private waveKills = 0;
  private timeLeft = MATCH_DURATION;

  // Player vitals & weapon state
  private health = 100;
  private readonly maxHealth = 100;
  private armor = 100;
  private readonly maxArmor = 100;
  private ammo = MAG_SIZE;
  private reserveAmmo = START_RESERVE;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadStageAudio = 0;
  private fireCooldown = 0;

  // Player kinematics
  private readonly playerPos = new THREE.Vector3(0, 0, 20.2);
  private readonly playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private isGrounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private footstepTimer = 0;

  // Combat feel: hitstop, camera shake, recoil kick, hitmarker, damage indicator
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private recoilCamPitch = 0;
  private recoilCamYaw = 0;
  private hitMarkerType: HitMarkerType = 'none';
  private hitMarkerTimer = 0;
  private hitSeq = 0;
  private damageFlash = 0;
  private damageAngle = 0;
  private crosshairSpread = 6;
  private killFeed: KillFeedItem[] = [];
  private nextKillFeedId = 1;
  private titleOrbitAngle = 0.4;

  // Inputs (held vs edge-triggered)
  private readonly keysHeld = new Set<string>();
  private mouseLeftHeld = false;
  private mouseRightHeld = false;
  private pointerLocked = false;
  private sensitivity = 1.0;
  private touchMode = false;
  private touchInput: TouchInputState = {
    moveX: 0,
    moveY: 0,
    firing: false,
    ads: false,
    sprinting: false,
  };
  private webglError: string | null = null;

  // Reusable scratch math objects (zero GC in tick loop)
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _wishDir = new THREE.Vector3();
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _rayDir = new THREE.Vector3();
  private readonly _muzzleWorld = new THREE.Vector3();
  private readonly _ejectWorld = new THREE.Vector3();
  private readonly _hitNormal = new THREE.Vector3();
  private readonly _normalMat = new THREE.Matrix3();
  private readonly _tracerEnd = new THREE.Vector3();
  private readonly _eyePos = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareGl();
    this.touchMode =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 1024;

    this.initThree();
    this.bindEvents();
    this.pushHudSnapshot();
    this.lastFrameTime = performance.now();
    this.scheduleNextFrame();
  }

  private initThree(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglError = '当前浏览器环境无法初始化 WebGL 渲染上下文。';
      return;
    }

    const renderer = this.renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    this.container.innerHTML = '';
    this.container.appendChild(renderer.domElement);

    // Scene + crisp industrial sky/horizon fog
    this.scene = new THREE.Scene();
    const horizonHex = 0x1e2938;
    this.scene.background = new THREE.Color(horizonHex);
    this.scene.fog = new THREE.FogExp2(horizonHex, 0.0155);

    // Mandatory studio environment map for metallic PBR reflections on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    // Camera
    const aspect = (this.container.clientWidth || window.innerWidth) / Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(74, aspect, 0.08, 160);
    this.scene.add(this.camera);

    // Balanced 3-Point Warm/Cool Industrial Lighting Rig (<= 3 shadow casters: 1 main sun directional)
    const hemiLight = new THREE.HemisphereLight(0x9ec5e8, 0x3b3530, 0.72);
    hemiLight.position.set(0, 35, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffdfb8, 2.2);
    sunLight.position.set(22, 34, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.camera.near = 6;
    sunLight.shadow.camera.far = 92;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);

    // Cool rim backlight for strong container & bot edge separation
    const rimLight = new THREE.DirectionalLight(0x7cc4fa, 0.65);
    rimLight.position.set(-24, 18, -22);
    this.scene.add(rimLight);

    // Warm industrial overhead center fill accent
    const centerFill = new THREE.PointLight(0xffcb80, 14, 34, 1.8);
    centerFill.position.set(0, 7.6, 0);
    this.scene.add(centerFill);

    // Procedural Textures + Arena + Weapon + Bots + Pooled Effects
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    this.arena = buildIndustrialArena(this.textures);
    this.scene.add(this.arena.group);

    this.rifle = new FirstPersonRifle();
    this.camera.add(this.rifle.root);
    this.rifle.root.visible = false; // Hidden during title orbital pan

    this.effects = new EffectsPool();
    this.scene.add(this.effects.group);

    this.bots = new BotManager(
      this.arena.botSpawns,
      this.arena.laneWaypoints,
      this.arena.colliders,
      this.arena.arenaHalfSize,
      this.textures.contactShadow,
    );
    this.scene.add(this.bots.group);
    this.bots.resetForSession(this.arena.playerSpawn, 1);

    if (!this.isSoftwareGl) {
      renderer.compile(this.scene, this.camera);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.addEventListener('webglcontextlost', this.handleContextLost);
      canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.webglError = 'WebGL 渲染上下文已中断，正在尝试恢复...';
    this.pushHudSnapshot();
  };

  private handleContextRestored = (): void => {
    this.webglError = null;
    this.pushHudSnapshot();
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private handlePointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer?.domElement;
    this.pointerLocked = locked;
    if (!locked && this.phase === 'playing' && !this.touchMode) {
      // Esc released pointer lock -> cleanly pause game
      this.pauseGame();
    }
    this.pushHudSnapshot();
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    if (this.phase === 'playing') {
      this.pauseGame();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      if (this.phase === 'playing') e.preventDefault();
    }

    if (e.code === 'KeyP' && (this.phase === 'playing' || this.phase === 'paused')) {
      if (this.phase === 'playing') this.pauseGame();
      else this.resumeGame();
      return;
    }

    if (this.phase !== 'playing') return;

    const wasHeld = this.keysHeld.has(e.code);
    this.keysHeld.add(e.code);

    if (!wasHeld) {
      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.12;
      } else if (e.code === 'KeyR') {
        this.triggerReload();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || !this.pointerLocked) return;
    const adsFactor = this.isAdsActive() ? 0.62 : 1.0;
    const scale = 0.0021 * this.sensitivity * adsFactor;
    const dx = THREE.MathUtils.clamp(e.movementX, -140, 140);
    const dy = THREE.MathUtils.clamp(e.movementY, -140, 140);

    this.yaw -= dx * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * scale, -Math.PI * 0.46, Math.PI * 0.46);
    this.rifle.addLookSway(dx, dy);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;

    // If playing on desktop and pointer isn't locked (e.g., user clicked canvas), lock it
    if (!this.pointerLocked && !this.touchMode && e.target === this.renderer?.domElement) {
      this.requestPointerLock();
    }

    this.audio.unlock();
    if (e.button === 0) {
      this.mouseLeftHeld = true;
    } else if (e.button === 2) {
      this.mouseRightHeld = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftHeld = false;
    if (e.button === 2) this.mouseRightHeld = false;
  };

  // --- Public Control API for React Shell ---

  public startNewGame(): void {
    this.audio.unlock();
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.wave = 1;
    this.waveKills = 0;
    this.timeLeft = MATCH_DURATION;
    this.endReason = 'time';

    this.health = this.maxHealth;
    this.armor = this.maxArmor;
    this.ammo = MAG_SIZE;
    this.reserveAmmo = START_RESERVE;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;

    this.playerPos.copy(this.arena.playerSpawn);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0; // Face North toward central arena lanes
    this.pitch = -0.02;
    this.isGrounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.recoilCamPitch = 0;
    this.recoilCamYaw = 0;
    this.hitMarkerType = 'none';
    this.hitMarkerTimer = 0;
    this.damageFlash = 0;
    this.killFeed = [];
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;

    this.effects.reset();
    this.bots.resetForSession(this.playerPos, 1);
    this.rifle.root.visible = true;
    this.phase = 'playing';

    if (!this.touchMode) {
      this.requestPointerLock();
    }
    this.pushHudSnapshot();
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.phase = 'playing';
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    if (!this.touchMode) {
      this.requestPointerLock();
    }
    this.pushHudSnapshot();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    this.pushHudSnapshot();
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    this.rifle.root.visible = false;
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    this.bots.resetForSession(this.arena.playerSpawn, 1);
    this.pushHudSnapshot();
  }

  public toggleMute(): void {
    this.audio.setMuted(!this.audio.isMuted());
    this.pushHudSnapshot();
  }

  public setSensitivity(val: number): void {
    this.sensitivity = THREE.MathUtils.clamp(val, 0.3, 2.5);
    this.pushHudSnapshot();
  }

  public setTouchMode(enabled: boolean): void {
    this.touchMode = enabled;
    if (enabled && document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    this.pushHudSnapshot();
  }

  public setTouchInput(partial: Partial<TouchInputState>): void {
    Object.assign(this.touchInput, partial);
  }

  public applyTouchLook(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    const adsFactor = this.isAdsActive() ? 0.6 : 1.0;
    const scale = 0.0052 * this.sensitivity * adsFactor;
    this.yaw -= dx * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * scale, -Math.PI * 0.46, Math.PI * 0.46);
    this.rifle.addLookSway(dx * 1.4, dy * 1.4);
  }

  public triggerTouchJump(): void {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.jumpBufferTimer = 0.14;
  }

  public triggerReload(): void {
    if (this.phase !== 'playing') return;
    if (this.isReloading) return;
    if (this.ammo >= MAG_SIZE || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = 0;
    this.reloadStageAudio = 0;
    this.audio.playReloadStart();
    this.pushHudSnapshot();
  }

  private requestPointerLock(): void {
    try {
      const el = this.renderer?.domElement;
      if (el && el.requestPointerLock) {
        const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Silently ignore pointer lock rejection (e.g., rapid Esc->click cooldown)
          });
        }
      }
    } catch {
      // Safe fallback
    }
  }

  private isAdsActive(): boolean {
    return (this.mouseRightHeld || this.touchInput.ads) && !this.isReloading;
  }

  private isSprintingActive(): boolean {
    const movingForward = this.keysHeld.has('KeyW') || this.touchInput.moveY > 0.35;
    const wantSprint = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') || this.touchInput.sprinting;
    return movingForward && wantSprint && !this.isAdsActive() && !this.isReloading;
  }

  // --- Physics & Ground Height (Floor + Walkable Ramps + Container Tops) ---

  private getSupportHeightAt(x: number, z: number, currentFeetY: number): number {
    let supportY = 0;

    // 1. Check walkable ramps
    for (let i = 0; i < this.arena.ramps.length; i++) {
      const r = this.arena.ramps[i];
      if (x >= r.minX - 0.15 && x <= r.maxX + 0.15 && z >= r.minZ - 0.15 && z <= r.maxZ + 0.15) {
        let t = 0;
        if (r.ascendDir === '+x') {
          t = (x - r.minX) / Math.max(0.01, r.maxX - r.minX);
        } else if (r.ascendDir === '-x') {
          t = (r.maxX - x) / Math.max(0.01, r.maxX - r.minX);
        } else if (r.ascendDir === '+z') {
          t = (z - r.minZ) / Math.max(0.01, r.maxZ - r.minZ);
        } else {
          t = (r.maxZ - z) / Math.max(0.01, r.maxZ - r.minZ);
        }
        const rampY = THREE.MathUtils.lerp(r.yLow, r.yHigh, THREE.MathUtils.clamp(t, 0, 1));
        if (rampY <= currentFeetY + 0.55) {
          supportY = Math.max(supportY, rampY);
        }
      }
    }

    // 2. Check standing on top of containers, crates, and barriers
    for (let i = 0; i < this.arena.colliders.length; i++) {
      const c = this.arena.colliders[i];
      if (c.tag === 'wall') continue;
      if (
        x + PLAYER_RADIUS * 0.85 > c.minX &&
        x - PLAYER_RADIUS * 0.85 < c.maxX &&
        z + PLAYER_RADIUS * 0.85 > c.minZ &&
        z - PLAYER_RADIUS * 0.85 < c.maxZ
      ) {
        if (c.maxY <= currentFeetY + 0.42) {
          supportY = Math.max(supportY, c.maxY);
        }
      }
    }

    return supportY;
  }

  private resolveHorizontalCollisions(nextX: number, nextZ: number, feetY: number): [number, number] {
    let x = nextX;
    let z = nextZ;
    const limit = this.arena.arenaHalfSize - PLAYER_RADIUS - 0.08;
    x = THREE.MathUtils.clamp(x, -limit, limit);
    z = THREE.MathUtils.clamp(z, -limit, limit);

    for (let i = 0; i < this.arena.colliders.length; i++) {
      const c = this.arena.colliders[i];
      // Skip if player is standing above this box (or able to step onto it smoothly)
      if (feetY >= c.maxY - 0.35 || feetY + PLAYER_HEIGHT <= c.minY) continue;

      const closestX = THREE.MathUtils.clamp(x, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(z, c.minZ, c.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = PLAYER_RADIUS - dist;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        } else {
          // Inside box fallback: push out along smallest penetration axis
          const penLeft = Math.abs(x - c.minX);
          const penRight = Math.abs(c.maxX - x);
          const penBack = Math.abs(z - c.minZ);
          const penFront = Math.abs(c.maxZ - z);
          const minPen = Math.min(penLeft, penRight, penBack, penFront);
          if (minPen === penLeft) x = c.minX - PLAYER_RADIUS;
          else if (minPen === penRight) x = c.maxX + PLAYER_RADIUS;
          else if (minPen === penBack) z = c.minZ - PLAYER_RADIUS;
          else z = c.maxZ + PLAYER_RADIUS;
        }
      }
    }

    return [x, z];
  }

  // --- Shooting & Hit Detection ---

  private attemptFire(): void {
    if (this.isReloading || this.fireCooldown > 0) return;

    if (this.ammo <= 0) {
      this.fireCooldown = 0.25;
      this.audio.playDryFire();
      if (this.reserveAmmo > 0) {
        this.triggerReload();
      }
      return;
    }

    const ads = this.isAdsActive();
    this.ammo--;
    this.shotsFired++;
    this.fireCooldown = FIRE_INTERVAL;

    this.audio.playGunshot(ads);
    this.rifle.triggerFire(ads);

    // Camera recoil kick + subtle micro shake
    const kickMult = ads ? 0.55 : 1.0;
    this.recoilCamPitch = Math.min(this.recoilCamPitch + 0.017 * kickMult, 0.09);
    this.recoilCamYaw += (Math.random() - 0.5) * 0.01 * kickMult;
    this.shakeIntensity = Math.min(this.shakeIntensity + 0.012 * kickMult, 0.045);

    // Eject brass shell casing
    this.rifle.getEjectionWorldPosition(this._ejectWorld);
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.effects.spawnShell(this._ejectWorld, this._right, this._up);

    // Calculate ray with movement & ADS spread
    const speedRatio = Math.hypot(this.playerVel.x, this.playerVel.z) / WALK_SPEED;
    const spreadRad = ads ? 0.0028 + speedRatio * 0.004 : 0.012 + speedRatio * 0.016 + (this.isGrounded ? 0 : 0.02);
    const spreadX = (Math.random() - 0.5) * spreadRad;
    const spreadY = (Math.random() - 0.5) * spreadRad;

    this._rayDir.set(spreadX, spreadY, -1).normalize().applyQuaternion(this.camera.quaternion);
    this._raycaster.set(this.camera.position, this._rayDir);
    this._raycaster.near = 0.1;
    this._raycaster.far = 110;

    // Intersect both arena cover and alive bot hitboxes
    const worldHits = this._raycaster.intersectObjects(this.arena.shootableMeshes, false);
    const worldDist = worldHits.length > 0 ? worldHits[0].distance : Infinity;

    const botHits = this._raycaster.intersectObjects(this.bots.allHitMeshes, false);
    let validBotHit: THREE.Intersection | null = null;
    for (let i = 0; i < botHits.length; i++) {
      const h = botHits[i];
      if (h.distance >= worldDist) break; // Blocked by wall/container!
      const botId = h.object.userData.botId as number | undefined;
      if (botId !== undefined) {
        const bot = this.bots.bots.find((b) => b.id === botId);
        if (bot && bot.alive) {
          validBotHit = h;
          break;
        }
      }
    }

    this.rifle.getMuzzleWorldPosition(this._muzzleWorld);

    if (validBotHit) {
      this.shotsHit++;
      const botId = validBotHit.object.userData.botId as number;
      const isHead = validBotHit.object.userData.hitbox === 'head';
      const result = this.bots.applyDamage(botId, 34, isHead);

      if (validBotHit.face) {
        this._normalMat.getNormalMatrix(validBotHit.object.matrixWorld);
        this._hitNormal.copy(validBotHit.face.normal).applyMatrix3(this._normalMat).normalize();
      } else {
        this._hitNormal.copy(this._rayDir).negate();
      }

      this.effects.spawnTracer(this._muzzleWorld, validBotHit.point, false);
      this.effects.spawnImpact(validBotHit.point, this._hitNormal, isHead ? 'headshot' : 'bot');

      this.hitSeq++;
      this.hitMarkerTimer = 0.22;

      if (result.killed) {
        this.kills++;
        this.waveKills++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;
        if (isHead) this.headshots++;

        const streakMult = 1 + Math.min(this.streak - 1, 5) * 0.2;
        const earned = Math.round((result.baseScore + (isHead ? 50 : 0)) * streakMult);
        this.score += earned;
        this.hitMarkerType = isHead ? 'headshot' : 'kill';

        this.effects.spawnBotExplosion(result.worldCenter);
        this.audio.playHitMarker(isHead);
        this.audio.playKillConfirm(this.streak);

        // Punchy brief hitstop on headshot eliminations
        if (isHead) {
          this.hitstopTimer = 0.036;
          this.shakeIntensity = Math.min(this.shakeIntensity + 0.025, 0.055);
        }

        // Small armor/ammo resupply reward on kill to reward aggressive flow
        this.reserveAmmo = Math.min(240, this.reserveAmmo + 12);
        this.armor = Math.min(this.maxArmor, this.armor + 6);

        this.killFeed.unshift({
          id: this.nextKillFeedId++,
          botName: result.botName,
          headshot: isHead,
          points: earned,
          timestamp: performance.now(),
        });
        if (this.killFeed.length > 4) this.killFeed.pop();

        // Check wave progression
        const target = getWaveTarget(this.wave);
        if (this.waveKills >= target) {
          this.wave++;
          this.waveKills = 0;
          this.score += 300;
          this.health = Math.min(this.maxHealth, this.health + 25);
          this.armor = Math.min(this.maxArmor, this.armor + 35);
          this.reserveAmmo = Math.min(240, this.reserveAmmo + 45);
          this.audio.playWaveComplete();
          this.bots.activateWaveSlots(this.wave, this.playerPos);
        }
      } else {
        this.hitMarkerType = isHead ? 'headshot' : 'normal';
        this.audio.playHitMarker(isHead);
      }
    } else if (worldHits.length > 0) {
      const hit = worldHits[0];
      if (hit.face) {
        this._normalMat.getNormalMatrix(hit.object.matrixWorld);
        this._hitNormal.copy(hit.face.normal).applyMatrix3(this._normalMat).normalize();
      } else {
        this._hitNormal.copy(this._rayDir).negate();
      }
      this.effects.spawnTracer(this._muzzleWorld, hit.point, false);
      this.effects.spawnImpact(hit.point, this._hitNormal, 'world');
    } else {
      this._tracerEnd.copy(this.camera.position).addScaledVector(this._rayDir, 65);
      this.effects.spawnTracer(this._muzzleWorld, this._tracerEnd, false);
    }

    // Auto-reload when mag hits 0
    if (this.ammo === 0 && this.reserveAmmo > 0) {
      this.triggerReload();
    }

    this.pushHudSnapshot();
  }

  private applyPlayerDamage(damage: number, attackerPos: THREE.Vector3): void {
    if (this.phase !== 'playing') return;

    const armorAbsorb = Math.min(this.armor, Math.ceil(damage * 0.65));
    const hpLoss = damage - armorAbsorb;
    this.armor = Math.max(0, this.armor - armorAbsorb);
    this.health = Math.max(0, this.health - hpLoss);

    this.damageFlash = 1.0;
    this.shakeIntensity = Math.min(this.shakeIntensity + 0.045, 0.09);

    // Compute relative attacker bearing for directional damage arc
    const dx = attackerPos.x - this.playerPos.x;
    const dz = attackerPos.z - this.playerPos.z;
    const worldAngle = Math.atan2(dx, -dz);
    this.damageAngle = worldAngle + this.yaw;

    this.audio.playPlayerHit(armorAbsorb > 0);

    if (this.health <= 0) {
      this.streak = 0;
      this.endMatch('eliminated');
    } else {
      this.pushHudSnapshot();
    }
  }

  private endMatch(reason: EndReason): void {
    this.phase = 'gameover';
    this.endReason = reason;
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    this.pushHudSnapshot();
  }

  // --- Main Simulation Tick ---

  private updateSimulation(dt: number): void {
    // 1. Title screen live arena showcase orbit
    if (this.phase === 'title') {
      this.titleOrbitAngle += dt * 0.14;
      const radius = 19.5;
      const camX = Math.sin(this.titleOrbitAngle) * radius;
      const camZ = Math.cos(this.titleOrbitAngle) * radius;
      this.camera.position.set(camX, 7.6 + Math.sin(this.titleOrbitAngle * 1.8) * 0.8, camZ);
      this.camera.lookAt(0, 1.8, 0);
      this.bots.update(
        dt,
        this.arena.playerSpawn,
        this.camera.position,
        this.arena.shootableMeshes,
        1,
        false,
        () => {},
        () => {},
      );
      this.effects.update(dt);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    // Brief hitstop freeze for crispy headshot impact weight
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Match countdown timer
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.endMatch('time');
      return;
    }

    // 2. Player Movement, Sprint, Jump Buffer & Coyote Time
    const forwardInput =
      (this.keysHeld.has('KeyW') ? 1 : 0) -
      (this.keysHeld.has('KeyS') ? 1 : 0) +
      this.touchInput.moveY;
    const rightInput =
      (this.keysHeld.has('KeyD') ? 1 : 0) -
      (this.keysHeld.has('KeyA') ? 1 : 0) +
      this.touchInput.moveX;

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this._wishDir.set(0, 0, 0);
    this._wishDir.addScaledVector(this._forward, forwardInput);
    this._wishDir.addScaledVector(this._right, rightInput);
    if (this._wishDir.lengthSq() > 1) {
      this._wishDir.normalize();
    }

    const sprinting = this.isSprintingActive();
    const ads = this.isAdsActive();
    const maxSpeed = ads ? ADS_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;

    const accel = this.isGrounded ? 15.5 : 4.2;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, this._wishDir.x * maxSpeed, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, this._wishDir.z * maxSpeed, accel, dt);

    // Coyote time + Jump input buffer
    if (this.isGrounded) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVel.y = JUMP_SPEED;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.audio.playJump();
    }

    // Gravity
    this.playerVel.y -= GRAVITY * dt;

    // Horizontal slide collision
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    const [resolvedX, resolvedZ] = this.resolveHorizontalCollisions(nextX, nextZ, this.playerPos.y);
    this.playerPos.x = resolvedX;
    this.playerPos.z = resolvedZ;

    // Vertical floor / ramp / platform grounding
    const wasGrounded = this.isGrounded;
    const supportY = this.getSupportHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    this.playerPos.y += this.playerVel.y * dt;

    if (this.playerPos.y <= supportY + (wasGrounded && this.playerVel.y <= 0 ? 0.22 : 0)) {
      if (!wasGrounded && this.playerVel.y < -4.2) {
        this.audio.playLand();
      }
      this.playerPos.y = supportY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Footstep cadence
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.isGrounded && horizSpeed > 1.2) {
      this.footstepTimer -= dt * (sprinting ? 1.4 : 1.0);
      if (this.footstepTimer <= 0) {
        this.audio.playFootstep(sprinting);
        this.footstepTimer = 0.42;
      }
    } else {
      this.footstepTimer = 0.1;
    }

    // 3. Reloading & Firing
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    if (this.isReloading) {
      this.reloadTimer += dt;
      const p = this.reloadTimer / RELOAD_DURATION;
      if (p >= 0.56 && this.reloadStageAudio === 0) {
        this.reloadStageAudio = 1;
        this.audio.playReloadMagIn();
      } else if (p >= 0.8 && this.reloadStageAudio === 1) {
        this.reloadStageAudio = 2;
        this.audio.playReloadBolt();
      }
      if (this.reloadTimer >= RELOAD_DURATION) {
        const needed = MAG_SIZE - this.ammo;
        const take = Math.min(needed, this.reserveAmmo);
        this.ammo += take;
        this.reserveAmmo -= take;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.pushHudSnapshot();
      }
    } else if (this.mouseLeftHeld || this.touchInput.firing) {
      this.attemptFire();
    }

    // 4. Camera Pose, Smooth FOV Zoom (ADS / Sprint), Recoil Recovery & Shake
    this.recoilCamPitch = THREE.MathUtils.damp(this.recoilCamPitch, 0, 12, dt);
    this.recoilCamYaw = THREE.MathUtils.damp(this.recoilCamYaw, 0, 12, dt);
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 14, dt);

    const targetFov = ads ? 54 : sprinting && horizSpeed > 3 ? 81 : 74;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 13, dt);
      this.camera.updateProjectionMatrix();
    }

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    this._eyePos.set(
      this.playerPos.x + shakeX,
      this.playerPos.y + PLAYER_EYE_HEIGHT + shakeY,
      this.playerPos.z,
    );
    this.camera.position.copy(this._eyePos);

    this._euler.set(
      THREE.MathUtils.clamp(this.pitch + this.recoilCamPitch, -Math.PI * 0.47, Math.PI * 0.47),
      this.yaw + this.recoilCamYaw,
      0,
      'YXZ',
    );
    this.camera.quaternion.setFromEuler(this._euler);

    // 5. Update First-Person Rifle Model
    this.rifle.update(dt, {
      isAds: ads,
      isSprinting: sprinting,
      isGrounded: this.isGrounded,
      moveSpeedRatio: horizSpeed / WALK_SPEED,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? Math.min(1, this.reloadTimer / RELOAD_DURATION) : 0,
      ammoRatio: this.ammo / MAG_SIZE,
    });

    // 6. Update Tactical Bots & Combat Events
    this.bots.update(
      dt,
      this._eyePos,
      this.camera.position,
      this.arena.shootableMeshes,
      this.wave,
      true,
      () => this.audio.playBotCharge(),
      (ev) => {
        this.audio.playBotShot();
        this.effects.spawnTracer(ev.origin, ev.targetPos, true);
        if (ev.hitPlayer) {
          this.applyPlayerDamage(ev.damage, ev.origin);
        }
      },
    );

    // 7. Update Pooled VFX
    this.effects.update(dt);

    // 8. Decay HUD Feedback States
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) {
        this.hitMarkerType = 'none';
      }
    }
    this.damageFlash = THREE.MathUtils.damp(this.damageFlash, 0, 6.5, dt);

    const targetSpread = ads
      ? 2
      : 6 + (horizSpeed / WALK_SPEED) * 10 + this.recoilCamPitch * 220 + (this.isGrounded ? 0 : 12);
    this.crosshairSpread = THREE.MathUtils.damp(this.crosshairSpread, targetSpread, 16, dt);

    // Expire old kill feed items after 4.5s
    const nowMs = performance.now();
    if (this.killFeed.length > 0 && nowMs - this.killFeed[this.killFeed.length - 1].timestamp > 4500) {
      this.killFeed.pop();
    }

    // Throttled HUD sync (~20Hz) so React never stalls 60fps WebGL rendering
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.05) {
      this.hudSyncTimer = 0;
      this.pushHudSnapshot();
    }
  }

  private pushHudSnapshot(): void {
    const obj = getObjectiveForWave(this.wave);
    this.onHudUpdate({
      phase: this.phase,
      score: this.score,
      kills: this.kills,
      headshots: this.headshots,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      streak: this.streak,
      maxStreak: this.maxStreak,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      armor: Math.ceil(this.armor),
      maxArmor: this.maxArmor,
      ammo: this.ammo,
      magSize: MAG_SIZE,
      reserveAmmo: this.reserveAmmo,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? Math.min(1, this.reloadTimer / RELOAD_DURATION) : 0,
      isAds: this.isAdsActive(),
      isSprinting: this.isSprintingActive(),
      timeLeft: this.timeLeft,
      totalTime: MATCH_DURATION,
      wave: this.wave,
      waveKills: this.waveKills,
      waveTarget: getWaveTarget(this.wave),
      objectiveTitle: obj.title,
      objectiveDesc: obj.desc,
      hitMarkerType: this.hitMarkerType,
      hitSeq: this.hitSeq,
      damageFlash: this.damageFlash,
      damageAngle: this.damageAngle,
      crosshairSpread: this.crosshairSpread,
      killFeed: [...this.killFeed],
      pointerLocked: this.pointerLocked,
      endReason: this.endReason,
      muted: this.audio.isMuted(),
      sensitivity: this.sensitivity,
      touchMode: this.touchMode,
      webglError: this.webglError,
    });
  }

  // --- Software-WebGL Safe Pacing Loop ---

  private afterDraw(cb: () => void): void {
    if (!this.renderer || this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.renderer) {
      this.updateSimulation(dt);
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }

    this.arena?.dispose();
    this.rifle?.dispose();
    this.bots?.dispose();
    this.effects?.dispose();
    this.textures?.dispose();
    this.envRT?.dispose();
    this.audio.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
