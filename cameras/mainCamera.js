import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

export default class MainCamera extends THREE.PerspectiveCamera {
    constructor() {
        super(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.position.set(0, 30, 50);
        this.lookAt(0, 0, 0);
    }

    updateAspect() {
        this.aspect = window.innerWidth / window.innerHeight;
        this.updateProjectionMatrix();
    }
}
