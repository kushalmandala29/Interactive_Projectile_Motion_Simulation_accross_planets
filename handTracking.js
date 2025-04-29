import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
// import { PlanetEnvironment } from './planetEnvironment.js';
import SolarSystem from './models/solarSystem.js';

export class HandTracker {
  constructor(scene, camera, solarSystem, webcamStream, loadingCallback = null) {
    // Core properties
    this.scene = scene;
    this.camera = camera;
    this.solarSystem = solarSystem;
    this.stream = webcamStream;
    this.loadingCallback = loadingCallback;
    this.currentGesture = 'idle';
    // speed of IP‐zoom (tweak to taste)
this.ipZoomSpeed         = 5;         
// reuse your existing screen‐space dead‑zone
// this.rotationDeadZone   = 0.002;  
// in constructor
this.selectionExitStableFrames   = 0;
this.selectionExitFrameThreshold = 3;      // must hold two‑finger for 3 frames to exit
this.selectionCooldown           = 0;      // timestamp until which we ignore re‑entry
this.selectionCooldownTime       = 1000;   // ms of “locked out” time after exiting

    // Video element setup
    this.video = document.getElementById('webcam') || this.createVideoElement();

    // Hand tracking state
    this.handpose = null;
    this.predictions = [];
    this.isTracking = false;
    this.consecutiveNoDetectionFrames = 0;
    this.consecutiveDetectionFrames = 0;
    // at the bottom of the constructor, right before this.createStatusOverlay():
    this.palmBuffer            = [];
    this.maxPalmBuffer         = 10;
    this.palmMoveThreshold     = 0.005;   // ignore moves smaller than this in world‐space

    this.palmScreenBuffer      = [];
    this.maxPalmScreenBuffer   = 8;
    this.rotationDeadZone      = 0.009;   // ignore tiny screen‐space jitters
    this.rotationSmoothAlpha   = 0.4;    // how stiff the rotation lerp is
    this.mode = 'default'; // or 'selection'


    // Gesture history buffers
    this.lastPositions = [];
    this.lastPalmPositions = [];
    this.maxPalmHistory = 5;

    // Gesture thresholds
    this.gestureThresholds = {
      throw: 1.3,
      pinch: 0.5,
      tap: 0.4,
      grab: 0.5,
      rotation: 0.6
    };
    // track last frame’s mid‑X
    this.prevIndexThumbMidX       = null;
    this.indexThumbSmoothMidX     = null;
    this.indexThumbSpeed          = 100;      // bump this up for faster zoom
    this.indexThumbDeadZone       = 0.001;    // lower = more sensitive
    this.indexThumbSmoothFactor   = 0.1;     // [0..1] smaller = more smoothing
    this.indexThumbStableFrames   = 0;       // frame counter
    this.indexThumbFrameThreshold = 4;    
 
    // Calibration for mapping video coordinates
    this.calibration = {
      offsetX: 0,
      offsetY: 0,
      scaleFactorX: 1,
      scaleFactorY: 1
    };

    this.pinchStartDistance = null;
    this.pinchStartZoom     = null;
    this.isPinching         = false;
    this.zoomClampMin       = 0.5;   // don’t zoom in closer than 0.5×
    this.zoomClampMax       = 3.0;   // don’t zoom out farther than 3×
    this.zoomLerpSpeed      = 0.15;  // how fast camera moves
        // Smoothing
    this.indexFingerHistory = [];
    this.smoothingWindow = 5;
    this.rotationSmoothing = 0.5;
    this.smoothedPalmScreenPos = null;
    this.landmarkWorldHistory = new Array(21).fill(null);
    this.landmarkSmoothing    = 0.3;   
    // Gesture state
    this.gestureState = {
      isPinching: false,
      pinchStartDistance: 0,
      pinchStartZoom: 0,
      lastGrabTime: 0,
      threeFingerEntryProcessed: false,
      threeFingerTapHandled: false
    };

    this.smoothingFactors = {
      position: 0.3,
      zoom: 0.5
    };

    this.frameControl = {
      lastFrameTime: 0,
      frameInterval: 1000 / 30,
      frameSkip: false
    };

    // Debug visualization
    this.debug = {
      enabled: true,
      handMarkers: [],
      gestureIndicator: null,
      lastDetectedGesture: null,
      gestureOverlay: null,
      indexLabel: null
    };

    this.createStatusOverlay();
    this.createModeOverlay();
  }

  // ---------------------------
  // Public API Methods
  // ---------------------------
  async start() {
    try {
      this.reportProgress(10, "Loading HandPose model");

      if (!window.handpose) {
        throw new Error('Handpose model not loaded.');
      }
      this.handpose = await window.handpose.load({
        maxContinuousChecks: 9,
        detectionConfidence: 0.75,
        iouThreshold: 0.5,
        scoreThreshold: 0.7
      });

      this.reportProgress(30, "Initializing video stream");
      if (!this.stream) throw new Error('Webcam stream not provided');
      this.video.srcObject = this.stream;
      await this.setupVideoPlayback();

      this.reportProgress(70, "Starting tracking");
      this.isTracking = true;
      if (this.debug.enabled) this.createDebugVisuals();
      this.track();
      this.reportProgress(100, "Hand tracking ready");
    } catch (err) {
      console.error('HandTracker initialization failed:', err);
      this.reportProgress(0, `Error: ${err.message}`);
      throw err;
    }
  }

