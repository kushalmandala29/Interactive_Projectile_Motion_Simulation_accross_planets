import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/jsm/controls/OrbitControls.js';
import Renderer from './renderer.js';
import MainCamera from './cameras/mainCamera.js';
import SolarSystem from './models/solarSystem.js';
import { HandTracker } from './handTracking.js';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.6.4/dist/tween.esm.js';

console.log('Starting Solar System Application...');

// Scene setup
const container = document.getElementById('canvas-container');
if (!container) throw new Error('Could not find canvas container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000033);

const camera = new MainCamera();

// Renderer
const rendererInstance = new Renderer(container);
const renderer = rendererInstance.renderer;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(0, 10, 0);
sunLight.castShadow = true;
scene.add(sunLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 20;
controls.maxDistance = 100;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;

// Solar System
console.log('Creating solar system...');
const solarSystem = new SolarSystem(scene, camera, renderer);
solarSystem.controls = controls;
solarSystem.setupClickEvents(camera, renderer);

// Elements
const webcamElement = document.getElementById('webcam');
const mjpegImage    = document.getElementById('mjpeg');
let handTracker     = null;

// 1) Laptop webcam fallback
async function initWebcam() {
  try {
    webcamElement.muted = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 30 } }
    });
    webcamElement.srcObject = stream;
    await webcamElement.play();
    console.log('Webcam initialized successfully');
    return stream;
  } catch (error) {
    console.error('Error accessing webcam:', error);
    document.getElementById('error-message').innerText = 'Webcam not working: ' + error.message;
    document.getElementById('error-message').style.display = 'block';
    throw error;
  }
}

// 2) IP‑Webcam MJPEG → canvas → captureStream
async function initIPWebcam() {
  return new Promise((resolve, reject) => {
    const ip   = '192.168.0.185'; // your phone’s IP
    const port = '8080';          // IP Webcam port
    mjpegImage.crossOrigin = 'anonymous';
    mjpegImage.src = `http://${ip}:${port}/video`;

    mjpegImage.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = mjpegImage.naturalWidth;
      canvas.height = mjpegImage.naturalHeight;
      const ctx = canvas.getContext('2d');

      function drawFrame() {
        ctx.drawImage(mjpegImage, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const stream = canvas.captureStream(30);
      console.log('IP‑camera MJPEG via canvas stream ready');
      resolve(stream);
    };

    mjpegImage.onerror = (e) => {
      console.error('MJPEG image load error', e);
      reject(new Error('Failed to load MJPEG stream'));
    };
  });
}

// Hand‑tracking init
async function startHandTracking(stream) {
  console.log('Initializing hand tracking...');
  try {
    handTracker = new HandTracker(scene, camera, solarSystem, stream);
    window.handTracker = handTracker;
    await handTracker.start();
    window.dispatchEvent(new Event('hand-tracking-ready'));
    solarSystem.handTracker = handTracker;
    console.log('Hand tracking initialized successfully');
    return handTracker;
  } catch (error) {
    console.error('Failed to start hand tracking:', error);
    document.getElementById('error-message').innerText = 'Hand tracking failed: ' + error.message;
    document.getElementById('error-message').style.display = 'block';
    throw error;
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  TWEEN.update();
  solarSystem.update();
  renderer.render(scene, camera);
}

// Status overlay
function showHandTrackingStatus(message, isError = false) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '140px',
    right: '10px',
    padding: '5px 10px',
    borderRadius: '5px',
    color: 'white',
    background: isError ? 'rgba(255,0,0,0.7)' : 'rgba(0,0,0,0.7)',
    zIndex: '1000',
    fontSize: '12px'
  });
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => document.body.removeChild(el), 5000);
}

// Main entrypoint
async function main() {
  try {
    animate();

    let stream;
    try {
      stream = await initIPWebcam();
      showHandTrackingStatus('Using IP‑camera stream');
    } catch (ipErr) {
      console.warn('IP‑camera init failed, falling back to laptop webcam:', ipErr);
      showHandTrackingStatus('IP‑camera not available. Using laptop webcam.', true);
      stream = await initWebcam();
    }

    await startHandTracking(stream);
    showHandTrackingStatus('Hand tracking active! Make gestures with your hand.');
  } catch (err) {
    console.error('Initialization failed:', err);
    document.getElementById('error-message').innerText = 'Initialization failed: ' + err.message;
    document.getElementById('error-message').style.display = 'block';
  }
}

main();
