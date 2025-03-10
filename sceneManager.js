import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import SolarSystem from './models/solarSystem.js';

export default class SceneManager {
  constructor() {
    // Create a new scene with a dark blue background
    this.currentScene = new THREE.Scene();
    this.currentScene.background = new THREE.Color(0x000033);

    // Add stronger ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.currentScene.add(ambientLight);

    // Add directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(10, 20, 10);
    this.currentScene.add(directionalLight);

    // Add point light at center (sun position)
    const pointLight = new THREE.PointLight(0xffffff, 2.0, 100);
    pointLight.position.set(0, 0, 0);
    this.currentScene.add(pointLight);

    // Load the solar system model
    this.solarSystem = new SolarSystem();
    this.currentScene.add(this.solarSystem.group);

    console.log('Scene initialized with lights');
  }

  update() {
    if (this.solarSystem) {
      this.solarSystem.update(); // Update planetary rotation & orbits
    }
  }
}