  stop() {
    this.isTracking = false;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
    this.lastPositions = [];
    this.lastPalmPositions = [];
    this.cleanupDebugVisuals();
    if (this.debug.gestureOverlay?.parentNode) {
      this.debug.gestureOverlay.parentNode.removeChild(this.debug.gestureOverlay);
    }
  }

  toggleTracking(enabled) {
    this.isTracking = enabled;
    if (enabled) {
      this.track();
      console.log('Hand tracking enabled');
    } else {
      console.log('Hand tracking paused');
      this.hideDebugVisuals();
    }
  }

  setThrowCallback(cb) { this.throwCallback = cb; }
  setPickupCallback(cb) { this.pickupCallback = cb; }

  handlePickup() {
    const env = this.solarSystem?.planetEnvironment;
    if (this.pickupCallback) this.pickupCallback();
    else if (env?.pickupBall) env.pickupBall();
  }
  hasThumbIndexOnly(L) {
    const t = this.isFingerExtended(L,1,4);
    const i = this.isFingerExtended(L,5,8);
    const m = !this.isFingerExtended(L,9,12);
    const r = !this.isFingerExtended(L,13,16);
    const p = !this.isFingerExtended(L,17,20);
    return t && i && m && r && p;
  }
  
  // ---------------------------
  // Main Tracking Loop
  // ---------------------------
  async track() {
    if (!this.isTracking) return;
    const now = performance.now();
    const elapsed = now - this.frameControl.lastFrameTime;
    if (elapsed < this.frameControl.frameInterval && this.frameControl.frameSkip) {
      return requestAnimationFrame(() => this.track());
    }
    this.frameControl.lastFrameTime = now;
    this.frameControl.frameSkip = !this.frameControl.frameSkip;
  
    try {
      this.predictions = await this.handpose.estimateHands(this.video);
  
      // --- Debounce Logic Start ---
      if (this.predictions.length) {
        // Hand detected – update counters
        this.consecutiveDetectionFrames++;
        this.consecutiveNoDetectionFrames = 0;
  
        // Only process if detection has been stable over 5 consecutive frames (increased from 3)
        if (this.consecutiveDetectionFrames < 10) {


          requestAnimationFrame(() => this.track());
          return;
        }
  
        // Process landmarks only if they pass validation
        const landmarks = this.predictions[0].landmarks;
        if (!this.validateLandmarks(landmarks)) {
          // Invalid landmarks—treat as false positive and reset state.
          this.resetGestureStates();
          this.updateGestureOverlay(null);
          this.hideDebugVisuals();
          requestAnimationFrame(() => this.track());
          return;
        }
        
        // If valid, update the rest of the gesture processing logic
        this.updatePositionHistory(landmarks);
        const gesture = this.detectAndHandleGestures(landmarks, now);
        this.updateGestureOverlay(gesture);
        if (this.debug.enabled) {
          this.updateDebugVisuals(landmarks, gesture);
        }
      } else {
        // No hand detected – update no-detection counter
        this.consecutiveNoDetectionFrames++;
        if (this.consecutiveNoDetectionFrames > 3) {
          // Reset gesture states if no hand is detected for several consecutive frames
          this.resetGestureStates();
          this.updateGestureOverlay(null);
          this.hideDebugVisuals();
        }
      }
      // --- Debounce Logic End ---
    } catch (err) {
      console.error('Tracking error:', err);
      this.handleTrackingError();
    }
    requestAnimationFrame(() => this.track());
  }
  
  

