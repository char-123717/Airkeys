/*
 * ===================================================================
 * PIANO VISUALIZATION GAME
 * Interactive rhythm game with hand tracking and MIDI playback
 * ===================================================================
 */

// ==================== AUDIO & MIDI STATE ====================
let midi = null;                    // Parsed MIDI file object from Tone.js
let synth = null;                   // Synthesizer for audio playback
let notes = [];                     // All notes from MIDI (melody + harmony)
let melodyNotes = [];              // Melody notes (played by user with hands)
let harmonyNotes = [];             // Harmony notes (played automatically as background)

// ==================== PLAYBACK STATE ====================
let isPlaying = false;              // Status: is the song currently playing
let gatedPause = false;             // Pause waiting for user to touch note
let currentTime = 0;                // Current playback time (seconds)
let animationFrameId = null;        // ID for requestAnimationFrame
let duration = 0;                   // Total song duration (seconds)
let currentSpeed = 1;               // Playback speed (0.5x, 0.75x, 1x)
let currentPlaystyle = 'fingers';   // Mode: 'fingers' (5 fingertips) or 'palm' (21 landmarks)
let currentSong = 'Kiss The Rain.mid'; // Currently loaded song

// ==================== CANVAS & UI ELEMENTS ====================
const canvas = document.getElementById('notesCanvas');        // Canvas for drawing falling notes
const ctx = canvas.getContext('2d');                         // 2D context for rendering
const pianoContainer = document.getElementById('pianoKeyboard'); // Container for piano keys
const liveVideo = document.getElementById('liveVideo');      // Video element for camera feed

// ==================== PIANO CONFIGURATION ====================
const WHITE_KEY_WIDTH = 30;         // White key width (pixels)
const BLACK_KEY_WIDTH = 20;         // Black key width (pixels)

// Color palette for falling notes (cycles through these colors)
const NOTE_COLORS = [
    '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185',
    '#f97316', '#facc15', '#84cc16', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6'
];

const whiteKeyPattern = [0, 2, 4, 5, 7, 9, 11]; // White note pattern in octave (C D E F G A B)
let pianoKeys = [];                // Array containing all piano key DOM elements

// ==================== HAND TRACKING STATE ====================
let allFingerPoints = [];          // Coordinates of all detected finger/hand points
let hands = null;                  // MediaPipe Hands instance
let allHandsLandmarks = [];        // Raw landmark data from MediaPipe (21 points per hand)

// ==================== GAME SCORING ====================
let playedMelodyIds = new Set();   // Set of melody note IDs that have been played
let touchedMelodyCount = 0;        // Number of melody notes successfully touched by user
let finalScore = 0;                // Final game score (percentage)

// ==================== AUDIO EFFECTS CHAIN ====================
let master = null;                 // Master volume control node
let compressor = null;             // Dynamic range compressor
let limiter = null;                // Peak limiter to prevent clipping

/*
 * ===================================================================
 * INITIALIZATION FUNCTIONS
 * ===================================================================
 */

/**
 * Main initialization function - Entry point of the application
 * 
 * This is called on window load and sets up the entire application:
 * 1. Canvas rendering setup
 * 2. MIDI file loading and parsing
 * 3. Audio synthesis initialization
 * 4. Piano keyboard DOM generation
 * 5. UI control event listeners
 * 6. Camera and hand tracking initialization
 * 7. Start animation loop
 * 
 * @async
 * @returns {Promise<void>}
 * @throws Will display error message if initialization fails
 */
async function init() {
    try {
        // Set up canvas dimensions to match container
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Load and parse MIDI file
        await loadMIDI(currentSong);

        // Initialize Tone.js synthesizer
        await initAudio();

        // Create visual piano keys from MIDI note range
        createPianoKeyboard();

        // Attach event listeners to UI controls
        setupControls();

        // Start camera and MediaPipe hand tracking
        await initCameraAndHands();

        // Hide loading screen and start game
        document.getElementById('loading').classList.add('hidden');
        animate();
    } catch (error) {
        // Display user-friendly error message
        console.error('Initialization error:', error);
        document.getElementById('loading').innerHTML = `
            <div class="spinner"></div>
            <p>Error: ${error.message}</p>
        `;
    }
}

