import { state } from './state.js';

const liveVideo = document.getElementById('liveVideo');
const canvas = document.getElementById('notesCanvas');

export async function initCameraAndHands() {
    console.log('initCameraAndHands: Requesting user media...');
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    });
    console.log('initCameraAndHands: Stream obtained');

    liveVideo.srcObject = stream;
    console.log('initCameraAndHands: Playing video...');
    await liveVideo.play();
    console.log('initCameraAndHands: Video playing');

    console.log('initCameraAndHands: Initializing Hands...');
    state.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    state.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    state.hands.onResults(onHandsResults);
    console.log('initCameraAndHands: Hands initialized');

    console.log('initCameraAndHands: Starting Camera...');
    const camera = new Camera(liveVideo, {
        onFrame: async () => {
            await state.hands.send({ image: liveVideo });
        },
        width: 640,
        height: 480
    });

    await camera.start();
    console.log('initCameraAndHands: Camera started');
}

export function mapCoordinates(x, y) {
    const mirroredX = 1 - x;
    const container = canvas.parentElement;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const vw = liveVideo.videoWidth || 1280;
    const vh = liveVideo.videoHeight || 720;
    const videoRatio = vw / vh;
    const screenRatio = cw / ch;

    let scaledWidth, scaledHeight;
    if (screenRatio > videoRatio) {
        scaledWidth = cw;
        scaledHeight = cw / videoRatio;
    } else {
        scaledHeight = ch;
        scaledWidth = ch * videoRatio;
    }

    const offsetX = (cw - scaledWidth) / 2;
    const offsetY = (ch - scaledHeight) / 2;

    return {
        x: offsetX + mirroredX * scaledWidth,
        y: offsetY + y * scaledHeight
    };
}

// Smoothing factor (0.0 - 1.0). Lower = smoother but more delay. Higher = more responsive but jittery.
const SMOOTHING_FACTOR = 0.7;
let previousLandmarks = [];

function onHandsResults(results) {
    state.allFingerPoints = [];
    state.allHandsLandmarks = [];

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Initialize previousLandmarks if size mismatch (e.g. hand entered/left)
        if (previousLandmarks.length !== results.multiHandLandmarks.length) {
            previousLandmarks = results.multiHandLandmarks;
        }

        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            if (!landmarks || landmarks.length < 21) return;

            // Apply smoothing
            const smoothedLandmarks = landmarks.map((point, i) => {
                const prev = previousLandmarks[handIndex] ? previousLandmarks[handIndex][i] : point;
                return {
                    x: prev.x * (1 - SMOOTHING_FACTOR) + point.x * SMOOTHING_FACTOR,
                    y: prev.y * (1 - SMOOTHING_FACTOR) + point.y * SMOOTHING_FACTOR,
                    z: point.z // z is less critical for 2D overlay
                };
            });

            // Update previous landmarks
            if (!previousLandmarks[handIndex]) previousLandmarks[handIndex] = [];
            previousLandmarks[handIndex] = smoothedLandmarks;

            state.allHandsLandmarks.push(smoothedLandmarks);

            if (state.currentPlaystyle === 'fingers') {
                const fingertipIndices = [4, 8, 12, 16, 20];
                fingertipIndices.forEach(index => {
                    const tip = smoothedLandmarks[index];
                    if (tip && tip.x !== undefined && tip.y !== undefined) {
                        const mapped = mapCoordinates(tip.x, tip.y);
                        state.allFingerPoints.push(mapped);
                    }
                });
            } else if (state.currentPlaystyle === 'palm') {
                for (let i = 0; i < 21; i++) {
                    const point = smoothedLandmarks[i];
                    if (point && point.x !== undefined && point.y !== undefined) {
                        const mapped = mapCoordinates(point.x, point.y);
                        state.allFingerPoints.push(mapped);
                    }
                }
            } else if (state.currentPlaystyle === 'solid') {
                // Use all 21 landmarks
                for (let i = 0; i < 21; i++) {
                    const point = smoothedLandmarks[i];
                    if (point && point.x !== undefined && point.y !== undefined) {
                        const mapped = mapCoordinates(point.x, point.y);
                        state.allFingerPoints.push(mapped);
                    }
                }

                // Interpolate between connected landmarks to create a "solid" hand
                const connections = [
                    [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
                    [0, 5], [5, 6], [6, 7], [7, 8],  // Index
                    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
                    [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
                    [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
                    [5, 9], [9, 13], [13, 17]  // Palm connections
                ];

                connections.forEach(([a, b]) => {
                    const pointA = smoothedLandmarks[a];
                    const pointB = smoothedLandmarks[b];

                    if (pointA && pointB && pointA.x !== undefined && pointB.x !== undefined) {
                        // Interpolate 3 points between each connection
                        for (let t = 0.25; t <= 0.75; t += 0.25) {
                            const interpX = pointA.x * (1 - t) + pointB.x * t;
                            const interpY = pointA.y * (1 - t) + pointB.y * t;
                            const mapped = mapCoordinates(interpX, interpY);
                            state.allFingerPoints.push(mapped);
                        }
                    }
                });
            }
        });
    } else {
        previousLandmarks = [];
    }
}