  // ---------------------------
  // Gesture Detection Pipeline
  // ---------------------------
// 1) Helpers with debug
// inside HandTracker class

/**
 * Returns true if the given fingertip is extended.
 * We compare tip‑to‑palm distance against palm‑to‑middle distance * 1.3
 */

// inside HandTracker class

// Returns true if tip is definitely extended
// inside HandTracker class

/**
 * Returns true if the given fingertip is extended.
 * We compare tip‑to‑palm distance against palm‑to‑middle distance * 1.3
 */
isFingerReallyExtended(L, tipIdx) {
  const palm    = L[0];
  const tip     = L[tipIdx];
  const palmRef = this.distance3D(palm, L[9]);       // reference “radius”
  const dist    = this.distance3D(tip, palm);
  const threshold = palmRef * 1.1;
  const extended = dist > threshold;
  console.log(
    `Finger ${tipIdx} extended? ${extended} (dist:${dist.toFixed(1)}, thresh:${threshold.toFixed(1)})`
  );
  return extended;
}
resetPinch() {
  this.gestureState.isPinching = false;
  this.pinchHistory.length     = 0;
  this.pinchStableCount        = 0;
}
isFingerRingReallyExtended(L, tipIdx) {
  const palm    = L[0];
  const tip     = L[tipIdx];
  const palmRef = this.distance3D(palm, L[9]);       // reference “radius”
  const dist    = this.distance3D(tip, palm);
  const threshold = palmRef * 2.2;
  const extended = dist > threshold;
  console.log(
    `Finger ${tipIdx} extended? ${extended} (dist:${dist.toFixed(1)}, thresh:${threshold.toFixed(1)})`
  );
  return extended;
}

/**
 * Returns true if the given fingertip is folded.
 * Uses the same threshold—folded if tip‑to‑palm distance is below 1.3× reference.
 */
isFingerReallyFolded(L, tipIdx) {
  const palm    = L[0];
  const tip     = L[tipIdx];
  const palmRef = this.distance3D(palm, L[9]);
  const dist    = this.distance3D(tip, palm);
  const threshold = palmRef * 1.3
  ;
  const folded = dist < threshold;
  console.log(
    `Finger ${tipIdx} folded?  ${folded} (dist:${dist.toFixed(1)}, thresh:${threshold.toFixed(1)})`
  );
  return folded;
}

isFingerFolded(L, tipIdx) {
  // folded if tip‑to‑palm distance < 1.0× reference
  const palm    = L[0];
  const tip     = L[tipIdx];
  const refDist = this.distance3D(palm, L[9]);
  return this.distance3D(palm, tip) < refDist * 1.0;
}

/**
 * true if only index (5→8) and pinky (17→20) are extended
 * and thumb/middle/ring are folded
 */
/**
 * Returns true if only index (5→8) and thumb (1→4) are extended,
 * and middle/ring/pinky are folded.
 */
/**
 * Returns true if only the index finger and thumb are extended,
 * all other fingers are folded. Uses 3D distances from the palm for robustness.
 */
/**
 * Returns true if only index + thumb are (loosely) extended,
 * and middle/ring/pinky are folded.
 */
isIndexThumbOnly(L) {
  const palm = L[0];
  // slack < 1 → allows a little bend before we call “extended”
  const slack = 0.8;

  // 1) Index “extended” if tip–palm > base–palm * slack
  const idxTipDist  = this.distance3D(L[8],  palm);
  const idxBaseDist = this.distance3D(L[5],  palm);
  const idxE = idxTipDist > idxBaseDist * slack;

  // 2) Thumb “extended” if tip–palm > base–palm * slack
  const thTipDist   = this.distance3D(L[4],  palm);
  const thBaseDist  = this.distance3D(L[2],  palm);
  const thumbE = thTipDist > thBaseDist * slack;

  // for the other fingers, we want them folded; allow a bit of wiggle
  const foldSlack = 1;
  const midF   = this.distance3D(L[12], palm) < this.distance3D(L[10], palm) * foldSlack;
  const ringF  = this.distance3D(L[16], palm) < this.distance3D(L[14], palm) * foldSlack;
  const pinkF  = this.distance3D(L[20], palm) < this.distance3D(L[18], palm) * foldSlack;

  console.log(`IndexThumbOnly? idxE=${idxE}, thumbE=${thumbE}, midF=${midF}, ringF=${ringF}, pinkyF=${pinkF}`);
  return idxE && thumbE && midF && ringF && pinkF;
}





// Three‑finger entry: index, middle, ring extended; thumb & pinky folded
isThreeFingersExtended(L) {
  const idxE   = this.isFingerReallyExtended(L, 8);
  const midE   = this.isFingerReallyExtended(L, 12);
  const ringE  = this.isFingerRingReallyExtended(L, 16);
  const thumbF = this.isFingerReallyFolded(L, 4);
  const pinkyF = this.isFingerReallyFolded(L, 20);

  console.log(`3F → idx:${idxE}, mid:${midE}, ring:${ringE}, thumbFolded:${thumbF}, pinkyFolded:${pinkyF}`);
  return idxE && midE && ringE && thumbF && pinkyF;
}

// Rotation only when all five fingers truly extended
/**
 * Move camera forward/back based on index+pinky drag
 */
/**
 * Move camera forward/back based on index+thumb drag
 */
handleIndexThumbDragZoom(L) {
  // 1) gesture test
  if (!this.isIndexThumbOnly(L)) {
    // reset everything once finger combo breaks
    this.indexThumbStableFrames = 0;
    this.indexThumbSmoothMidX   = null;
    this.prevIndexThumbMidX     = null;
    return false;
  }

  // 2) require N stable frames before zooming
  this.indexThumbStableFrames = Math.min(this.indexThumbStableFrames + 1, this.indexThumbFrameThreshold);
  if (this.indexThumbStableFrames < this.indexThumbFrameThreshold) {
    return false;
  }

  // 3) raw midpoint NDC X
  const midRaw = (L[1][0] + L[8][0]) / 2;
  const midNdc = (midRaw / this.video.videoWidth) * 2 - 1;

  // 4) initialize smoothing
  if (this.indexThumbSmoothMidX === null) {
    this.indexThumbSmoothMidX = midNdc;
    this.prevIndexThumbMidX   = midNdc;
    return false;
  }

  // 5) exponential smoothing
  this.indexThumbSmoothMidX = THREE.MathUtils.lerp(
    this.indexThumbSmoothMidX,
    midNdc,
    this.indexThumbSmoothFactor
  );

  // 6) compute delta
  const dx = this.indexThumbSmoothMidX - this.prevIndexThumbMidX;

  // 7) apply zoom if beyond dead‑zone
  if (Math.abs(dx) > this.indexThumbDeadZone) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    this.camera.position.addScaledVector(forward, dx * this.indexThumbSpeed);
    const tgt = this.solarSystem.controls.target;
    this.camera.lookAt(tgt);
    this.solarSystem.controls.update?.();
  }