/**
 * Load and parse MIDI file, separate melody and harmony notes
 * 
 * Process:
 * 1. Fetch MIDI file from server
 * 2. Parse using Tone.js Midi library
 * 3. Extract all notes from all tracks
 * 4. Apply tempo multiplier (speed setting)
 * 5. Transpose specific songs (e.g., Jumping Machine)
 * 6. Separate melody notes (highest) from harmony (background)
 * 
 * Melody/Harmony Separation Algorithm:
 * - Group notes played within 50ms (epsilon) of each other
 * - Highest note in each group = melody (user plays)
 * - Rest = harmony (automatically played)
 * 
 * @async
 * @param {string} filename - MIDI filename (e.g., "Kiss The Rain.mid")
 * @returns {Promise<void>}
 * @modifies {notes, melodyNotes, harmonyNotes, duration} - Updates global arrays
 */
async function loadMIDI(filename) {
    // Fetch MIDI file from server
    const response = await fetch(filename);
    const arrayBuffer = await response.arrayBuffer();
    midi = new Midi(arrayBuffer);

    // Adjust tempo based on speed setting (0.5x, 0.75x, 1x)
    const TEMPO_MULTIPLIER = 1 / currentSpeed;

    // Special transpose for specific songs
    const isJumpingMachine = filename.toLowerCase().includes('jumping machine');

    // Extract all notes from all MIDI tracks
    notes = [];
    midi.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, idx) => {
            notes.push({
                id: `${trackIndex}:${idx}`,          // Unique identifier
                midi: note.midi + (isJumpingMachine ? -6 : 0), // Transpose if needed (-6 = half octave down)
                time: note.time * TEMPO_MULTIPLIER,   // Start time adjusted for speed
                duration: note.duration * TEMPO_MULTIPLIER, // Duration adjusted for speed
                velocity: note.velocity,              // Intensity (0-1)
                name: note.name,                      // Note name (e.g., "C4")
                trackIndex: trackIndex                // Which MIDI track
            });
        });
    });

    // Sort chronologically for sequential playback
    notes.sort((a, b) => a.time - b.time);

    // ===== MELODY/HARMONY SEPARATION =====
    const epsilon = 0.05; // 50ms tolerance for "simultaneous" notes
    melodyNotes = [];
    harmonyNotes = [];

    let i = 0;
    while (i < notes.length) {
        const groupStart = notes[i].time;
        const group = [];
        let j = i;

        // Group notes with similar start times (within epsilon)
        while (j < notes.length && Math.abs(notes[j].time - groupStart) <= epsilon) {
            group.push(notes[j]);
            j++;
        }

        // Highest note in group = melody (user must play this)
        const melody = group.reduce((acc, n) => (n.midi > acc.midi ? n : acc), group[0]);
        melodyNotes.push(melody);

        // All other notes in group = harmony (played automatically)
        group.forEach(n => {
            if (n.id !== melody.id) harmonyNotes.push(n);
        });

        i = j;
    }

    // Update UI with total song duration
    duration = midi.duration * TEMPO_MULTIPLIER;
    document.querySelector('.total-time').textContent = formatTime(duration);
}

/**
 * Initialize camera and MediaPipe hand tracking
 * 
 * Setup process:
 * 1. Request camera access from user
 * 2. Initialize MediaPipe Hands ML model
 * 3. Configure tracking parameters (2 hands, balanced performance)
 * 4. Start camera feed and begin tracking
 * 
 * MediaPipe Settings:
 * - maxNumHands: 2 (detect both hands)
 * - modelComplexity: 0 (lite model for better performance)
 * - minDetectionConfidence: 0.5 (balanced)
 * - minTrackingConfidence: 0.8 (smooth tracking)
 * 
 * @async
 * @returns {Promise<void>}
 * @throws Will fail if camera permission denied or ML model load fails
 */
