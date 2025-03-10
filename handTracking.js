// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
// // import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// // Optional: Import Cannon.js for physics (if needed)
// import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// export class HandTracker {
//     constructor(scene, camera, solarSystem, webcamStream) {
//         this.scene = scene;
//         this.camera = camera;
//         this.solarSystem = solarSystem;
//         this.video = document.getElementById('webcam');
//         this.handpose = null;
//         this.predictions = [];
//         this.isTracking = false;
//         this.onThrowCallback = null;
//         this.lastPosition = null;
//         this.throwThreshold = 0.5;
//         this.stream = webcamStream;
//     }

//     async start(onThrowCallback) {
//         try {
//             this.onThrowCallback = onThrowCallback;
    
//             console.log('Loading HandPose model...');
//             if (!window.handpose) {
//                 throw new Error('Handpose model not loaded. Make sure the script is loaded properly.');
//             }
//             this.handpose = await window.handpose.load();
//             console.log('HandPose model loaded successfully');
    
//             if (!this.stream) {
//                 throw new Error('Webcam stream not provided');
//             }
    
//             this.video.srcObject = this.stream;
//             await new Promise((resolve) => {
//                 this.video.onloadedmetadata = () => {
//                     this.video.play().then(resolve);
//                 };
//             });
    
//             // Check video dimensions after metadata is loaded
//             console.log(`Video dimensions: ${this.video.videoWidth}x${this.video.videoHeight}`);
//             if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
//                 throw new Error('Webcam video size is invalid. Ensure the webcam is functioning correctly.');
//             }
    
//             this.video.style.display = 'block';
//             this.isTracking = true;
//             this.track();
//             console.log('Hand tracking initialized successfully');
//         } catch (error) {
//             console.error('Error during hand tracking:', error);
//             throw error;
//         }
//     }
//     async track() {
//         if (!this.isTracking) return;

//         try {
//             // Get hand predictions
//             this.predictions = await this.handpose.estimateHands(this.video);

//             if (this.predictions.length > 0) {
//                 // Get palm position (using the base of the palm)
//                 const palmBase = this.predictions[0].landmarks[0];
//                 const palmPosition = new THREE.Vector3(
//                     (palmBase[0] / this.video.width) * 2 - 1,
//                     -(palmBase[1] / this.video.height) * 2 + 1,
//                     0.5
//                 );

//                 // If we have a previous position, calculate velocity
//                 if (this.lastPosition) {
//                     const velocity = palmPosition.clone().sub(this.lastPosition);
//                     const speed = velocity.length();

//                     // If movement is fast enough, trigger throw
//                     if (speed > this.throwThreshold && this.onThrowCallback) {
//                         // Convert screen space to world space
//                         const worldPosition = new THREE.Vector3();
//                         const worldVelocity = new THREE.Vector3();

//                         // Project palm position to world space
//                         palmPosition.unproject(this.camera);
//                         worldPosition.copy(palmPosition);

//                         // Calculate throw direction and velocity
//                         worldVelocity.copy(velocity).normalize();
//                         worldVelocity.z = -1; // Throw forward

//                         this.onThrowCallback(worldPosition, worldVelocity);
//                     }
//                 }

//                 this.lastPosition = palmPosition;
//             }

//             // Continue tracking
//             requestAnimationFrame(() => this.track());
//         } catch (error) {
//             console.error('Error during hand tracking:', error);
//             this.stop();
//         }
//     }

//     stop() {
//         this.isTracking = false;
//         if (this.video.srcObject) {
//             this.video.srcObject.getTracks().forEach(track => track.stop());
//         }
//         this.video.style.display = 'none';
//         this.lastPosition = null;
//         this.onThrowCallback = null;
//     }
// }