  // 8) stash for next frame
  this.prevIndexThumbMidX = this.indexThumbSmoothMidX;
  return true;
}




// Rotation only when all five fingers truly extended
areAllFingersOpen(L) {
  const t = this.isFingerReallyExtended(L, 4);   // thumb
  const i = this.isFingerReallyExtended(L, 8);   // index
  const m = this.isFingerReallyExtended(L, 12);  // middle
  const r = this.isFingerReallyExtended(L, 16);  // ring
  const p = this.isFingerReallyExtended(L, 20);  // pinky

  console.log(`5F → thumb:${t}, index:${i}, middle:${m}, ring:${r}, pinky:${p}`);
  return t && i && m && r && p;
}

// helper method
/**
 * Returns true if index, middle, ring & pinky are extended,
 * and thumb is folded.
 * Uses a dynamic threshold based on palm‑to‑middle distance.
 */
/**
 * Returns true if index, middle, ring & pinky are (mostly) extended
 * and thumb is (mostly) folded.  Allows slight bend.
 */
/**
 * Returns true if 3 out of 4 “long” fingers are extended
 * and thumb is folded.  Also logs the raw distances.
 * 
 * 
 */

/**
 * Keep the last `boolHistoryWindow` values in `hist`,
 * push the current `val`, and return true if at least
 * half of them are true.
 */

/**
 * Returns a new landmark array that is the frame‐by‐frame
 * average of the last `landmarkWindow` frames.
 */
getSmoothedLandmarks(L) {
  // push a deep copy
  this.landmarkHistory.push(L.map(pt => [...pt]));
  if (this.landmarkHistory.length > this.landmarkWindow) {
    this.landmarkHistory.shift();
  }
  // average each of the 21 points
  return this.landmarkHistory[0].map((_, idx) => {
    const sum = [0,0,0];
    for (let frame of this.landmarkHistory) {
      sum[0] += frame[idx][0];
      sum[1] += frame[idx][1];
      sum[2] += frame[idx][2];
    }
    const n = this.landmarkHistory.length;
    return [ sum[0]/n, sum[1]/n, sum[2]/n ];
  });
}

smoothBool(hist, val) {
  hist.push(val);
  if (hist.length > this.boolHistoryWindow) hist.shift();
  const trues = hist.filter(x => x).length;
  return trues >= Math.ceil(this.boolHistoryWindow/2);
}