async function initCameraAndHands() {
    // Request camera access (will prompt user for permission)
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, // Front camera
        audio: false
    });
    liveVideo.srcObject = stream;
    await liveVideo.play();

    // Initialize MediaPipe Hands model
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    // Configure hand tracking parameters
    hands.setOptions({
        maxNumHands: 2,              // Track both hands
        modelComplexity: 0,          // Lite model (0=lite, 1=full)
        minDetectionConfidence: 0.5, // Initial detection threshold
        minTrackingConfidence: 0.8   // Frame-to-frame tracking threshold
    });

    // Set callback for hand detection results
    hands.onResults(onHandsResults);

    // Start camera feed and hand tracking loop
    const camera = new Camera(liveVideo, {
        onFrame: async () => {
            await hands.send({ image: liveVideo });
        },
        width: 640,
        height: 480
    });
    camera.start();
}

/*
 * ===================================================================
 * HAND TRACKING & COORDINATE MAPPING
 * ===================================================================
 */

/**
 * Map normalized MediaPipe coordinates (0-1) to screen pixel coordinates
 * 
 * This function performs several transformations:
 * 1. Mirrors X coordinate (for natural interaction - camera is mirrored)
 * 2. Scales coordinates from video resolution to screen resolution
 * 3. Accounts for aspect ratio differences (letterboxing/pillarboxing)
 * 4. Centers the video feed in the container
 * 
 * MediaPipe returns normalized coords (0-1), we need actual pixel positions
 * on the canvas to detect collisions with falling notes.
 * 
 * @param {number} x - Normalized x coordinate from MediaPipe (0-1)
 * @param {number} y - Normalized y coordinate from MediaPipe (0-1)
 * @returns {{x: number, y: number}} - Screen pixel coordinates
 */
function mapCoordinates(x, y) {
    // Mirror X axis (because camera feed is mirrored for natural interaction)
    const mirroredX = 1 - x;

    // Get container dimensions
    const container = canvas.parentElement;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Get video dimensions (with fallback)
    const vw = liveVideo.videoWidth || 1280;
    const vh = liveVideo.videoHeight || 720;

    // Calculate aspect ratios
    const videoRatio = vw / vh;
    const screenRatio = cw / ch;

    // Scale video to fit screen while maintaining aspect ratio
    let scaledWidth, scaledHeight;
    if (screenRatio > videoRatio) {
        // Screen is wider - fit to height
        scaledWidth = cw;
        scaledHeight = cw / videoRatio;
    } else {
        // Screen is taller - fit to width
        scaledHeight = ch;
        scaledWidth = ch * videoRatio;
    }

    // Calculate centering offsets (for letterboxing/pillarboxing)
    const offsetX = (cw - scaledWidth) / 2;
    const offsetY = (ch - scaledHeight) / 2;

    // Transform normalized coords to actual pixel positions
    return {
        x: offsetX + mirroredX * scaledWidth,
        y: offsetY + y * scaledHeight
    };
}

/**
 * Process MediaPipe hand tracking results
 * 
 * Called every frame by MediaPipe when hands are detected.
 * Extracts landmark positions and converts to screen coordinates.
 * 
 * MediaPipe Hand Landmarks (21 points per hand):
 * - 0: Wrist
 * - 1-4: Thumb (1=base, 4=tip)
 * - 5-8: Index finger (5=base, 8=tip)
 * - 9-12: Middle finger (9=base, 12=tip)
 * - 13-16: Ring finger (13=base, 16=tip)
 * - 17-20: Pinky (17=base, 20=tip)
 * 
 * Playstyles:
 * - "fingers": Use only 5 fingertips [4, 8, 12, 16, 20] for precision
 * - "palm": Use all 21 landmarks for easier, more forgiving gameplay
 * 
 * @param {Object} results - MediaPipe Hands detection results
 * @param {Array<Array<Object>>} results.multiHandLandmarks - Array of hand landmarks
 * @modifies {allFingerPoints, allHandsLandmarks} - Updates global arrays with new data
 */
