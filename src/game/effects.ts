import * as THREE from 'three';

interface Tracer {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  active: boolean;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  active: boolean;
}

/**
 * Zero-GC pooled visual effects: bullet tracers, impact sparks, scorch decals,
 * brass shell casings, and bot shatter bursts.
 */
export class EffectsPool {
  public readonly group = new THREE.Group();

  private readonly tracers: Tracer[] = [];
  private readonly sparks: Spark[] = [];
  private readonly shells: ShellCasing[] = [];
  private readonly decals: THREE.Mesh[] = [];
  private decalCursor = 0;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private readonly _dir = new THREE.Vector3();
  private readonly _mid = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _quat = new THREE.Quaternion();
  private readonly _normalLook = new THREE.Vector3();

  private readonly playerTracerMat: THREE.MeshBasicMaterial;
  private readonly enemyTracerMat: THREE.MeshBasicMaterial;
  private readonly sparkGoldMat: THREE.MeshBasicMaterial;
  private readonly sparkCyanMat: THREE.MeshBasicMaterial;
  private readonly sparkRedMat: THREE.MeshBasicMaterial;

  constructor() {
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    // Tracers pool (24)
    const tracerGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 1, 5));
    this.playerTracerMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe4a0,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.enemyTracerMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff4d4d,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(tracerGeo, this.playerTracerMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.tracers.push({
        mesh,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        life: 0,
        maxLife: 0.08,
        active: false,
      });
    }

    // Sparks / shatter shards pool (90)
    const sparkGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.055, 0.12));
    this.sparkGoldMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffc857 }));
    this.sparkCyanMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    this.sparkRedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));

    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(sparkGeo, this.sparkGoldMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.35,
        gravity: 14,
        active: false,
      });
    }

    // Brass shell casings pool (24)
    const shellGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.036, 6));
    const shellMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd4a437,
        metalness: 0.88,
        roughness: 0.25,
      }),
    );
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.shells.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        active: false,
      });
    }

    // Impact bullet-hole decals pool (32) with polygonOffset to avoid Z-fighting
    const decalGeo = trackGeo(new THREE.CircleGeometry(0.075, 10));
    const decalMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x11151b,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(decalGeo, decalMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.decals.push(mesh);
    }
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, isEnemy = false): void {
    const t = this.tracers.find((item) => !item.active) ?? this.tracers[0];
    t.active = true;
    t.start.copy(start);
    t.end.copy(end);
    t.maxLife = isEnemy ? 0.14 : 0.075;
    t.life = t.maxLife;
    t.mesh.material = isEnemy ? this.enemyTracerMat : this.playerTracerMat;

    this._dir.subVectors(end, start);
    const len = Math.max(0.2, this._dir.length());
    this._mid.addVectors(start, end).multiplyScalar(0.5);

    t.mesh.position.copy(this._mid);
    t.mesh.scale.set(isEnemy ? 2.1 : 1.0, len, isEnemy ? 2.1 : 1.0);
    this._dir.normalize();
    this._quat.setFromUnitVectors(this._up, this._dir);
    t.mesh.quaternion.copy(this._quat);
    t.mesh.visible = true;
  }

  public spawnImpact(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    kind: 'world' | 'bot' | 'headshot',
  ): void {
    // Scorch decal on static arena surfaces
    if (kind === 'world') {
      const decal = this.decals[this.decalCursor];
      this.decalCursor = (this.decalCursor + 1) % this.decals.length;
      decal.position.copy(point).addScaledVector(normal, 0.015);
      this._normalLook.copy(point).add(normal);
      decal.lookAt(this._normalLook);
      decal.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.75 + Math.random() * 0.55;
      decal.scale.set(s, s, 1);
      decal.visible = true;
    }

    const count = kind === 'headshot' ? 12 : kind === 'bot' ? 8 : 6;
    const mat =
      kind === 'headshot'
        ? this.sparkRedMat
        : kind === 'bot'
          ? this.sparkCyanMat
          : this.sparkGoldMat;

    let spawned = 0;
    for (let i = 0; i < this.sparks.length && spawned < count; i++) {
      const sp = this.sparks[i];
      if (sp.active) continue;
      sp.active = true;
      sp.maxLife = 0.18 + Math.random() * 0.22;
      sp.life = sp.maxLife;
      sp.gravity = 15;
      sp.mesh.material = mat;
      sp.mesh.position.copy(point);
      const speed = kind === 'headshot' ? 5.5 + Math.random() * 5 : 3 + Math.random() * 4.5;
      sp.vel.set(
        normal.x * speed * 0.7 + (Math.random() - 0.5) * speed,
        Math.abs(normal.y) * speed * 0.6 + Math.random() * 3.5,
        normal.z * speed * 0.7 + (Math.random() - 0.5) * speed,
      );
      const sc = kind === 'headshot' ? 1.3 : 0.85;
      sp.mesh.scale.set(sc, sc, sc);
      sp.mesh.visible = true;
      spawned++;
    }
  }

  public spawnBotExplosion(center: THREE.Vector3): void {
    let spawned = 0;
    for (let i = 0; i < this.sparks.length && spawned < 22; i++) {
      const sp = this.sparks[i];
      if (sp.active) continue;
      sp.active = true;
      sp.maxLife = 0.35 + Math.random() * 0.35;
      sp.life = sp.maxLife;
      sp.gravity = 12;
      sp.mesh.material = spawned % 3 === 0 ? this.sparkCyanMat : spawned % 2 === 0 ? this.sparkRedMat : this.sparkGoldMat;
      sp.mesh.position.set(
        center.x + (Math.random() - 0.5) * 0.5,
        center.y + (Math.random() - 0.5) * 0.8,
        center.z + (Math.random() - 0.5) * 0.5,
      );
      sp.vel.set(
        (Math.random() - 0.5) * 9.5,
        2.5 + Math.random() * 6.5,
        (Math.random() - 0.5) * 9.5,
      );
      const sc = 1.2 + Math.random() * 1.1;
      sp.mesh.scale.set(sc, sc, sc);
      sp.mesh.visible = true;
      spawned++;
    }
  }

  public spawnShell(origin: THREE.Vector3, rightDir: THREE.Vector3, upDir: THREE.Vector3): void {
    const sh = this.shells.find((s) => !s.active) ?? this.shells[0];
    sh.active = true;
    sh.life = 0.9;
    sh.mesh.position.copy(origin);
    sh.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    sh.vel
      .copy(rightDir)
      .multiplyScalar(2.4 + Math.random() * 1.1)
      .addScaledVector(upDir, 1.3 + Math.random() * 0.8);
    sh.rotVel.set(12 + Math.random() * 10, 14 + Math.random() * 10, 8 + Math.random() * 8);
    sh.mesh.visible = true;
  }

  public update(dt: number): void {
    // Update tracers
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
      } else {
        const ratio = t.life / t.maxLife;
        t.mesh.scale.x = ratio * 1.4;
        t.mesh.scale.z = ratio * 1.4;
      }
    }

    // Update sparks
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.active = false;
        sp.mesh.visible = false;
      } else {
        sp.vel.y -= sp.gravity * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        sp.mesh.rotation.x += dt * 11;
        sp.mesh.rotation.y += dt * 9;
        if (sp.mesh.position.y < 0.04) {
          sp.mesh.position.y = 0.04;
          sp.vel.y *= -0.4;
          sp.vel.x *= 0.7;
          sp.vel.z *= 0.7;
        }
        const s = Math.max(0.05, sp.life / sp.maxLife);
        sp.mesh.scale.setScalar(s);
      }
    }

    // Update brass shells
    for (let i = 0; i < this.shells.length; i++) {
      const sh = this.shells[i];
      if (!sh.active) continue;
      sh.life -= dt;
      if (sh.life <= 0) {
        sh.active = false;
        sh.mesh.visible = false;
      } else {
        sh.vel.y -= 13.5 * dt;
        sh.mesh.position.addScaledVector(sh.vel, dt);
        sh.mesh.rotation.x += sh.rotVel.x * dt;
        sh.mesh.rotation.y += sh.rotVel.y * dt;
        sh.mesh.rotation.z += sh.rotVel.z * dt;
        if (sh.mesh.position.y < 0.02) {
          sh.mesh.position.y = 0.02;
          sh.vel.y *= -0.35;
          sh.vel.x *= 0.65;
          sh.vel.z *= 0.65;
        }
      }
    }
  }

  public reset(): void {
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const sp of this.sparks) {
      sp.active = false;
      sp.mesh.visible = false;
    }
    for (const sh of this.shells) {
      sh.active = false;
      sh.mesh.visible = false;
    }
    for (const d of this.decals) {
      d.visible = false;
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
