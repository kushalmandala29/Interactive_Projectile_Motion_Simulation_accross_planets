import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
// import { CSS2DRenderer, CSS2DObject } from 'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/jsm/controls/OrbitControls.js';
// Place this at the top of your file:
const planetGravity = {
    mercury: 3.7,
    venus: 8.87,
    earth: 9.81,
    moon: 1.62,
    mars: 3.71,
    jupiter: 24.79,
    saturn: 10.44,
    uranus: 8.87,
    neptune: 11.15
  };
  
export class PlanetEnvironment {
   
    constructor(scene, camera, renderer) {
        console.log('Initializing PlanetEnvironment...');
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.clock = new THREE.Clock();
        this.mixers = [];
        this.textureLoader = new THREE.TextureLoader();
        this.isInUpdateLoop = false;
        this.throwStartTime = 0;
        this.throwStartPosition = new THREE.Vector3();
        this.flightData = {
            initialVelocity: 0,
            angle: 0,
            range: 0,
            maxHeight: 0,
            flightTime: 0,
            theoreticalRange: 0,
            theoreticalTime: 0
        };
        // this.labelRenderer = new CSS2DRenderer();
        // this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        // this.labelRenderer.domElement.style.position = 'absolute';
        // this.labelRenderer.domElement.style.top = '0';
        // document.body.appendChild(this.labelRenderer.domElement);
        this.secondaryAngleLabel = null;
        this.projectileExplanationBoard = null;
        // Movement controls for the character.
        this.keyStates = {
            'w': false,
            's': false,
            'a': false,
            'd': false,
            ' ': false,  // jump
            'e': false   // pickup/hold ball
        };

        // Trajectory visualization properties.
        this.trajectoryLine = null;               // Forward (green) trajectory while aiming.
        this.secondaryTrajectoryLine = null;      // Secondary (red) trajectory when ball is thrown.
        this.trajectoryPoints = [];
        this.isAiming = false;
        this.throwForce = 15;
        this.throwAngle = Math.PI / 4; // 45°
        this.gravity = 9.82;          // m/s²
        this.landingMarker = null;
        this.throwStartPosition = new THREE.Vector3();
        this.throwStartTime = 0;
        this.isThrown = false;
        this.isHoldingBall = true;    // Whether the character is holding the ball.
        this.ballThrown = false;      // Whether the ball is in flight.
        this.flightData = {
            range: 0,
            maxHeight: 0,
            flightTime: 0,
            initialVelocity: 0,
            angle: 0
        };

        // Stored throw parameters (frozen at throw time).
        this.storedThrowForce = 0;
        this.storedThrowAngle = 0;
        this.initialThrowDirection = new THREE.Vector3();

        // UI controls.
        this.controls = {
            physicsPanel: null
        };

        // Create UI controls.
        this.createControls();

        // Bind event handlers.
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.update = this.update.bind(this);
        this.updateTrajectory = this.updateTrajectory.bind(this);
        this.throwBall = this.throwBall.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        // Add event listeners.
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        // Start update loop.
        this.lastTime = performance.now();
        this.update();

        // Projectile motion key controls.
        this.projectileKeyStates = {
            'w': false,
            's': false,
            'arrowup': false,
            'arrowdown': false,
            ' ': false,
            'i': false,
            'k': false,
            'j': false,
            'l': false,
            'e': false
        };

        window.addEventListener('keydown', this.onProjectileKeyDown.bind(this));
        window.addEventListener('keyup', this.onProjectileKeyUp.bind(this));
    }

    // ---------------------- New Helper Functions ----------------------

    // Adjusts the camera so that the full predicted (green) trajectory is visible.
    adjustCameraForTrajectory() {
        const points = [];
        const timeStep = 0.1;
        const maxTime = 5.0;
        const vx = this.storedThrowForce * Math.cos(this.storedThrowAngle);
        const vy = this.storedThrowForce * Math.sin(this.storedThrowAngle);
        // Compute predicted trajectory from the stored throw origin.
        for (let t = 0; t <= maxTime; t += timeStep) {
            const x = this.throwStartPosition.x + this.initialThrowDirection.x * vx * t;
            const z = this.throwStartPosition.z + this.initialThrowDirection.z * vx * t;
            const y = this.throwStartPosition.y + vy * t - 0.5 * this.gravity * t * t;
            if (y < 0) break;
            points.push(new THREE.Vector3(x, y, z));
        }
        if (points.length === 0) return;
        const bbox = new THREE.Box3().setFromPoints(points);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        // Offset perpendicular to the throw direction.
        const perp = new THREE.Vector3(-this.initialThrowDirection.z, 0, this.initialThrowDirection.x).normalize();
        const offsetDistance = size.x * 2;
        const targetPos = center.clone().add(perp.multiplyScalar(offsetDistance));
        targetPos.y += size.y * 0.8;
        this.camera.position.copy(targetPos);
        this.camera.lookAt(center);
    }