isFourFingersExtended(L) {
  const palm    = L[0];
  const palmRef = this.distance3D(palm, L[9]);    // reference “radius”

  // looser thresholds
  const extSlack  = 1.15;  // just needs to exceed the radius
  const foldSlack = 0.85;  // thumb can be up to 1.5× and still count as folded

  const idxDist  = this.distance3D(L[8],  palm);
  const midDist  = this.distance3D(L[12], palm);
  const ringDist = this.distance3D(L[16], palm);
  const pinkDist = this.distance3D(L[20], palm);
  const thumbDist= this.distance3D(L[4],  palm);

  const idxE   = idxDist  > palmRef * extSlack;
  const midE   = midDist  > palmRef * extSlack;
  const ringE  = ringDist > palmRef * extSlack;
  const pinkE  = pinkDist > palmRef * extSlack;
  const thumbF = thumbDist < palmRef * foldSlack;

  console.log(
    `4F test → idx:${idxDist.toFixed(1)}(${idxE}), ` +
    `mid:${midDist.toFixed(1)}(${midE}), ` +
    `ring:${ringDist.toFixed(1)}(${ringE}), ` +
    `pink:${pinkDist.toFixed(1)}(${pinkE}), ` +
    `thumb:${thumbDist.toFixed(1)} folded?${thumbF}`
  );

  // require at least 3 of the 4 true
  const extendedCount = [idxE, midE, ringE, pinkE].filter(b => b).length;
  return extendedCount >= 3 && thumbF;
}























  // ---------------------------
  // Gesture Helpers
  // ---------------------------

  distance3D(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  isTwoFingersExtended(L) {
    return this.isFingerExtended(L,5,8) && this.isFingerExtended(L,9,12)
        && !this.isFingerExtended(L,13,16) && !this.isFingerExtended(L,17,20);
  }
  // inside HandTracker class
isFingerExtended(L, baseIdx, tipIdx) {
  // THUMB
  if (tipIdx === 4) {
    const palm = L[0], tip = L[4], base = L[1];
    return this.distance3D(tip, palm) > this.distance3D(base, palm) * 1.3;
  }
  // OTHER FINGERS: require tip Y to be significantly above mid‑joint Y
  const tip = L[tipIdx], mid = L[tipIdx - 2];
  const dy = mid[1] - tip[1];
  const minDy = (L[baseIdx][1] - mid[1]) * 0.3;  // 20% of the finger length
  return dy > minDy;
}




  areMidRingPinkyExtended(L) {
    return this.isFingerExtended(L,9,12) || this.isFingerExtended(L,13,16)
        || (this.isFingerExtended(L,17,20) && !this.isFingerExtended(L,1,4) && !this.isFingerExtended(L,5,8));
  }

  
  

  areFiveFingersExtended(L) {
    return this.areAllFingersOpen(L);
  }


  // inside HandTracker class

// inside HandTracker class
// inside HandTracker class
detectGrab(L, ts) {
    if (!this.isTwoFingersExtended(L)) {
      this.gestureState.isGrabbing = false;
      return false;
    }
    if (ts - this.gestureState.lastGrabTime > 500) {
      this.gestureState.lastGrabTime = ts;
      this.handlePickup();
      return true;
    }
    return false;
  }


handleRotation(L) {
  const vw = this.video.videoWidth || this.video.width;
  const vh = this.video.videoHeight || this.video.height;

  // 1) Compute raw palm center in NDC
  const palmIdxs = [0, 1, 5, 9, 13];
  let sumX = 0, sumY = 0;
  for (const i of palmIdxs) {
    sumX += L[i][0];
    sumY += L[i][1];
  }
  const rawNdc = new THREE.Vector2(
    (sumX/palmIdxs.length / vw)*2 - 1,
    -((sumY/palmIdxs.length / vh)*2 - 1)
  );

  // 2) Screen‑space moving‑average buffer
  this.palmScreenBuffer.unshift(rawNdc.clone());
  if (this.palmScreenBuffer.length > this.maxPalmScreenBuffer) {
    this.palmScreenBuffer.pop();
  }
  const avgScreen = this.palmScreenBuffer
    .reduce((acc, v) => acc.add(v), new THREE.Vector2())
    .divideScalar(this.palmScreenBuffer.length);

  // 3) First‑frame init
  if (!this.debug.lastPalmScreen) {
    this.debug.lastPalmScreen     = avgScreen.clone();
    this.debug.smoothedPalmScreen = avgScreen.clone();
    this.debug.palmDelta          = new THREE.Vector2();
    return;
  }

  // 4) Dead‑zone check: if below threshold, freeze rotation
  const deltaTest = avgScreen.clone().sub(this.debug.lastPalmScreen);
  if (deltaTest.length() < this.rotationDeadZone) {
    // palm is steady → zero out any accumulated delta
    this.debug.palmDelta.set(0, 0);
    // resync both buffers so no “catch‑up” drift
    this.debug.lastPalmScreen.copy(avgScreen);
    this.debug.smoothedPalmScreen.copy(avgScreen);
    return;
  }

  // 5) Smooth the screen‑space palm position
  this.debug.smoothedPalmScreen.lerp(avgScreen, this.rotationSmoothAlpha);

  // 6) Compute raw delta and boost horizontal sensitivity
  const rawDelta = this.debug.smoothedPalmScreen
    .clone()
    .sub(this.debug.lastPalmScreen);
  rawDelta.x *= 1.6;

  // 7) Smooth that delta
  this.debug.palmDelta.lerp(rawDelta, this.rotationSmoothAlpha);

  // 8) Map to yaw/pitch
  const speed = 3;
  const yaw   = - this.debug.palmDelta.x * speed;
  const pitch = this.debug.palmDelta.y * speed;

  // 9) Apply to your controls
  const ctl = this.solarSystem.controls;
  if (ctl.rotateLeft) {
    ctl.rotateLeft(yaw);
    ctl.rotateUp(pitch);
    ctl.update?.();
  } else {
    // spherical fallback
    const tgt    = ctl.target || new THREE.Vector3();
    const offset = new THREE.Vector3().subVectors(this.camera.position, tgt);
    const sph    = new THREE.Spherical().setFromVector3(offset);
    sph.theta += yaw;
    sph.phi   += pitch;
    sph.phi   = THREE.MathUtils.clamp(sph.phi, 0.01, Math.PI - 0.01);
    offset.setFromSpherical(sph);
    this.camera.position.copy(tgt).add(offset);
    this.camera.lookAt(tgt);
  }

  // 10) Stash for next frame
  this.debug.lastPalmScreen.copy(this.debug.smoothedPalmScreen);
}

createModeOverlay() {
  if (this.debug.modeOverlay) return;
  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 12px',
    borderRadius: '5px',
    color: 'white',
    background: 'green',
    zIndex: '1000',
    fontSize: '14px',
    textAlign: 'center',
  });
  div.textContent = `Mode: ${this.mode}`;
  document.body.appendChild(div);
  this.debug.modeOverlay = div;
}

