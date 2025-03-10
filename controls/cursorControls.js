import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/jsm/controls/OrbitControls.js';

export default class CursorControls {
    constructor(camera, renderer) {
        this.controls = new OrbitControls(camera, renderer.renderer.domElement);
        this.controls.enableDamping = true; // Smooth camera movement
    }

    update() {
        this.controls.update();
    }
}