function onHandsResults(results) {
    // Clear previous frame's data
    allFingerPoints = [];
    allHandsLandmarks = [];

    // Process each detected hand
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach(landmarks => {
            // Validate landmarks (must have all 21 points)
            if (!landmarks || landmarks.length < 21) return;

            // Store raw landmarks for visualization
            allHandsLandmarks.push(landmarks);

            if (currentPlaystyle === 'fingers') {
                // FINGERS MODE: Only use 5 fingertips for precise collision detection
                const fingertipIndices = [
                    4,  // Thumb tip
                    8,  // Index finger tip
                    12, // Middle finger tip
                    16, // Ring finger tip
                    20  // Pinky tip
                ];

                fingertipIndices.forEach(index => {
                    const tip = landmarks[index];
                    if (tip && tip.x !== undefined && tip.y !== undefined) {
                        // Convert normalized coords to screen pixel coords
                        const mapped = mapCoordinates(tip.x, tip.y);
                        allFingerPoints.push(mapped);
                    }
                });
            } else if (currentPlaystyle === 'palm') {
                // PALM MODE: Use all 21 hand landmarks for easier gameplay
                for (let i = 0; i < 21; i++) {
                    const point = landmarks[i];
                    if (point && point.x !== undefined && point.y !== undefined) {
                        const mapped = mapCoordinates(point.x, point.y);
                        allFingerPoints.push(mapped);
                    }
                }
            }
        });
    }
}

/*
 * ===================================================================
 * PIANO KEYBOARD & UI SETUP
 * ===================================================================
 */

/**
 * Dynamically generate piano keyboard DOM elements based on MIDI note range
 * 
 * Creates visual piano keys matching the song's note range:
 * 1. Calculates min/max MIDI notes from song (adds 3-note buffer)
 * 2. Creates white keys first (background layer)
 * 3. Creates black keys positioned relative to white keys
 * 4. Stores key references for collision detection
 * 
 * MIDI Note Range:
 * - 21 (A0) to 108 (C8) are valid piano notes
 * - Each octave has 12 semitones (7 white, 5 black)
 * - White keys: C, D, E, F, G, A, B (pattern: [0,2,4,5,7,9,11])
 * - Black keys: C#, D#, F#, G#, A#
 * 
 * @modifies {pianoKeys} - Populates global pianoKeys array
 * @modifies {pianoContainer} - Appends keyboard to DOM
 */
function createPianoKeyboard() {
    const keysContainer = document.createElement('div');
    keysContainer.className = 'piano-keys-container';

    // Calculate note range from MIDI file (with 3-note buffer on each side)
    const midiNotes = notes.map(n => n.midi);
    const minNote = Math.max(21, Math.min(...midiNotes) - 3);  // Min: A0 (MIDI 21)
    const maxNote = Math.min(108, Math.max(...midiNotes) + 3); // Max: C8 (MIDI 108)

    // PASS 1: Create all WHITE keys first (they form the background)
    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;  // 0-11 within octave
        const isWhite = whiteKeyPattern.includes(noteInOctave);

        if (isWhite) {
            const key = document.createElement('div');
            key.className = 'piano-key white';
            key.dataset.midi = midiNote;  // Store MIDI number for collision detection
            keysContainer.appendChild(key);
            pianoKeys.push({ element: key, midi: midiNote, isWhite: true });
        }
    }

    // PASS 2: Create BLACK keys positioned relative to white keys
    let whiteIndex = 0;
    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;
        const isWhite = whiteKeyPattern.includes(noteInOctave);

        if (isWhite) {
            whiteIndex++;  // Count white keys for positioning
        } else {
            // Create black key positioned between white keys
            const key = document.createElement('div');
            key.className = 'piano-key black';
            key.dataset.midi = midiNote;

            // Position black key 75% across the white key to its left
            const position = (whiteIndex - 1) * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH * 0.75;
            key.style.left = position + 'px';

            keysContainer.appendChild(key);
            pianoKeys.push({ element: key, midi: midiNote, isWhite: false });
        }
    }

    // Add keyboard to DOM
    pianoContainer.appendChild(keysContainer);
}