updateModeOverlay() {
  if (!this.debug.modeOverlay) return;
  this.debug.modeOverlay.textContent = `Mode: ${this.mode}`;
}
/**
 * Main gesture dispatch with proper exit and cooldown for selection mode.
 * @param {Array} L - 21 landmark [x,y,z] positions.
 * @param {number} ts - Current timestamp (performance.now()).
 * @returns {string} - Detected gesture.
 */
detectAndHandleGestures(L, ts) {
  const env = this.solarSystem?.planetEnvironment;

  // —————————————— Default Mode: Entry Logic ——————————————
 this.fourFingerStableFrames   = 0;
this.fourFingerFrameThreshold = 1;  // just 1 frame for now

// in detectAndHandleGestures:
if (this.mode === 'default' && !env?.ischaracter) {
  if (this.isFourFingersExtended(L)) {
    this.fourFingerStableFrames++;
    if (this.fourFingerStableFrames >= this.fourFingerFrameThreshold) {
      this.mode = 'selection';
      this.updateModeOverlay()
      this.fourFingerStableFrames = 0;
      return 'SelectionModeOn';
    }
  } else {
    this.fourFingerStableFrames = 0;
  }
}

  // —————————————— Selection Mode ——————————————
  if (this.mode === 'selection' && !env?.ischaracter) {
    // 1) Two fingers → exit selection (requires stable frames)
    if (this.isTwoFingersExtended(L)) {
      this.selectionExitStableFrames++;
      if (this.selectionExitStableFrames >= this.selectionExitFrameThreshold) {
        this.mode = 'default';
        this.updateModeOverlay();
        this.selectionExitStableFrames = 0;
        // start cooldown so you don’t immediately re‑enter
        this.selectionCooldown = ts + this.selectionCooldownTime;
        return 'SelectionModeOff';
      }
    } else {
      this.selectionExitStableFrames = 0;
    }

    // 2) Open palm → smooth highlight
    if (this.areAllFingersOpen(L)) {
      this.attemptPlanetSelectionOrderedTwoFingers(L);
      return 'Highlight';
    }

    // 3) Three fingers → enter planet, then exit
    if (!env?.character && this.isThreeFingersExtended(L)) {
      this.solarSystem.enterPlanet(this.solarSystem.currentlyHighlightedOrderedPlanet);
      this.mode = 'default';
      this.selectionCooldown = ts + this.selectionCooldownTime;
      return 'EnterPlanet';
    }

    // nothing else in selection
    return 'SelectionIdle';
  }

  // —————————————— Default Mode: Other Gestures ——————————————
  if (this.handleIndexThumbDragZoom(L)) {
    return 'IndexThumbZoom';
  }
  if (env?.character && !env.isHoldingBall && !env.ballThrown && this.detectGrab(L, ts)) {
    return 'Grab';
  }
  if (env?.character && env.isHoldingBall && this.areFiveFingersExtended(L)) {
    const vel = this.computeThrowVelocity();
    if (vel.length() > this.gestureThresholds.throw) {
      (this.throwCallback ?? env.throwBall)(vel);
      return 'Throw';
    }
  }
  if (this.areAllFingersOpen(L)) {
    this.handleRotation(L);
    return 'Rotate';
  }

  return 'idle';
}




  computeThrowVelocity() {
    if (this.lastPalmPositions.length < 2) return new THREE.Vector3();
    const vel = new THREE.Vector3();
    for (let i = 0; i < this.lastPalmPositions.length - 1; i++) {
      vel.add(
        new THREE.Vector3().subVectors(
          this.lastPalmPositions[i],
          this.lastPalmPositions[i + 1]
        )
      );
    }
    vel.divideScalar(this.lastPalmPositions.length - 1).multiplyScalar(10);
    vel.z = -vel.z;
    return vel;
  }

  // ---------------------------
  // History & Smoothing
  // ---------------------------
  updatePositionHistory(L) {
    this.lastPositions.unshift(L.map(p => [...p]));
    if (this.lastPositions.length > 5) this.lastPositions.pop();
    const palm3D = this.getSmoothedPalmPosition(L);
    this.lastPalmPositions.unshift(palm3D);
    if (this.lastPalmPositions.length > this.maxPalmHistory) {
      this.lastPalmPositions.pop();
    }
  }
  validateLandmarks(L) {
    // Check that the landmarks array exists and has 21 elements.
    if (!L || L.length !== 21) {
      console.warn("validateLandmarks: Invalid or incomplete landmarks array.");
      return false;
    }
  
    // Compute the distance from the palm (landmark 0) to the index fingertip (landmark 8).
    const palmToIndex = this.distance3D(L[0], L[8]);
    // Set an expected minimum distance (in pixels or an appropriate unit based on your calibration).
    const minExpectedDistance = 60; // Adjust this threshold according to your environment
    if (palmToIndex < minExpectedDistance) {
      console.warn("validateLandmarks: Detected landmarks are too close; likely a false positive.");
      return false;
    }
  
    // (Optional) Check the overall bounding box of the detected hand.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of L) {
      if (point[0] < minX) minX = point[0];
      if (point[1] < minY) minY = point[1];
      if (point[0] > maxX) maxX = point[0];
      if (point[1] > maxY) maxY = point[1];
    }
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    // Validate that the bounding box is not too small.
    const minBBoxSize =  0; // Adjust threshold based on expected hand size in the video feed
    if (bboxWidth < minBBoxSize || bboxHeight < minBBoxSize) {
      console.warn("validateLandmarks: Bounding box dimensions are too small.");
      return false;
    }
  
    // All checks passed; the landmarks appear valid.
    return true;
  }
  

  getSmoothedPalmPosition(L) {
    const p = L[0];
    // unproject into world‐space
    const ndc = new THREE.Vector3(
      (p[0]/this.video.width)*2 - 1,
      -(p[1]/this.video.height)*2 + 1,
      0.5
    );
    const worldPos = ndc.unproject(this.camera);
  
    // 1) tiny‐move dead‑zone
    if (this.lastSmoothedPosition &&
        worldPos.distanceTo(this.lastSmoothedPosition) < this.palmMoveThreshold) {
      return this.lastSmoothedPosition.clone();
    }
  
    // 2) moving‐average buffer
    this.palmBuffer.unshift(worldPos.clone());
    if (this.palmBuffer.length > this.maxPalmBuffer) this.palmBuffer.pop();
    const avg = this.palmBuffer
      .reduce((sum, v) => sum.add(v), new THREE.Vector3())
      .divideScalar(this.palmBuffer.length);
  
    this.lastSmoothedPosition = avg.clone();
    return avg;
  }
  
  

  resetGestureStates() {
    this.gestureState.isPinching = false;
    this.gestureState.isGrabbing = false;
    this.lastPalmPositions = [];
    this.smoothedPalmScreenPos = null;
    this.lastPalmScreenPos = null;
  }

  // ---------------------------
  // Planet Selection (two‑finger horizontal)
  // ---------------------------
  attemptPlanetSelectionOrderedTwoFingers(L) {
    if (!this.solarSystem) return false;
  
    // 1) Use palm landmark (index 0)
    const palmX = L[0][0];
  
    // 2) Normalize across calibrated video width
    let normX = (palmX - this.calibration.offsetX)
              / (this.video.videoWidth * this.calibration.scaleFactorX);
  
    // 3) Apply “active zone” so edges aren’t overly sensitive
    const activeZone = 0.6;                 
    const margin    = (1 - activeZone) / 2; 
    normX = (normX - margin) / activeZone;
    normX = THREE.MathUtils.clamp(normX, 0, 1);
  
    // 4) Choose planet by ordering
    const order = this.solarSystem.planetOrder;
    let idx = Math.floor(normX * order.length + 0.5);
    idx = THREE.MathUtils.clamp(idx, 0, order.length - 1);
  
    // 5) Highlight that planet
    const name = order[idx];
    if (this.solarSystem.planets.has(name)) {
      const mesh = this.solarSystem.planets.get(name).mesh;
      this.solarSystem.highlightPlanet(mesh);
      this.solarSystem.currentlyHighlightedOrderedPlanet = mesh;
      return true;
    }
  
    return false;
  }

  // ---------------------------
  // Video & DOM Helpers
  // ---------------------------
  createVideoElement() {
    const v = document.createElement('video');
    v.id = 'webcam';
    v.autoplay = v.playsInline = true;
    v.style.display = 'none';
    document.body.appendChild(v);
    return v;
  }

  setupVideoPlayback() {
    return new Promise(resolve => {
      this.video.onloadedmetadata = () => this.video.play().then(resolve);
    });
  }

  handleTrackingError() {
    this.isTracking = false;
    setTimeout(() => {
      if (!this.isTracking) {
        console.log('Restarting hand tracking...');
        this.isTracking = true;
        this.track();
      }
    }, 2000);
  }

  reportProgress(p, msg) {
    console.log(`Hand Tracking: ${msg} (${p}%)`);
    this.loadingCallback?.(p, msg);
  }

  // ---------------------------
  // Debug Visualization
  // ---------------------------
  createStatusOverlay() {
    if (this.debug.gestureOverlay) return;
    const div = document.createElement('div');
    Object.assign(div.style, {
      position: 'fixed',
      bottom: '140px',
      right: '180px',
      padding: '5px 10px',
      borderRadius: '5px',
      color: 'white',
      background: 'rgba(0,0,0,0.7)',
      zIndex: '1000',
      fontSize: '12px'
    });
    div.textContent = 'No gesture detected';
    document.body.appendChild(div);
    this.debug.gestureOverlay = div;
  }

  updateGestureOverlay(gesture) {
    const o = this.debug.gestureOverlay;
    if (!o) return;
    if (gesture && gesture !== this.debug.lastDetectedGesture) {
      o.textContent = `Gesture: ${gesture}`;
      o.style.background = 'rgba(0,128,0,0.7)';
      setTimeout(() => { o.style.background = 'rgba(0,0,0,0.7)'; }, 1000);
    } else if (!gesture) {
      o.textContent = 'No gesture detected';
    }
    this.debug.lastDetectedGesture = gesture;
  }

  createDebugVisuals() {


    for (let i = 0; i < 21; i++) {
      const geo = new THREE.SphereGeometry(0.02, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: this.getLandmarkColor(i) });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.scene.add(m);
      this.debug.handMarkers.push(m);
    }
    const ig = new THREE.SphereGeometry(0.04, 16, 16);
    const im = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const indicator = new THREE.Mesh(ig, im);
    indicator.visible = false;
    this.scene.add(indicator);
    this.debug.gestureIndicator = indicator;
  }

  getLandmarkColor(i) {
    switch (i) {
      case 0: return 0xff0000;
      case 4: return 0x00ff00;
      case 8: return 0x0000ff;
      default: return 0xffff00;
    }
  }

  getGestureColor(g) {
    switch (g) {
      case 'Pinch/Zoom': return 0x00ff00;
      case 'Tap': return 0x0000ff;
      case 'Grab': return 0xff00ff;
      case 'Throw': return 0xff0000;
      default: return 0xffff00;
    }
  }

  updateDebugVisuals(L, gesture) {
    // markers
    L.forEach((lm, i) => {
      const rawPos = this.landmarkToScreenPosition(lm);

      if (!this.landmarkWorldHistory[i]) {
        // first frame: seed it
        this.landmarkWorldHistory[i] = rawPos.clone();
      } else {
        // exponential smoothing
        this.landmarkWorldHistory[i].lerp(rawPos, this.landmarkSmoothing);
      }

      // now place the debug sphere there
      const marker = this.debug.handMarkers[i];
      marker.position.copy(this.landmarkWorldHistory[i]);
      marker.visible = true;
      marker.material.color.set(this.getLandmarkColor(i));
    });

    // 2) Gesture indicator (optional smoothing)
    if (gesture && this.debug.gestureIndicator) {
      const rawPalm = this.landmarkToScreenPosition(L[0]);
      if (!this.debug.palmHistory) this.debug.palmHistory = rawPalm.clone();
      else this.debug.palmHistory.lerp(rawPalm, this.landmarkSmoothing);

      this.debug.gestureIndicator.position.copy(this.debug.palmHistory);
      this.debug.gestureIndicator.visible = true;
      this.debug.gestureIndicator.material.color.set(this.getGestureColor(gesture));
      const s = 1 + 0.2 * Math.sin(performance.now()/200);
      this.debug.gestureIndicator.scale.set(s,s,s);
    }
    // index label
    if (L[8]) {
      if (!this.debug.indexLabel) {
        const lbl = document.createElement('div');
        lbl.style.position = 'absolute';
        lbl.style.color = 'white';
        lbl.style.fontSize = '12px';
        document.body.appendChild(lbl);
        this.debug.indexLabel = lbl;
      }
      const sm = this.getSmoothedIndexFinger(L[8]);
      let nx = (sm[0] - this.calibration.offsetX) /
               (this.video.videoWidth * this.calibration.scaleFactorX);
      nx = THREE.MathUtils.clamp(nx, 0, 1);
      const idx = this.solarSystem.planetOrder.length
                ? Math.floor(nx * this.solarSystem.planetOrder.length)
                : -1;
      this.debug.indexLabel.innerText = `NormX: ${nx.toFixed(2)}\nPlanetIdx: ${idx}`;
      const screen = this.landmarkToScreenPosition(L[8]);
      this.debug.indexLabel.style.left = `${(screen.x * window.innerWidth/2 + window.innerWidth/2)}px`;
      this.debug.indexLabel.style.top  = `${(-screen.y * window.innerHeight/2 + window.innerHeight/2 - 20)}px`;
    }
  }

  hideDebugVisuals() {
    this.debug.handMarkers.forEach(m => m.visible = false);
    if (this.debug.gestureIndicator) this.debug.gestureIndicator.visible = false;
  }

  cleanupDebugVisuals() {
    this.debug.handMarkers.forEach(m => this.scene.remove(m));
    this.debug.handMarkers = [];
    if (this.debug.gestureIndicator) {
      this.scene.remove(this.debug.gestureIndicator);
      this.debug.gestureIndicator = null;
    }
    if (this.debug.indexLabel) {
      document.body.removeChild(this.debug.indexLabel);
      this.debug.indexLabel = null;
    }
  }

  landmarkToScreenPosition(lm) {
    const xNorm = (lm[0] / this.video.width) * 2 - 1;
    const yNorm = -(lm[1] / this.video.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(xNorm, yNorm), this.camera);
    return this.camera.position.clone().add(rc.ray.direction.clone().multiplyScalar(5));
  }

  getSmoothedIndexFinger(raw) {
    this.indexFingerHistory.push(raw);
    if (this.indexFingerHistory.length > this.smoothingWindow) {
      this.indexFingerHistory.shift();
    }
    const sum = this.indexFingerHistory.reduce(
      (acc, v) => [acc[0]+v[0], acc[1]+v[1], acc[2]+v[2]],
      [0,0,0]
    );
    const c = this.indexFingerHistory.length;
    return [sum[0]/c, sum[1]/c, sum[2]/c];
  }
}
