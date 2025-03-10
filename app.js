import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/jsm/controls/OrbitControls.js';
import Renderer from './renderer.js';
import MainCamera from './cameras/mainCamera.js';
import SolarSystem from './models/solarSystem.js';
// import { HandTracker } from './handTracking.js';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.6.4/dist/tween.esm.js';
// import { PhysicsHandler } from './physics.js';

console.log('Starting Solar System Application...');

// Get the container
const container = document.getElementById('canvas-container');
if (!container) {
    console.error('Could not find canvas container');
    throw new Error('Could not find canvas container');
}

// Initialize scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000033);

// Initialize camera
const camera = new MainCamera();

// Initialize renderer
const rendererInstance = new Renderer(container);
const renderer = rendererInstance.renderer;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(0, 10, 0);
sunLight.castShadow = true;
scene.add(sunLight);

// Initialize controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 20;
controls.maxDistance = 100;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;

// Create solar system
console.log('Creating solar system...');
const solarSystem = new SolarSystem(scene, camera, renderer);
solarSystem.controls = controls;

// Setup click events
solarSystem.setupClickEvents(camera, renderer);

// Initialize physics
// const physics = new PhysicsHandler(scene);

// webcam initialization
let webcamStream = null;
const webcamElement = document.getElementById('webcam');
let handTracker = null;

async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: 640,
        height: 480,
        frameRate: { ideal: 30 }
      } 
    });
    webcamStream = stream;
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

// // Initialize hand tracking
// async function startHandTracking(stream) {
//     console.log('Initializing hand tracking...');
//     try {
//       handTracker = new HandTracker(scene, camera, solarSystem, stream);
//       await handTracker.start((position, velocity) => {
//         physics.throwProjectile(position, velocity);
//       });
//       console.log('Hand tracking initialized successfully');
//     } catch (error) {
//       console.error('Failed to start hand tracking:', error);
//       document.getElementById('error-message').innerText = 'Hand tracking failed: ' + error.message;
//       document.getElementById('error-message').style.display = 'block';
//       throw error;
//     }
// }

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    TWEEN.update();
    // physics.update();
    solarSystem.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.updateAspect();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize everything
async function main() {
    try {
        // const stream = await initWebcam();
        // await startHandTracking(stream);
        // console.log('Starting animation...');
        animate();
        requestAnimationFrame(animate);
    } catch (error) {
        console.error('Initialization failed:', error);
        document.getElementById('error-message').innerText = 'Initialization failed: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
}

// Start the application
main();