/**
 * Setup all UI control event listeners
 * 
 * Attaches handlers for:
 * - Play/Pause button
 * - Progress bar scrubbing
 * - Song selection (reloads MIDI and rebuilds piano)
 * - Speed multiplier (0.5x, 0.75x, 1x)
 * - Playstyle toggle (fingers vs palm)
 * - Instrument change (piano, violin, guitar, sax)
 * 
 * @modifies {DOM} - Attaches event listeners to UI elements
 */
function setupControls() {
    // Get references to all UI controls
    const playBtn = document.getElementById('playBtn');
    const progressBar = document.getElementById('progressBar');
    const songSelect = document.getElementById('songSelect');
    const speedSelect = document.getElementById('speedSelect');
    const playstyleSelect = document.getElementById('playstyleSelect');

    // Play/Pause button toggle
    playBtn.addEventListener('click', togglePlayback);

    // Progress bar seeking (user drags to new position)
    progressBar.addEventListener('input', (e) => {
        const seekTime = (e.target.value / 100) * duration;
        seekTo(seekTime);
    });

    // Song selection change - fully reload song
    songSelect.addEventListener('change', async (e) => {
        currentSong = e.target.value;

        try {
            // Update song title in header
            const songName = formatSongTitle(currentSong);
            document.getElementById('songTitle').textContent = `🎹 ${songName}`;

            // Stop playback if playing
            if (isPlaying) pausePlayback();

            // Clear old piano keyboard
            pianoKeys = [];
            pianoContainer.innerHTML = '';

            // Load new MIDI file and rebuild piano
            await loadMIDI(currentSong);
            createPianoKeyboard();

            // Reset game state
            currentTime = 0;
            playedMelodyIds.clear();
            touchedMelodyCount = 0;
            updateProgress();
        } catch (error) {
            console.error('Error loading song:', error);
        }
    });

    // Speed multiplier change - reload MIDI with new tempo
    speedSelect.addEventListener('change', async (e) => {
        currentSpeed = parseFloat(e.target.value);

        try {
            // Reload MIDI with new tempo multiplier
            await loadMIDI(currentSong);

            // Reset playback position
            currentTime = 0;
            playedMelodyIds.clear();
            touchedMelodyCount = 0;

            // Restart playback if was playing
            if (isPlaying) {
                pausePlayback();
                await startPlayback();
            }

            updateProgress();
        } catch (error) {
            console.error('Error changing speed:', error);
        }
    });

    // Playstyle toggle - immediate effect, no reload needed
    playstyleSelect.addEventListener('change', (e) => {
        currentPlaystyle = e.target.value;  // 'fingers' or 'palm'
    });

    // Instrument change - swap synthesizer
    const instrumentSelect = document.getElementById('instrumentSelect');
    instrumentSelect.addEventListener('change', (e) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) pausePlayback();  // Stop to avoid audio conflicts

        setInstrument(e.target.value);  // Change Tone.js synthesizer

        // Optionally auto-resume (currently disabled)
        // if (wasPlaying) startPlayback(); 
    });
}

/*
 * ===================================================================
 * PLAYBACK CONTROLS
 * ===================================================================
 */

/**
 * Toggle between play and pause states
 * 
 * @async
 * @returns {Promise<void>}
 */
async function togglePlayback() {
    if (!isPlaying && !gatedPause) {
        await startPlayback();
    } else {
        pausePlayback();
    }
}

async function startPlayback() {
    await Tone.start();

    document.querySelector('.controls').classList.add('hidden');

    let countdown = 3;
    const countdownInterval = setInterval(() => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 120px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fillText(countdown, canvas.width / 2, canvas.height / 2);

        ctx.restore();

        countdown--;

        if (countdown < 0) {
            clearInterval(countdownInterval);

            isPlaying = true;
            gatedPause = false;
            Tone.Transport.seconds = currentTime;

            document.querySelector('.play-icon').style.display = 'none';
            document.querySelector('.pause-icon').style.display = 'block';

            scheduleNotes();
        }
    }, 1000);
}

