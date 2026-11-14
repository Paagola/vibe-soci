// Diorama kit v5.7.0 (c) 2026 Nehal Kanak / Sloemo01, MIT: ver LICENSE en esta carpeta.
// Extracto de templates/poses.js (commit c790df5): STAND, mixPose y walkPose, con `lerp` en línea en vez de
// importarlo de config.js. Los valores y los signos son los del kit.

const lerp = (a, b, k) => a + (b - a) * k;

/**
 * Joint order in every entry is [x, y, z]:
 *   torso head shoulderL/R elbowL/R wristL/R hipL/R kneeL/R ankleL/R
 * Signs: +hip X swings the thigh backward; +knee X bends the heel backward;
 * +shoulder X swings the arm backward; -elbow X folds the forearm toward the face.
 */
export const STAND = {
  torso: [0.03, 0, 0],
  head: [0, 0, 0],
  shoulderL: [0.02, 0, -0.1],
  shoulderR: [0.02, 0, 0.1],
  elbowL: [-0.17, 0, 0],
  elbowR: [-0.17, 0, 0],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  hipL: [0, 0, 0.02],
  hipR: [0, 0, -0.02],
  kneeL: [0.05, 0, 0],
  kneeR: [0.05, 0, 0],
  ankleL: [-0.03, 0, 0],
  ankleR: [-0.03, 0, 0],
};

/** Component-wise blend. Missing joints fall back to zero, which is why every pose names the full set. */
export function mixPose(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[key] ?? [0, 0, 0];
    const bv = b[key] ?? [0, 0, 0];
    out[key] = [lerp(av[0] ?? 0, bv[0] ?? 0, k), lerp(av[1] ?? 0, bv[1] ?? 0, k), lerp(av[2] ?? 0, bv[2] ?? 0, k)];
  }
  return out;
}

/**
 * Walk cycle. Phase is driven by distance travelled, not by time, so the feet
 * never skate: speed = 2 * legLength * sin(amp) * phaseRate / PI.
 */
export function walkPose(phase, opts = {}) {
  const amp = opts.amp ?? 0.32;
  const armAmp = opts.armAmp ?? 0.44;
  const lean = opts.lean ?? 0.05;
  const kneeBase = opts.kneeBase ?? 0.06;
  const swing = Math.sin(phase);
  const cs = Math.cos(phase);
  const kneeL = kneeBase + 0.46 * Math.max(0, -cs) + 0.22 * Math.max(0, swing);
  const kneeR = kneeBase + 0.46 * Math.max(0, cs) + 0.22 * Math.max(0, -swing);
  return {
    torso: [lean, swing * 0.05, 0],
    head: [0, -swing * 0.04, 0],
    shoulderL: [-swing * armAmp, 0, -0.09],
    shoulderR: [swing * armAmp, 0, 0.09],
    elbowL: [-0.16 - Math.max(0, swing) * 0.28, 0, 0],
    elbowR: [-0.16 - Math.max(0, -swing) * 0.28, 0, 0],
    wristL: [0, 0, 0],
    wristR: [0, 0, 0],
    hipL: [swing * amp, 0, 0.03],
    hipR: [-swing * amp, 0, -0.03],
    kneeL: [kneeL, 0, 0],
    kneeR: [kneeR, 0, 0],
    ankleL: [-kneeL * 0.32, 0, 0],
    ankleR: [-kneeR * 0.32, 0, 0],
  };
}