    // Updates the secondary (red) trajectory line.
    updateSecondaryTrajectory() {
       
            // Use the current character position as the starting point
            const startPos = this.character.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        
            // Use stored throw parameters
            const vx = this.storedThrowForce * Math.cos(this.storedThrowAngle);
            const vy = this.storedThrowForce * Math.sin(this.storedThrowAngle);
        
            const points = [];
            const timeStep = 0.1;
            // Increase this if your throws can last longer than 5 seconds
            const maxTime = 10.0;
        
            for (let t = 0; t <= maxTime; t += timeStep) {
                const x = startPos.x + this.initialThrowDirection.x * vx * t;
                const z = startPos.z + this.initialThrowDirection.z * vx * t;
                let y = startPos.y + vy * t - 0.5 * this.gravity * t * t;
        
                // Instead of breaking out of the loop if y < 0, just clamp it to 0
                // or let it go negative if you want to see the path continue below ground.
                if (y < 0) {
                    y = 0;
                    break; // Clamped to ground
                }
        
                points.push(new THREE.Vector3(x, y, z));
            }
        
            if (!this.secondaryTrajectoryLine) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                // You can switch to LineBasicMaterial to avoid any dashed confusion:
                // const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
                const material = new THREE.LineDashedMaterial({
                    color: 0xff0000,
                    dashSize: 0.5,
                    gapSize: 0.2,
                    linewidth: 10,
                    opacity: 0.9,
                    transparent: true
                });
                this.secondaryTrajectoryLine = new THREE.Line(geometry, material);
                this.secondaryTrajectoryLine.computeLineDistances();
                
                // Disable frustum culling if you’re worried about it disappearing
                // this.secondaryTrajectoryLine.frustumCulled = false;
        
                this.scene.add(this.secondaryTrajectoryLine);
            } else {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                this.secondaryTrajectoryLine.geometry.dispose();
                this.secondaryTrajectoryLine.geometry = geometry;
                this.secondaryTrajectoryLine.computeLineDistances();
                this.secondaryTrajectoryLine.visible = true;
            }
        }


    // ---------------------- End New Helper Functions ----------------------

    // Initializes projectile physics and creates a unified ball.
    initProjectilePhysics() {
        if (!this.physicsWorld) {
            this.physicsWorld = new CANNON.World();
            this.physicsWorld.gravity.set(0, -9.82, 0);
            this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
            this.physicsWorld.solver.iterations = 10;
            this.physicsWorld.defaultContactMaterial.friction = 0.5;
        }
        if (!this.groundBody) {
            const groundShape = new CANNON.Plane();
            const groundBody = new CANNON.Body({ mass: 0, material: this.groundMaterial });
            groundBody.addShape(groundShape);
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.physicsWorld.addBody(groundBody);
            this.groundBody = groundBody;
        }
        const ballRadius = 0.5;
        const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
        const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.5, roughness: 0.4 });
        this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        const charPos = this.character ? this.character.position : new THREE.Vector3(0, 0, 0);
        this.ball.position.set(charPos.x + 2, ballRadius, charPos.z);
        this.scene.add(this.ball);
        console.log(`Ball Mesh Created at: X=${this.ball.position.x}, Y=${this.ball.position.y}, Z=${this.ball.position.z}`);

        const ballShape = new CANNON.Sphere(ballRadius);
        this.ballBody = new CANNON.Body({
            mass: 2,
            material: this.ballMaterial,
            position: new CANNON.Vec3(this.ball.position.x, this.ball.position.y, this.ball.position.z),
            linearDamping: 0.3,
            angularDamping: 0.3
        });
        this.ballBody.addShape(ballShape);
        // Make the ball kinematic when held.
        this.ballBody.type = CANNON.Body.KINEMATIC;
        this.ballBody.addEventListener('collide', (event) => {
            const contact = event.contact;
            const normalVelocity = contact.getImpactVelocityAlongNormal();
            if (normalVelocity < -1) {
                this.ballBody.velocity.scale(0.8, this.ballBody.velocity);
                if (this.isThrown) {
                    this.isThrown = false;
                    this.updateLandingMarker(this.ball.position.clone());
                    this.updateFlightData();
                    this.displayFlightData();
                }
            }
        });
        this.physicsWorld.addBody(this.ballBody);
        console.log("Ball body created at:", this.ballBody.position);

        if (!this.trajectoryLine) {
            const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(1, 1, 0),
                new THREE.Vector3(2, 0, 0)
            ];
            const lineGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(points.length * 3);
            points.forEach((point, i) => {
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            });
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const lineMaterial = new THREE.LineDashedMaterial({
                color: 0x00ff00,
                dashSize: 2,
                gapSize: 1,
                linewidth: 5,
                scale: 2,
                opacity: 0.8,
                transparent: true
            });
            this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
            this.trajectoryLine.computeLineDistances();
            this.trajectoryLine.visible = false;
            this.trajectoryLine.frustumCulled = false;
            this.scene.add(this.trajectoryLine);
            console.log("Trajectory line created with points:", points.length);
        }

        if (!this.landingMarker) {
            const markerGeometry = new THREE.RingGeometry(0.5, 0.6, 32);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
            this.landingMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            this.landingMarker.rotation.x = -Math.PI / 2;
            this.landingMarker.position.set(charPos.x + 2, 0.01, charPos.z);
            this.landingMarker.visible = false;
            this.scene.add(this.landingMarker);
        }
    }
    
    hidePhysicsCalculations() {
        const physicsElement = document.getElementById('physics-calculations');
        if (physicsElement) {
            physicsElement.innerHTML = '';
        }
    }
    hideProjectileExplanation() {
        if (this.projectileExplanationBoard) {
            document.body.removeChild(this.projectileExplanationBoard);
            this.projectileExplanationBoard = null;
        }
    }
    showProjectileExplanation() {
        // If board is already open, don't recreate it.
        if (this.projectileExplanationBoard) return;

        // Calculate values from flightData
        const u = this.flightData.initialVelocity;
        const g = this.gravity;
        const angleRad = this.flightData.angle;
        const angleDeg = (angleRad * 180 / Math.PI);
        const sinAngle = Math.sin(angleRad);
        const numeratorT = 2 * u * sinAngle;
        const timeOfFlight = numeratorT / g;
        const vy = u * sinAngle;
        const numeratorH = vy * vy;
        const denominatorH = 2 * g;
        const maxHeight = numeratorH / denominatorH;
        const sinDoubleAngle = Math.sin(2 * angleRad);
        const numeratorR = (u * u) * sinDoubleAngle;
        const rangeVal = numeratorR / g;
        
        // Create container for the explanation board
        const board = document.createElement('div');
        board.style.position = 'absolute';
        board.style.top = '10px';
        board.style.left = '10px';
        board.style.width = '360px';
        board.style.padding = '8px';
        board.style.borderRadius = '8px';
        board.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        board.style.color = 'white';
        board.style.fontFamily = 'Arial, sans-serif';
        board.style.fontSize = '14px';
        board.style.lineHeight = '1.2';
        board.style.zIndex = '9999';
        document.body.appendChild(board);
        this.projectileExplanationBoard = board;
        
        // Create the final HTML content as a single string.
        const finalHTML = `
            <h2 style="margin-top: 0;">Step-by-Step Calculation</h2><br>
            <h3 style="margin: 4px 0;">Step 1: Given Data</h3>
            <p style="margin: 2px 0;">Initial velocity (u) = ${u.toFixed(2)} m/s</p>
            <p style="margin: 2px 0;">Angle (θ) = ${angleDeg.toFixed(2)}°</p>
            <p style="margin: 2px 0;">Gravity (g) = ${g.toFixed(2)} m/s²</p>
            <h3 style="margin: 4px 0;">Step 2: Find Time of Flight (T)</h3>
            <p style="margin: 2px 0;">T = (2 × u × sinθ) / g</p>
            <p style="margin: 2px 0;">T = (2 × ${u.toFixed(2)} × sin(${angleDeg.toFixed(2)}°)) / ${g.toFixed(2)}</p>
            <p style="margin: 2px 0;">sin(${angleDeg.toFixed(2)}°) ≈ ${sinAngle.toFixed(3)}</p>
            <p style="margin: 2px 0;">T = (${(2*u).toFixed(2)} × ${sinAngle.toFixed(3)}) / ${g.toFixed(2)}</p>
            <p style="margin: 2px 0;">T = ${numeratorT.toFixed(2)} / ${g.toFixed(2)}</p>
            <p style="margin: 2px 0;">T = ${timeOfFlight.toFixed(2)} s</p>
            <h3 style="margin: 4px 0;">Step 3: Find Maximum Height (H)</h3>
            <p style="margin: 2px 0;">H = (u² sin²θ) / (2g)</p>
            <p style="margin: 2px 0;">Numerator = (u sinθ)² = ${vy.toFixed(2)}² = ${numeratorH.toFixed(2)}</p>
            <p style="margin: 2px 0;">Denominator = 2 × ${g.toFixed(2)} = ${denominatorH.toFixed(2)}</p>
            <p style="margin: 2px 0;">H = ${maxHeight.toFixed(2)} m</p>
            <h3 style="margin: 4px 0;">Step 4: Find Range (R)</h3>
            <p style="margin: 2px 0;">R = (u² × sin(2θ)) / g</p>
            <p style="margin: 2px 0;">sin(2θ) = ${sinDoubleAngle.toFixed(3)}</p>
            <p style="margin: 2px 0;">Numerator = ${(u*u).toFixed(2)} × ${sinDoubleAngle.toFixed(3)} = ${numeratorR.toFixed(2)}</p>
            <p style="margin: 2px 0;">Denominator = ${g.toFixed(2)}</p>
            <p style="margin: 2px 0;">R = ${rangeVal.toFixed(2)} m</p>
        `;
        
        board.innerHTML = finalHTML;
        
    
        // Helper function for the typewriter effect.
        function typeWriterEffect(text, container, speed, callback) {
            let index = 0;
            function addNext() {
                if (index < text.length) {
                    // If we detect an HTML tag, add the whole tag at once.
                    if (text[index] === '<') {
                        const endTag = text.indexOf('>', index);
                        if (endTag === -1) {
                            container.innerHTML += text.substring(index);
                            index = text.length;
                        } else {
                            container.innerHTML += text.substring(index, endTag + 1);
                            index = endTag + 1;
                        }
                        addNext(); // Immediately process the next part.
                    } else {
                        container.innerHTML += text[index];
                        index++;
                        setTimeout(addNext, speed);
                    }
                } else {
                    if (callback) callback();
                }
            }
            addNext();
        }
    
        // Clear any current content in the board and start the typewriter effect.
        board.innerHTML = '';
        const letterSpeed = 40; // Adjust speed (ms) between letters as needed.
        typeWriterEffect(finalHTML, board, letterSpeed, () => {
            // When the effect is complete, attach the close button listener.
            const closeBtn = document.getElementById('closeBoardBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideProjectileExplanation();
                });
            }
        });
    }
    
    
    
    

    
    // Update loop: handles physics, camera, character movement, and trajectory updates.
    update() {
        const time = performance.now();
        const delta = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (this.isInUpdateLoop) {
            // If the ball is thrown, update its position using the projectile motion equations.
            if (this.ballThrown && !this.isHoldingBall) {
                const currentTime = performance.now();
                const t = (currentTime - this.throwStartTime) / 1000;
                const vx = this.storedThrowForce * Math.cos(this.storedThrowAngle);
                const vy = this.storedThrowForce * Math.sin(this.storedThrowAngle);
                const newX = this.throwStartPosition.x + this.initialThrowDirection.x * vx * t;
                const newY = this.throwStartPosition.y + vy * t - 0.5 * this.gravity * t * t;
                const newZ = this.throwStartPosition.z + this.initialThrowDirection.z * vx * t;
                this.ball.position.set(newX, newY, newZ);
                this.ballBody.position.copy(this.ball.position);

                // When the ball reaches or goes below the ground, mark it as landed.
                if (newY <= 0) {
                    this.isThrown = false;
                    this.ballThrown = false;
                    this.updateLandingMarker(new THREE.Vector3(newX, 0.01, newZ));
                    // this.displayFlightData();
                    this.showProjectileExplanation();

                }
            } else if (this.physicsWorld && this.ballBody && this.ball) {
                this.updateProjectilePhysics(delta);
            }

            if (this.controls && this.controls.update) {
                this.controls.update();
            }
            this.handleCharacterMovement(delta);

            // When the ball is held, update its position from the character's left hand.
            if (this.isHoldingBall && !this.ballThrown) {
                let handWorldPos = new THREE.Vector3();
                this.character.leftArm.getWorldPosition(handWorldPos);
                const offset = new THREE.Vector3(0, 0.2, 0);
                handWorldPos.add(offset);
                this.ball.position.copy(handWorldPos);
                this.ballBody.position.copy(handWorldPos);
                this.updateTrajectoryPreview();
                this.updatePhysicsCalculations();
                if (this.secondaryTrajectoryLine) {
                    this.secondaryTrajectoryLine.visible = false;
                }
            }

            // Update the secondary (red) trajectory if the ball is in flight.
            if (this.ballThrown && !this.isHoldingBall) {
                this.updateSecondaryTrajectory();
            }
        }

        
        // requestAnimationFrame(this.update.bind(this));
        this.renderer.render(this.scene, this.camera);
            // Add this line for the label renderer
    //     if (this.labelRenderer) {
    //     this.labelRenderer.render(this.scene, this.camera);
    // }


    }

    // Advances the physics simulation and syncs the ball mesh.
    updateProjectilePhysics(deltaTime) {
        this.physicsWorld.step(1 / 60, deltaTime, 3);
        this.ball.position.copy(this.ballBody.position);
        this.ball.quaternion.copy(this.ballBody.quaternion);
    }

    // Handles character movement.
    handleCharacterMovement(deltaTime) {
        if (!this.character || !this.characterBody) return;
        const moveSpeed = 5 * deltaTime;
        const moveDirection = new THREE.Vector3();
        if (this.projectileKeyStates['i']) { moveDirection.z -= 1; }
        if (this.projectileKeyStates['k']) { moveDirection.z += 1; }
        if (this.projectileKeyStates['j']) { moveDirection.x -= 1; }
        if (this.projectileKeyStates['l']) { moveDirection.x += 1; }
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            moveDirection.applyQuaternion(this.camera.quaternion);
            moveDirection.y = 0;
            moveDirection.normalize();
            this.character.position.x += moveDirection.x * moveSpeed;
            this.character.position.z += moveDirection.z * moveSpeed;
            this.characterBody.position.copy(this.character.position);
            if (this.isHoldingBall) {
                const offset = new THREE.Vector3(0, 1, 0);
                const holdingPos = this.character.position.clone().add(offset);
                this.ballBody.position.copy(holdingPos);
                this.ball.position.copy(holdingPos);
                this.updateTrajectoryPreview();
            }
        }
    }

    // (Optional) Additional physics update method.
    updatePhysics(deltaTime) {
        this.physicsWorld.step(1 / 60, deltaTime, 3);
        if (this.characterBody && this.character) {
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
            const moveDirection = new THREE.Vector3();
            if (this.keyStates['w']) { moveDirection.add(cameraDirection); }
            if (this.keyStates['s']) { moveDirection.sub(cameraDirection); }
            if (this.keyStates['a']) { moveDirection.sub(cameraRight); }
            if (this.keyStates['d']) { moveDirection.add(cameraRight); }
            if (moveDirection.lengthSq() > 0) {
                moveDirection.normalize();
                const moveSpeed = 30;
                moveDirection.multiplyScalar(moveSpeed);
                this.characterBody.velocity.x = moveDirection.x;
                this.characterBody.velocity.z = moveDirection.z;
                const angle = Math.atan2(moveDirection.x, moveDirection.z);
                this.character.rotation.y = angle;
            } else {
                this.characterBody.velocity.x *= 0.8;
                this.characterBody.velocity.z *= 0.8;
            }
            if (this.keyStates[' '] && this.characterBody.position.y <= 0.5) {
                const jumpForce = 10;
                this.characterBody.velocity.y = jumpForce;
            }
            this.character.position.copy(this.characterBody.position);
        }
        if (this.ball && this.ballBody) {
            this.ball.position.copy(this.ballBody.position);
            this.ball.quaternion.copy(this.ballBody.quaternion);
        }
        if (this.isThrown) {
            const timeElapsed = (performance.now() - this.throwStartTime) / 1000;
            const range = this.throwForce * Math.cos(this.throwAngle) * timeElapsed;
            const height = this.throwForce * Math.sin(this.throwAngle) * timeElapsed - 0.5 * this.gravity * timeElapsed * timeElapsed;
            this.flightData.range = range;
            this.flightData.maxHeight = Math.max(this.flightData.maxHeight, height);
            this.flightData.flightTime = timeElapsed;
            if (height < 0) {
                this.isThrown = false;
                this.landingMarker.position.copy(this.ball.position);
            }
        }
    }
    showPlanetNotice(planetName) {
        // If a board already exists, remove it or update it (optional):
        if (this.planetNoticeBoard) {
            document.body.removeChild(this.planetNoticeBoard);
            this.planetNoticeBoard = null;
        }
    
        // Create a container <div>
        const board = document.createElement('div');
        board.id = 'planet-notice';
        board.style.position = 'absolute';
        board.style.top = '20px';
        board.style.left = '50%';
        // Shift it left by 50% of its own width to center it horizontally
        board.style.transform = 'translateX(-50%)';
        board.style.padding = '10px 15px';
        board.style.borderRadius = '8px';
        board.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        board.style.color = '#fff';
        board.style.fontFamily = 'Arial, sans-serif';
        board.style.fontSize = '16px';
        board.style.zIndex = '9999'; // ensure it's on top
        board.style.textAlign = 'center';
    
        // Set the content
        board.innerText = `Welcome to ${planetName}!`;
    
        // Append to the document body
        document.body.appendChild(board);
    
        // Store reference so we can remove it later
        this.planetNoticeBoard = board;
    }
    

    // Updates the forward (green) trajectory preview while aiming.
    updateTrajectory() {
        if (!this.isAiming || !this.ball) return;
        const position = new THREE.Vector3();
        position.copy(this.character.position);
        const direction = new THREE.Vector3();
        direction.copy(this.camera.getWorldDirection(new THREE.Vector3()));
        direction.y = 0;
        direction.normalize();
        const startPos = position.clone().add(direction.clone().multiplyScalar(1.5));
        startPos.y += 1.5;
        this.throwStartPosition.copy(startPos);
        const vx = this.throwForce * Math.cos(this.throwAngle);
        const vy = this.throwForce * Math.sin(this.throwAngle);
        const points = [];
        const timeStep = 0.1;
        const maxTime = 10.0;
        let maxHeight = startPos.y;
        let landingPoint = null;
        for (let t = 0; t <= maxTime; t += timeStep) {
            const x = startPos.x + direction.x * vx * t;
            const z = startPos.z + direction.z * vx * t;
            const y = startPos.y + vy * t - (0.5 * this.gravity * t * t);
            maxHeight = Math.max(maxHeight, y);
            if (y <= 0 && t > 0) {
                if (!landingPoint) {
                    landingPoint = new THREE.Vector3(x, 0.01, z);
                    this.updateLandingMarker(landingPoint);
                    this.flightData.theoreticalRange = Math.sqrt(
                        Math.pow(x - startPos.x, 2) +
                        Math.pow(z - startPos.z, 2)
                    );
                    this.flightData.maxHeight = maxHeight - startPos.y;
                    this.flightData.theoreticalTime = t;
                }
                break;
            }
            points.push(new THREE.Vector3(x, y, z));
        }
        if (this.trajectoryLine) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.geometry = geometry;
            this.trajectoryLine.computeLineDistances();
            this.trajectoryLine.visible = true;
        }
        this.displayFlightData();
    }

    // Throws the ball and adjusts the camera.
    throwBall() {
        if (!this.isHoldingBall || this.ballThrown) return;
        console.log("Throwing ball...");
        if (this.character) {
            this.ballBody.position.copy(this.character.position);
            this.ballBody.position.y += 1.5;
        } else {
            this.ballBody.position.set(0, 2, 0);
        }
        this.ball.position.copy(this.ballBody.position);
        const direction = new THREE.Vector3();
        direction.copy(this.camera.getWorldDirection(new THREE.Vector3()));
        direction.y = 0;
        direction.normalize();
        // Store the throw parameters.
        this.initialThrowDirection = direction.clone();
        this.storedThrowForce = this.throwForce;
        this.storedThrowAngle = this.throwAngle;
        // Save the throw origin as the character's current position (plus offset).
        this.throwStartPosition.copy(this.character.position).add(new THREE.Vector3(0, 1.5, 0));
        const vx = this.throwForce * Math.cos(this.throwAngle);
        const vy = this.throwForce * Math.sin(this.throwAngle);
        this.ballBody.velocity.set(
            direction.x * vx,
            vy,
            direction.z * vx
        );
        // Switch ball to dynamic with zero damping for ideal projectile motion.
        this.ballBody.type = CANNON.Body.DYNAMIC;
        this.ballBody.linearDamping = 0;
        this.ballBody.angularDamping = 0;
        this.isHoldingBall = false;
        this.ballThrown = true;
        this.throwStartTime = performance.now();
        this.trajectoryLine.visible = false;
        this.landingMarker.visible = false;
        this.hidePhysicsCalculations();
        // Adjust the camera to show the full trajectory.
        this.adjustCameraForTrajectory();
    }

    // (Optional) Tracks ball flight.
    trackBallFlight() {
        const trackingData = {
            startTime: performance.now(),
            startPosition: this.throwStartPosition.clone(),
            maxHeight: this.throwStartPosition.y,
            positions: [this.throwStartPosition.clone()],
            landed: false
        };
        const trackingInterval = setInterval(() => {
            if (!this.ball || !this.ballBody) {
                clearInterval(trackingInterval);
                return;
            }
            if (this.ball.position.y > trackingData.maxHeight) {
                trackingData.maxHeight = this.ball.position.y;
            }
            trackingData.positions.push(this.ball.position.clone());
            if (!trackingData.landed && this.ballBody.position.y < 0.5) {
                setTimeout(() => this.resetBall(), 2000);
            }
            if (this.isHoldingBall && !this.ballThrown) {
                this.updateTrajectoryPreview();
                this.updatePhysicsCalculations();
            }
        }, 16);
    }

    // Displays flight data in the UI.
    displayActualFlightData(flightTime, distance, maxHeight) {
        const physicsPanel = this.controls.physicsPanel;
        if (!physicsPanel) return;
        physicsPanel.style.display = 'block';
        const initialVelocity = this.throwForce;
        const angle = this.throwAngle * (180 / Math.PI);
        const gravity = Math.abs(this.physicsHandler.gravity.y);
        const theoreticalRange = (initialVelocity * initialVelocity * Math.sin(2 * this.throwAngle)) / gravity;
        const theoreticalMaxHeight = (initialVelocity * initialVelocity * Math.pow(Math.sin(this.throwAngle), 2)) / (2 * gravity);
        const theoreticalTime = (2 * initialVelocity * Math.sin(this.throwAngle)) / gravity;
        physicsPanel.innerHTML = `
            <h2 style="color: #4CAF50; margin: 0 0 15px 0; font-size: 18px;">Projectile Motion Analysis</h2>
            <div style="margin-bottom: 15px;">
                <h3 style="color: #2196F3; margin: 0 0 8px 0; font-size: 16px;">Step 1: Initial Conditions</h3>
                <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px;">
                    • Initial Velocity (v₀): ${initialVelocity.toFixed(2)} m/s<br>
                    • Launch Angle (θ): ${angle.toFixed(2)}°<br>
                    • Gravity (g): ${gravity.toFixed(2)} m/s²
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <h3 style="color: #2196F3; margin: 0 0 8px 0; font-size: 16px;">Step 2: Measured Results</h3>
                <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px;">
                    • Distance: ${distance.toFixed(2)} m<br>
                    • Max Height: ${maxHeight.toFixed(2)} m<br>
                    • Flight Time: ${flightTime.toFixed(2)} s
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <h3 style="color: #2196F3; margin: 0 0 8px 0; font-size: 16px;">Step 3: Theoretical Calculations</h3>
                <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px;">
                    <strong>Range (R):</strong><br>
                    R = (v₀² × sin(2θ)) / g<br>
                    R = ${theoreticalRange.toFixed(2)} m<br><br>
                    <strong>Max Height (h):</strong><br>
                    h = (v₀² × sin²(θ)) / (2g)<br>
                    h = ${theoreticalMaxHeight.toFixed(2)} m<br><br>
                    <strong>Flight Time (t):</strong><br>
                    t = (2 × v₀ × sin(θ)) / g<br>
                    t = ${theoreticalTime.toFixed(2)} s
                </div>
            </div>
            <div style="font-style: italic; color: #9E9E9E; font-size: 12px;">
                Note: Differences between measured and theoretical values are due to air resistance and other real-world factors.
            </div>
        `;
    }

    // Attaches the ball to the character's left hand.
    attachBallToCharacter() {
        if (!this.character || !this.ball) return;
        let handWorldPos = new THREE.Vector3();
        this.character.leftArm.getWorldPosition(handWorldPos);
        const offset = new THREE.Vector3(0, 0.2, 0);
        handWorldPos.add(offset);
        this.ball.position.copy(handWorldPos);
        if (this.ballBody) {
            this.ballBody.position.copy(handWorldPos);
            this.ballBody.velocity.set(0, 0, 0);
            this.ballBody.angularVelocity.set(0, 0, 0);
            this.ballBody.type = CANNON.Body.KINEMATIC;
        }
    }

    // Picks up the ball if within range.
    pickupBall() {
        if (!this.character || !this.ball || !this.ballBody) {
            console.log("Cannot pick up ball - character or ball not found");
            return;
        
        
        }
        const distanceToBall = this.character.position.distanceTo(this.ball.position);
        // const pickupRange = 8.0;
        // console.log("Distance to ball:", distanceToBall, "Pickup range:", pickupRange);
        // if (distanceToBall <= pickupRange) {
            this.isHoldingBall = true;
            this.isThrown = false;
            this.attachBallToCharacter();
            this.ballBody.position.copy(this.ball.position);
            this.isAiming = false;
            if (this.secondaryTrajectoryLine) {
                this.secondaryTrajectoryLine.visible = false;
            }
            this.hideProjectileExplanation();
            // console.log(`Ball Position: X=${this.ball.position.x.toFixed(2)}, Y=${this.ball.position.y.toFixed(2)}, Z=${this.ball.position.z.toFixed(2)}`);
            // console.log(`Ball Body Position: X=${this.ballBody.position.x.toFixed(2)}, Y=${this.ballBody.position.y.toFixed(2)}, Z=${this.ballBody.position.z.toFixed(2)}`);
        //     // console.log("Ball picked up");
        // } else {
        //     console.log("Ball is too far away to pick up");
        // }
        // this.isHoldingBall = true;
        // this.ballThrown = false;
    }

    // Mouse down: if aiming, throw the ball.
    onMouseDown(event) {
        if (event.button !== 0) return;
        if (event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'INPUT' ||
            event.target.closest('.throw-control-container') ||
            event.target.closest('.flight-data-display')) {
            return;
        }
        if (this.isAiming) {
            this.throwBall();
            console.log("Ball thrown via mouse click");
        }
    }

    // Mouse move: update aiming angle.
    onMouseMove(event) {
        if (this.isAiming) {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const mouseX = event.clientX - centerX;
            const mouseY = centerY - event.clientY;
            let angle = Math.atan2(mouseY, mouseX);
            angle = Math.max(0, Math.min(Math.PI / 2, angle));
            this.throwAngle = angle;
            if (this.controls && this.controls.angleInput) {
                this.controls.angleInput.value = (angle * 180 / Math.PI).toFixed(1);
                this.controls.angleValue.textContent = (angle * 180 / Math.PI).toFixed(1) + '°';
            }
            this.updateTrajectory();
            console.log("Mouse move angle: " + (angle * 180 / Math.PI).toFixed(1) + "°");
        }
    }

    // Mouse up: stop aiming.
    onMouseUp(event) {
        if (this.isAiming) {
            this.isAiming = false;
        }
    }

    // Creates the UI controls.
    createControls() {
        const controlsContainer = document.createElement('div');
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.left = '20px';
        controlsContainer.style.top = '20px';
        controlsContainer.style.zIndex = '1000';
        const physicsPanel = document.createElement('div');
        physicsPanel.id = 'physicsPanel';
        physicsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        physicsPanel.style.color = 'white';
        physicsPanel.style.padding = '15px';
        physicsPanel.style.borderRadius = '8px';
        physicsPanel.style.marginTop = '10px';
        physicsPanel.style.width = '300px';
        physicsPanel.style.fontFamily = 'Arial, sans-serif';
        physicsPanel.style.display = 'none';
        physicsPanel.style.zIndex = '1000';
        this.controls = { physicsPanel };
        controlsContainer.appendChild(physicsPanel);
        document.body.appendChild(controlsContainer);
    }
    

    // Setup: initializes environment, physics, character, and ball.
    async setup(planetName) {
        this.gravity = planetGravity[planetName.toLowerCase()] || 9.81;
        console.log(`Using gravity of ${this.gravity} m/s² for ${planetName}`);
        try {
            this.setupPhysics();
            this.physicsHandler = {
                throwBall: (body, position, velocity) => {
                    body.position.copy(position);
                    body.velocity.copy(velocity);
                    body.angularVelocity.set(0, 0, 0);
                    body.type = CANNON.Body.DYNAMIC;
                    console.log("Ball thrown with velocity:", velocity);
                }
            
            };

            await this.createPlanetEnvironment(planetName);
            this.createCharacter();
            // console.log("Character created at position:", this.character ? this.character.position : "Character not created");
            this.initProjectilePhysics();
            // console.log("Ball created at position:", this.ball ? this.ball.position : "Ball not created");
            this.setupCameraControls();
            this.isInUpdateLoop = true;
            this.showPlanetNotice(planetName);
            console.log('Planet environment setup complete');
        } catch (error) {
            console.error('Error setting up planet environment:', error);
            throw error;
        }
    }

    // Sets up the physics world and contact materials.
    setupPhysics() {
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -this.gravity, 0);
        this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
        this.physicsWorld.solver.iterations = 10;
        this.physicsWorld.defaultContactMaterial.friction = 0.5;
        this.groundMaterial = new CANNON.Material('groundMaterial');
        this.characterMaterial = new CANNON.Material('characterMaterial');
        this.ballMaterial = new CANNON.Material('ballMaterial');
        const groundCharacterCM = new CANNON.ContactMaterial(
            this.groundMaterial,
            this.characterMaterial,
            {
                friction: 0.5,
                restitution: 0.3,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        const groundBallCM = new CANNON.ContactMaterial(
            this.groundMaterial,
            this.ballMaterial,
            {
                friction: 0.3,
                restitution: 0.6,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        this.physicsWorld.addContactMaterial(groundCharacterCM);
        this.physicsWorld.addContactMaterial(groundBallCM);
    }

    // Sets up OrbitControls.
    setupCameraControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 1.5;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 1.5;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.enableSmoothing = true;
        this.controls.smoothingTime = 0.5;
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        // Create a CSS2DRenderer for 2D text labels
        // this.labelRenderer = new CSS2DRenderer();
        // this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        // this.labelRenderer.domElement.style.position = 'absolute';
        // this.labelRenderer.domElement.style.top = '0';
        // document.body.appendChild(this.labelRenderer.domElement);
        this.renderer.render(this.scene, this.camera);

        // this.labelRenderer.render(this.scene, this.camera);
    }

    // Creates the planet environment.
    async createPlanetEnvironment(planetName) {
        const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
        const skyboxMaterial = new THREE.MeshBasicMaterial({
            color: 0x000020,
            side: THREE.BackSide,
            fog: false
        });
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        this.scene.add(skybox);
        const terrainSize = 200;
        const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
        let terrainMaterial;
        switch(planetName.toLowerCase()) {
            case 'mars':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0xc1440e,
                    roughness: 0.8,
                    metalness: 0.2
                });
                break;
            case 'moon':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x808080,
                    roughness: 0.9,
                    metalness: 0.3
                });
                break;
            case 'mercury':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B7355,
                    roughness: 0.7,
                    metalness: 0.4
                });
                break;
            case 'venus':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0xFFA500,
                    roughness: 0.6,
                    metalness: 0.3
                });
                break;
            case 'earth':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x228B22,
                    roughness: 0.8,
                    metalness: 0.1
                });
                break;
            case 'jupiter':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0xDEB887,
                    roughness: 0.7,
                    metalness: 0.2
                });
                break;
            case 'saturn':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0xDAA520,
                    roughness: 0.6,
                    metalness: 0.3
                });
                break;
            case 'uranus':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x40E0D0,
                    roughness: 0.7,
                    metalness: 0.2
                });
                break;
            case 'neptune':
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x4169E1,
                    roughness: 0.7,
                    metalness: 0.3
                });
                break;
            default:
                terrainMaterial = new THREE.MeshStandardMaterial({
                    color: 0x808080,
                    roughness: 0.8,
                    metalness: 0.2
                });
        }
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.scene.add(terrain);
        this.terrain = terrain;
        const terrainBody = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial
        });
        const terrainShape = new CANNON.Plane();
        terrainBody.addShape(terrainShape);
        terrainBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.physicsWorld.addBody(terrainBody);
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        this.scene.add(sunLight);
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 1000;
            const y = (Math.random() - 0.5) * 1000;
            const z = (Math.random() - 0.5) * 1000;
            starsVertices.push(x, y, z);
        }
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
        this.scene.fog = new THREE.FogExp2(0x000020, 0.0015);
    }

    // For a flat plane, returns 0.
    findHeightAtPosition(x, z) {
        return 0;
    }

    // Creates the character and its physics body.
    createCharacter() {
        this.character = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2196f3 });
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const bodyGeometry = new THREE.CapsuleGeometry(1, 2, 4, 8);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 2;
        body.castShadow = true;
        const headGeometry = new THREE.SphereGeometry(0.6, 16, 16);
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 4;
        head.castShadow = true;
        const armGeometry = new THREE.CapsuleGeometry(0.3, 1.4, 4, 8);
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-1.4, 2.4, 0);
        leftArm.rotation.z = 0.2;
        leftArm.castShadow = true;
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(1.4, 2.4, 0);
        rightArm.rotation.z = -0.2;
        rightArm.castShadow = true;
        const handGeometry = new THREE.SphereGeometry(0.6, 16, 16);
        const leftHand = new THREE.Mesh(handGeometry, bodyMaterial);
        leftHand.position.set(-1.4, 1.4, 0);
        leftHand.castShadow = true;
        const rightHand = new THREE.Mesh(handGeometry, bodyMaterial);
        rightHand.position.set(1.4, 1.4, 0);
        rightHand.castShadow = true;
        const legGeometry = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(-0.6, 0.8, 0);
        leftLeg.castShadow = true;
        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(0.6, 0.8, 0);
        rightLeg.castShadow = true;
      
        this.character.add(body);
        this.character.add(head);
        this.character.add(leftArm);
        this.character.leftArm = leftArm;
        this.character.add(rightArm);
        this.character.add(leftLeg);
        this.character.add(rightLeg);
        this.character.add(leftHand);
        this.character.add(rightHand);
        const startX = 0;
        const startZ = 0;
        const characterHeight = 2;
        this.character.position.set(startX, characterHeight, startZ);
        this.scene.add(this.character);
        const characterShape = new CANNON.Cylinder(1, 1, 4, 8);
        this.characterBody = new CANNON.Body({
            mass: 10,
            material: this.characterMaterial,
            fixedRotation: true,
            position: new CANNON.Vec3(startX, characterHeight, startZ)
        });
        this.characterBody.addShape(characterShape);
        this.characterBody.linearDamping = 0.9;
        this.characterBody.angularDamping = 0.9;
        this.characterBody.addEventListener('collide', (event) => {
            const contact = event.contact;
            const normalVelocity = contact.getImpactVelocityAlongNormal();
            if (normalVelocity < -5) {
                this.characterBody.velocity.scale(0.5, this.characterBody.velocity);
            }
        });
        this.physicsWorld.addBody(this.characterBody);
    }

    // Cleanup: removes event listeners and objects.
    cleanup() {
        // 1. Remove event listeners as you already do
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
    
        // 2. Remove lines, markers, ball, etc. (as you have now)
        this.removeThrowControls();
        if (this.trajectoryLine) this.scene.remove(this.trajectoryLine);
        if (this.landingMarker) this.scene.remove(this.landingMarker);
        if (this.secondaryTrajectoryLine) this.scene.remove(this.secondaryTrajectoryLine);
        this.removeFlightDataDisplay();
        this.isInUpdateLoop = false;
    
        // 3. Remove character / physics bodies
        if (this.character) {
            this.scene.remove(this.character);
            this.character = null;
        }
        if (this.characterBody) {
            this.physicsWorld.removeBody(this.characterBody);
            this.characterBody = null;
        }
        if (this.ball) {
            this.scene.remove(this.ball);
            this.ball = null;
        }
        if (this.ballBody) {
            this.physicsWorld.removeBody(this.ballBody);
            this.ballBody = null;
        }
    
        // 4. Remove planet-specific objects
        if (this.skybox) {
            this.scene.remove(this.skybox);
            this.skybox = null;
        }
        if (this.terrain) {
            this.scene.remove(this.terrain);
            this.terrain = null;
        }
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight = null;
        }
        if (this.sunLight) {
            this.scene.remove(this.sunLight);
            this.sunLight = null;
        }
        if (this.stars) {
            this.scene.remove(this.stars);
            this.stars = null;
        }
        
        // Optionally revert the fog if you changed it
        if (this.originalFog) {
            this.scene.fog = this.originalFog;
        } else {
            this.scene.fog = null;
        }
    
        // 5. Remove any UI boards, e.g. your planetNoticeBoard
        if (this.planetNoticeBoard) {
            document.body.removeChild(this.planetNoticeBoard);
            this.planetNoticeBoard = null;
        }
    }
    

    // Updates the landing marker position and flight range.
    updateLandingMarker(position) {
        this.landingMarker.position.copy(position);
        this.landingMarker.position.y = 0.01;
        this.landingMarker.visible = true;
        const distance = this.throwStartPosition.distanceTo(position);
        this.flightData.range = distance;
    }

    // Updates flight data based on elapsed time.
    updateFlightData() {
        const flightTime = (performance.now() - this.throwStartTime) / 1000;
        this.flightData.flightTime = flightTime;
        const velocity = this.flightData.initialVelocity;
        const angle = this.flightData.angle;
        const vx = velocity * Math.cos(angle);
        const vy = velocity * Math.sin(angle);
        const maxHeight = (vy * vy) / (2 * this.gravity);
        this.flightData.maxHeight = maxHeight;
        const range = (velocity * velocity * Math.sin(2 * angle)) / this.gravity;
        this.flightData.theoreticalRange = range;
    }

    // Displays flight data in the UI.
    displayFlightData() {
        if (!this.flightDataDisplay) {
            this.flightDataDisplay = document.createElement('div');
            this.flightDataDisplay.className = 'flight-data-display';
            this.flightDataDisplay.style.position = 'absolute';
            this.flightDataDisplay.style.top = '10px';
            this.flightDataDisplay.style.left = '10px'; // Changed from right to left
            this.flightDataDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            this.flightDataDisplay.style.color = 'white';
            this.flightDataDisplay.style.padding = '15px';
            this.flightDataDisplay.style.borderRadius = '10px';
            this.flightDataDisplay.style.fontFamily = 'Arial, sans-serif';
            this.flightDataDisplay.style.zIndex = '1000';
            this.flightDataDisplay.style.minWidth = '250px';
            document.body.appendChild(this.flightDataDisplay);
        }
        this.flightDataDisplay.innerHTML = `
            <h3 style="margin: 0 0 10px 0; text-align: center; color: #00ffff;">Projectile Motion Data</h3>
            <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Initial Velocity:</span>
                <span>${this.flightData.initialVelocity.toFixed(2)} m/s</span>
            </div>
            <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Launch Angle:</span>
                <span>${(this.flightData.angle * 180 / Math.PI).toFixed(2)}°</span>
            </div>
            <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Predicted Flight Time:</span>
                <span>${this.flightData.flightTime.toFixed(2)} s</span>
            </div>
            <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Maximum Height:</span>
                <span>${this.flightData.maxHeight.toFixed(2)} m</span>
            </div>
            <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Predicted Range:</span>
                <span>${this.flightData.theoreticalRange ? this.flightData.theoreticalRange.toFixed(2) : "0.00"} m</span>
            </div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #aaaaaa; text-align: center;">
                ${this.ballThrown ? "Projectile in flight" : this.isAiming ? "Aiming mode" : "Ready to aim"}
            </div>
        `;
    }
    
    // Removes the flight data UI.
    removeFlightDataDisplay() {
        if (this.flightDataDisplay) {
            document.body.removeChild(this.flightDataDisplay);
            this.flightDataDisplay = null;
        }
    }

    // Removes any throw control UI.
    removeThrowControls() {
        const existingControls = document.querySelector('.throw-control-container');
        if (existingControls) {
            document.body.removeChild(existingControls);
        }
    }

    // Toggles ball holding state.
    toggleHoldBall() {
        if (this.isThrown) {
            console.log("Cannot pick up ball - it's in flight");
            return;
        }
        this.isHoldingBall = !this.isHoldingBall;
        if (this.controls && this.controls.physicsPanel) {
            this.controls.physicsPanel.style.display = this.isHoldingBall ? 'block' : 'none';
        }
        console.log("Ball holding state toggled. isHoldingBall:", this.isHoldingBall);
    }

    // Stops aiming.
    stopAiming() {
        this.isAiming = false;
        if (this.trajectoryLine) {
            this.trajectoryLine.visible = false;
        }
        if (this.controls && this.controls.physicsPanel) {
            this.controls.physicsPanel.style.display = 'none';
        }
        console.log("Aiming stopped");
    }

    // Clears trajectory preview.
    clearTrajectoryPreview() {
        if (this.trajectoryLine) {
            this.trajectoryLine.visible = false;
            const geometry = this.trajectoryLine.geometry;
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
            geometry.attributes.position.needsUpdate = true;
        }
        if (this.landingMarker) {
            this.landingMarker.visible = false;
        }
    }

    // Updates the forward (green) trajectory preview while aiming.
    updateTrajectoryPreview() {
        if (!this.isHoldingBall) return;
        const startPos = new THREE.Vector3();
        if (this.character) {
            startPos.copy(this.character.position);
            startPos.y += 1.5;
        } else {
            startPos.set(0, 2, 0);
        }
        const direction = new THREE.Vector3();
        direction.copy(this.camera.getWorldDirection(new THREE.Vector3()));
        direction.y = 0;
        direction.normalize();
        this.throwStartPosition.copy(startPos);
        const vx = this.throwForce * Math.cos(this.throwAngle);
        const vy = this.throwForce * Math.sin(this.throwAngle);
        const points = [];
        const timeStep = 0.1;
        const maxTime = 5.0;
        let maxHeight = startPos.y;
        let landingPoint = null;
        for (let t = 0; t <= maxTime; t += timeStep) {
            const x = startPos.x + direction.x * vx * t;
            const z = startPos.z + direction.z * vx * t;
            const y = startPos.y + vy * t - (0.5 * 9.82 * t * t);
            maxHeight = Math.max(maxHeight, y);
            if (y <= 0 && t > 0) {
                if (!landingPoint) {
                    landingPoint = new THREE.Vector3(x, 0.01, z);
                    this.updateLandingMarker(landingPoint);
                    this.flightData.theoreticalRange = Math.sqrt(
                        Math.pow(x - startPos.x, 2) +
                        Math.pow(z - startPos.z, 2)
                    );
                    this.flightData.maxHeight = maxHeight - startPos.y;
                    this.flightData.theoreticalTime = t;
                }
                break;
            }
            points.push(new THREE.Vector3(x, y, z));
        }
        if (this.trajectoryLine) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.geometry = geometry;
            this.trajectoryLine.computeLineDistances();
            this.trajectoryLine.visible = true;
        }
        this.updatePhysicsCalculations();
    }

    // Updates physics calculations.
    updatePhysicsCalculations() {
        if (!this.isHoldingBall) return;
        const g = this.gravity
        const v0 = this.throwForce;
        const angle = this.throwAngle;
        const v0x = v0 * Math.cos(angle);
        const v0y = v0 * Math.sin(angle);
        const timeOfFlight = (2 * v0y) / g;
        const range = v0x * timeOfFlight;
        const maxHeight = (v0y * v0y) / (2 * g);
        const physicsElement = document.getElementById('physics-calculations');
        if (physicsElement) {
            physicsElement.innerHTML = `
                <div class="physics-value">Force: ${v0.toFixed(1)} m/s</div>
                <div class="physics-value">Angle: ${(angle * 180 / Math.PI).toFixed(1)}°</div>
                <div class="physics-value">Range (R): ${range.toFixed(2)} m</div>
                <div class="physics-formula">R = (v² × sin(2θ)) / g</div>
                <div class="physics-value">Time of Flight (T): ${timeOfFlight.toFixed(2)} s</div>
                <div class="physics-formula">T = (2 × v × sin(θ)) / g</div>
                <div class="physics-value">Max Height (H): ${maxHeight.toFixed(2)} m</div>
                <div class="physics-formula">H = (v² × sin²(θ)) / (2g)</div>
            `;
        }
        this.flightData.initialVelocity = v0;
        this.flightData.angle = angle;
        this.flightData.range = range;
        this.flightData.maxHeight = maxHeight;
        this.flightData.flightTime = timeOfFlight;
    }

    // Hides the physics calculations UI.

    // Resets the ball to the held state.
    resetBall() {
        this.isHoldingBall = true;
        this.ballThrown = false;
        this.ballBody.velocity.set(0, 0, 0);
        this.ballBody.angularVelocity.set(0, 0, 0);
        if (this.character) {
            this.attachBallToCharacter();
        } else {
            if (this.ball) this.ball.position.set(0, 2, 0);
            if (this.ballBody) this.ballBody.position.set(0, 2, 0);
        }
        this.updateTrajectoryPreview();
        this.updatePhysicsCalculations();
    }

    // Handles key down events (movement and pickup/drop via 'e')
    onKeyDown(event) {
        const key = event.key.toLowerCase();
        if (this.keyStates.hasOwnProperty(key)) {
            this.keyStates[key] = true;
            if (key === 'e') {
                console.log("E key pressed. isHoldingBall:", this.isHoldingBall);
                if (this.isHoldingBall) {
                    // Drop the ball: switch to dynamic so it falls.
                    this.isHoldingBall = false;
                    if (this.isAiming) {
                        this.stopAiming();
                    }
                    if (this.ballBody) {
                        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.character.quaternion);
                        this.ballBody.type = CANNON.Body.DYNAMIC;
                        this.ballBody.velocity.set(forward.x * 2, 0, forward.z * 2);
                    }
                    console.log("Ball dropped");
                } else {
                    console.log("Attempting to pick up ball");
                    this.pickupBall();
                }
            }
        }
    }

    // Handles key up events for movement
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        if (this.keyStates.hasOwnProperty(key)) {
            this.keyStates[key] = false;
        }
    }

    // Handles projectile motion key down events (adjust force/angle/throw)
    onProjectileKeyDown(event) {
        const key = event.key.toLowerCase();
        if (this.projectileKeyStates.hasOwnProperty(key)) {
            this.projectileKeyStates[key] = true;
            switch (key) {
                case 'arrowup':
                    this.throwAngle = Math.min(Math.PI / 2, this.throwAngle + 0.05);
                    break;
                case 'arrowdown':
                    this.throwAngle = Math.max(0.05, this.throwAngle - 0.05);
                    break;
                case 'w':
                    this.throwForce = Math.min(50, this.throwForce + 1);
                    break;
                case 's':
                    this.throwForce = Math.max(1, this.throwForce - 1);
                    break;
                case ' ':
                    if (this.isHoldingBall && !this.ballThrown) {
                        this.throwBall();
                    }
                    break;
            }
            if (this.isHoldingBall) {
                this.updateTrajectoryPreview();
                this.updatePhysicsCalculations();
            }
        }
    }
    
    // Handles projectile motion key up events
    onProjectileKeyUp(event) {
        const key = event.key.toLowerCase();
        if (this.projectileKeyStates.hasOwnProperty(key)) {
            this.projectileKeyStates[key] = false;
        }
    }
}
