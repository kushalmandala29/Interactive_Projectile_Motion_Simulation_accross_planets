// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
// import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// export class PhysicsHandler {
//     constructor(scene) {
//         this.scene = scene;
//         this.projectiles = new Map();
        
//         // Initialize physics world
//         this.world = new CANNON.World({
//             gravity: new CANNON.Vec3(0, -9.82, 0)
//         });

//         // Create ground plane
//         const groundShape = new CANNON.Plane();
//         const groundBody = new CANNON.Body({
//             mass: 0,
//             shape: groundShape
//         });
//         groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
//         this.world.addBody(groundBody);

//         // Create ground plane visualization
//         const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
//         const groundMaterial = new THREE.MeshPhongMaterial({
//             color: 0x333333,
//             transparent: true,
//             opacity: 0.5
//         });
//         this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
//         this.groundMesh.rotation.x = -Math.PI / 2;
//         this.groundMesh.receiveShadow = true;
//         this.scene.add(this.groundMesh);
//     }

//     throwBall(ballBody, position, velocity) {
//         if (!ballBody) return;
        
//         // Reset ball position and apply velocity
//         ballBody.position.copy(position);
//         ballBody.velocity.copy(velocity);
//         ballBody.angularVelocity.set(
//             Math.random() - 0.5,
//             Math.random() - 0.5,
//             Math.random() - 0.5
//         );
//     }

//     throwProjectile(position, velocity) {
//         // Create projectile body
//         const radius = 0.5;
//         const sphereShape = new CANNON.Sphere(radius);
//         const projectileBody = new CANNON.Body({
//             mass: 1,
//             shape: sphereShape,
//             position: new CANNON.Vec3(position.x, position.y, position.z),
//             velocity: new CANNON.Vec3(velocity.x * 20, velocity.y * 20 + 10, velocity.z * 20),
//             linearDamping: 0.01, // Add slight air resistance
//             angularDamping: 0.1
//         });

//         // Create projectile mesh
//         const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
//         const sphereMaterial = new THREE.MeshPhongMaterial({
//             color: 0xff0000,
//             shininess: 30
//         });
//         const projectileMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
//         projectileMesh.castShadow = true;
//         projectileMesh.receiveShadow = true;

//         // Add to scene and physics world
//         this.scene.add(projectileMesh);
//         this.world.addBody(projectileBody);

//         // Store reference to both body and mesh
//         const projectile = {
//             body: projectileBody,
//             mesh: projectileMesh,
//             timeCreated: Date.now()
//         };
//         this.projectiles.set(projectileBody.id, projectile);

//         // Add collision event listener
//         projectileBody.addEventListener('collide', (event) => {
//             // Optional: Add collision effects here
//             console.log('Projectile collision');
//         });

//         // Remove projectile after 10 seconds
//         setTimeout(() => {
//             this.removeProjectile(projectileBody.id);
//         }, 10000);

//         return projectile;
//     }

//     removeProjectile(id) {
//         const projectile = this.projectiles.get(id);
//         if (projectile) {
//             this.world.removeBody(projectile.body);
//             this.scene.remove(projectile.mesh);
//             this.projectiles.delete(id);
//         }
//     }

//     update() {
//         // Step the physics world
//         this.world.step(1/60);

//         // Update visual meshes to match physics bodies
//         for (const projectile of this.projectiles.values()) {
//             projectile.mesh.position.copy(projectile.body.position);
//             projectile.mesh.quaternion.copy(projectile.body.quaternion);

//             // Remove projectiles that have fallen below the ground
//             if (projectile.body.position.y < -10) {
//                 this.removeProjectile(projectile.body.id);
//             }
//         }
//     }

//     cleanup() {
//         // Remove all projectiles
//         for (const projectile of this.projectiles.values()) {
//             this.scene.remove(projectile.mesh);
//             this.world.removeBody(projectile.body);
//         }
//         this.projectiles.clear();

//         // Remove ground
//         if (this.groundMesh) {
//             this.scene.remove(this.groundMesh);
//         }

//         // Remove all remaining bodies from the world
//         while(this.world.bodies.length > 0) {
//             this.world.removeBody(this.world.bodies[0]);
//         }
//     }
// }