function pausePlayback() {
    isPlaying = false;
    currentTime = Tone.Transport.seconds;
    Tone.Transport.stop();
    Tone.Transport.cancel();

    document.querySelector('.play-icon').style.display = 'block';
    document.querySelector('.pause-icon').style.display = 'none';
}

function seekTo(time) {
    currentTime = Math.max(0, Math.min(time, duration));
    Tone.Transport.seconds = currentTime;

    playedMelodyIds.clear();
    touchedMelodyCount = 0;
    melodyNotes.forEach(n => {
        if (n.time < currentTime - 0.1) {
            playedMelodyIds.add(n.id);
        }
    });

    if (isPlaying) {
        pausePlayback();
        setTimeout(() => startPlayback(), 50);
    }
    updateProgress();
}

function scheduleNotes() {
    Tone.Transport.cancel();
    harmonyNotes.forEach(note => {
        if (note.time >= currentTime) {
            const safeDuration = Math.max(0.1, note.duration); // Ensure duration is at least 0.1 seconds
            Tone.Transport.schedule((time) => {
                synth.triggerAttackRelease(
                    Tone.Frequency(note.midi, 'midi'),
                    safeDuration,
                    time,
                    note.velocity
                );
            }, note.time);
        }
    });
    Tone.Transport.start();
}

function animate() {
    if (isPlaying) {
        currentTime = Tone.Transport.seconds;
        if (currentTime >= duration) {
            currentTime = duration;
            pausePlayback();
            showEndScreen();
            return;
        }
        updateProgress();

        melodyNotes.forEach(note => {
            if (!playedMelodyIds.has(note.id) && note.time < currentTime - 0.1) {
                playedMelodyIds.add(note.id);
            }
        });
    }

    if (isPlaying || gatedPause) {
        handleMelodyGate();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFallingNotes();
    drawHitZone();
    drawHandSkeleton();
    drawDebugInfo();

    animationFrameId = requestAnimationFrame(animate);
}

function getTouchedNote() {
    if (allFingerPoints.length === 0 || pianoKeys.length === 0) return null;

    const hitZoneY = canvas.height * 0.6;
    const hitZoneTolerance = 50;
    const containerRect = canvas.getBoundingClientRect();

    const lookAhead = 3;
    const lookBehind = 0.5;
    const pixelsPerSecond = (canvas.height - 140) * 0.5;
    const pianoTopY = canvas.height - 140;

    for (let fingerPoint of allFingerPoints) {
        const px = fingerPoint.x;
        const py = fingerPoint.y;

        for (let note of melodyNotes) {
            if (playedMelodyIds.has(note.id)) continue;

            const timeDiff = note.time - currentTime;

            if (timeDiff > -lookBehind && timeDiff < lookAhead) {
                const keyData = pianoKeys.find(k => k.midi === note.midi);
                if (!keyData) continue;

                const keyRect = keyData.element.getBoundingClientRect();
                const keyX = keyRect.left - containerRect.left + keyRect.width / 2;
                const noteY = pianoTopY - (timeDiff * pixelsPerSecond);
                const noteWidth = keyData.isWhite ? WHITE_KEY_WIDTH - 4 : BLACK_KEY_WIDTH - 2;
                const noteHeight = Math.max(10, note.duration * pixelsPerSecond);

                const noteBottom = noteY;
                const noteTop = noteY - noteHeight;

                if (noteBottom >= hitZoneY - hitZoneTolerance && noteTop <= hitZoneY + hitZoneTolerance) {
                    const noteLeft = keyX - noteWidth / 2;
                    const noteRight = keyX + noteWidth / 2;

                    if (px >= noteLeft && px <= noteRight && py >= noteTop && py <= noteBottom) {
                        return note;
                    }
                }
            }
        }
    }
    return null;
}

function handleMelodyGate() {
    const touchedNote = getTouchedNote();

    if (!touchedNote) return;

    const epsilon = 0.05;
    const simultaneousNotes = melodyNotes.filter(note =>
        !playedMelodyIds.has(note.id) &&
        Math.abs(note.time - touchedNote.time) <= epsilon
    );

    if (gatedPause) {
        simultaneousNotes.forEach(note => playMelodyNote(note));
        startPlayback();
    } else if (isPlaying) {
        simultaneousNotes.forEach(note => playMelodyNote(note));
    }
}

function playMelodyNote(note) {
    const safeDuration = Math.max(0.1, note.duration); // Ensure duration is at least 0.1 seconds
    synth.triggerAttackRelease(Tone.Frequency(note.midi, 'midi'), safeDuration, undefined, note.velocity);
    playedMelodyIds.add(note.id);
    touchedMelodyCount++;
}

function drawFallingNotes() {
    if (pianoKeys.length === 0) return;

    const lookAhead = 3;
    const lookBehind = 0.5;
    const pianoTopY = canvas.height - 140;
    const pixelsPerSecond = (canvas.height - 140) * 0.5;
    const hitZoneY = canvas.height * 0.6;
    const hitZoneTolerance = 50;

    ctx.save();
    ctx.globalAlpha = 1;

    notes.forEach((note) => {
        const timeDiff = note.time - currentTime;

        if (timeDiff > -lookBehind && timeDiff < lookAhead) {
            const keyData = pianoKeys.find(k => k.midi === note.midi);
            if (!keyData) return;

            const keyRect = keyData.element.getBoundingClientRect();
            const containerRect = canvas.getBoundingClientRect();
            const keyX = keyRect.left - containerRect.left + keyRect.width / 2;
            const noteY = pianoTopY - (timeDiff * pixelsPerSecond);
            const noteWidth = keyData.isWhite ? WHITE_KEY_WIDTH - 4 : BLACK_KEY_WIDTH - 2;
            const noteHeight = Math.max(10, note.duration * pixelsPerSecond);

            const colorIndex = note.midi % NOTE_COLORS.length;
            const isMelody = melodyNotes.some(m => m.id === note.id);
            const isPlayed = playedMelodyIds.has(note.id);

            ctx.fillStyle = NOTE_COLORS[colorIndex];

            if (isMelody) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = NOTE_COLORS[colorIndex];
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(keyX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight);
            ctx.shadowBlur = 0;

            if (isMelody && !isPlayed) {
                const noteBottom = noteY;
                const noteTop = noteY - noteHeight;

                if (noteBottom >= hitZoneY - hitZoneTolerance && noteTop <= hitZoneY + hitZoneTolerance) {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;

                    const pulseIntensity = 0.5 + Math.sin(Date.now() / 200) * 0.5;
                    ctx.shadowBlur = 15 + pulseIntensity * 15;
                    ctx.shadowColor = '#ffffff';

                    ctx.strokeRect(keyX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight);
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 0.5;
                }
            }
        }
    });

    ctx.restore();
}

function drawHitZone() {
    const hitZoneY = canvas.height * 0.6;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(canvas.width, hitZoneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 100, 0.8)';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('← Touch notes here →', canvas.width / 2, hitZoneY - 10);
    ctx.restore();
}

function drawDebugInfo() {
    if (allFingerPoints.length === 0) return;

    ctx.save();
    const touchedNote = getTouchedNote();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';

    let debugY = 100;
    ctx.fillText(`Song: ${formatSongTitle(currentSong)}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Mode: ${currentPlaystyle}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Hands: ${allHandsLandmarks.length}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Points: ${allFingerPoints.length}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Speed: ${currentSpeed}x`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Touching: ${touchedNote ? touchedNote.midi : 'None'}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Status: ${gatedPause ? 'PAUSED' : (isPlaying ? 'PLAYING' : 'STOPPED')}`, 10, debugY);

    ctx.restore();
}

function drawHandSkeleton() {
    if (allHandsLandmarks.length === 0) return;

    const containerRect = canvas.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = containerRect.left - canvasRect.left;
    const offsetY = containerRect.top - canvasRect.top;

    const connectors = [
        [0, 5], [0, 9], [0, 13], [0, 17],
        [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#10b981';

    allHandsLandmarks.forEach((landmarks) => {
        const pts = landmarks.map(p => {
            const q = mapCoordinates(p.x, p.y);
            return { x: q.x - offsetX, y: q.y - offsetY };
        });

        connectors.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.stroke();
        });

        ctx.fillStyle = '#22d3ee';
        for (let i = 0; i < pts.length; i++) {
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';

        if (currentPlaystyle === 'fingers') {
            const fingertipIndices = [4, 8, 12, 16, 20];
            fingertipIndices.forEach(index => {
                ctx.beginPath();
                ctx.arc(pts[index].x, pts[index].y, 5, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (currentPlaystyle === 'palm') {
            for (let i = 0; i < 21; i++) {
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    ctx.restore();
}

function showEndScreen() {
    finalScore = melodyNotes.length > 0 ? (touchedMelodyCount / melodyNotes.length) * 100 : 0;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎵 Song Complete! 🎵', canvas.width / 2, canvas.height / 2 - 120);

    ctx.font = 'bold 72px Inter';
    ctx.fillStyle = finalScore >= 90 ? '#22c55e' : finalScore >= 70 ? '#facc15' : finalScore >= 50 ? '#f97316' : '#ef4444';
    ctx.shadowBlur = 30;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillText(`${finalScore.toFixed(1)}%`, canvas.width / 2, canvas.height / 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Inter';
    ctx.fillText(`${touchedMelodyCount} / ${melodyNotes.length} notes hit`, canvas.width / 2, canvas.height / 2 + 80);

    let rating = '';
    if (finalScore >= 95) rating = 'Perfect! 🌟';
    else if (finalScore >= 90) rating = 'Excellent! 🎉';
    else if (finalScore >= 80) rating = 'Great! 👏';
    else if (finalScore >= 70) rating = 'Good! 👍';
    else if (finalScore >= 50) rating = 'Nice Try! 💪';
    else rating = 'Keep Practicing! 🎹';

    ctx.font = '32px Inter';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(rating, canvas.width / 2, canvas.height / 2 + 130);

    ctx.restore();
}

function updateProgress() {
    const progress = (currentTime / duration) * 100;
    document.getElementById('progressBar').value = progress;
    document.querySelector('.current-time').textContent = formatTime(currentTime);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function formatSongTitle(filename) {
    return filename.replace('.mid', '')
        .replace('Yiruma - ', '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

window.addEventListener('load', init);
async function initAudio() {
    const select = document.getElementById('instrumentSelect');
    const initial = select && select.value ? select.value : 'piano';
    setInstrument(initial);
}

function setInstrument(name) {
    try { Tone.Transport.cancel(); } catch { }
    if (synth && !synth.disposed) {
        try { synth.dispose(); } catch { }
    }
    if (master && !master.disposed) { try { master.dispose(); } catch { } }
    if (compressor && !compressor.disposed) { try { compressor.dispose(); } catch { } }
    if (limiter && !limiter.disposed) { try { limiter.dispose(); } catch { } }

    const voices = {
        piano: {
            Voice: Tone.Synth,
            opts: {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
            }
        },
        violin: {
            Voice: Tone.AMSynth,
            opts: {
                harmonicity: 1.01,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 1.2 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 1.2 }
            }
        },
        guitar: {
            Voice: Tone.FMSynth,
            opts: {
                modulationIndex: 8,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.9 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.9 }
            }
        },
        sax: {
            Voice: Tone.FMSynth,
            opts: {
                modulationIndex: 10,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.5 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 1.2 }
            }
        }
    };

    const v = voices[name] || voices.piano;
    try {
        synth = new Tone.PolySynth(v.Voice, v.opts);
    } catch (err) {
        synth = new Tone.PolySynth(Tone.Synth, voices.piano.opts);
    }

    limiter = new Tone.Limiter(-1).toDestination();
    compressor = new Tone.Compressor(-12, 3).connect(limiter);
    master = new Tone.Volume(0).connect(compressor);
    synth.connect(master);
    synth.volume.value = -2;
}
