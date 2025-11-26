// Piano Visualization - Yiruma Songs
// Global variables
let midi = null;
let synth = null;
let notes = [];
let melodyNotes = [];
let harmonyNotes = [];
let isPlaying = false;
let gatedPause = false;
let currentTime = 0;
let animationFrameId = null;
let duration = 0;
let currentSpeed = 1;
let currentPlaystyle = 'fingers';
let currentSong = 'Kiss The Rain.mid';

// Canvas and piano settings
const canvas = document.getElementById('notesCanvas');
const ctx = canvas.getContext('2d');
const pianoContainer = document.getElementById('pianoKeyboard');
const liveVideo = document.getElementById('liveVideo');

// Piano configuration
const WHITE_KEY_WIDTH = 30;
const BLACK_KEY_WIDTH = 20;
const NOTE_COLORS = [
    '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185',
    '#f97316', '#facc15', '#84cc16', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6'
];

const whiteKeyPattern = [0, 2, 4, 5, 7, 9, 11];
let pianoKeys = [];
let allFingerPoints = [];
let hands = null;
let allHandsLandmarks = [];
let playedMelodyIds = new Set();
let touchedMelodyCount = 0;
let finalScore = 0;
let master = null;
let compressor = null;
let limiter = null;

// Initialize
async function init() {
    try {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        await loadMIDI(currentSong);
        await initAudio();
        createPianoKeyboard();
        setupControls();
        await initCameraAndHands();

        document.getElementById('loading').classList.add('hidden');
        animate();
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('loading').innerHTML = `
            <div class="spinner"></div>
            <p>Error: ${error.message}</p>
        `;
    }
}

async function loadMIDI(filename) {
    const response = await fetch(filename);
    const arrayBuffer = await response.arrayBuffer();
    midi = new Midi(arrayBuffer);

    const TEMPO_MULTIPLIER = 1 / currentSpeed;

    notes = [];
    midi.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, idx) => {
            notes.push({
                id: `${trackIndex}:${idx}`,
                midi: note.midi,
                time: note.time * TEMPO_MULTIPLIER,
                duration: note.duration * TEMPO_MULTIPLIER,
                velocity: note.velocity,
                name: note.name,
                trackIndex: trackIndex
            });
        });
    });

    notes.sort((a, b) => a.time - b.time);

    const epsilon = 0.05;
    melodyNotes = [];
    harmonyNotes = [];
    let i = 0;
    while (i < notes.length) {
        const groupStart = notes[i].time;
        const group = [];
        let j = i;
        while (j < notes.length && Math.abs(notes[j].time - groupStart) <= epsilon) {
            group.push(notes[j]);
            j++;
        }
        const melody = group.reduce((acc, n) => (n.midi > acc.midi ? n : acc), group[0]);
        melodyNotes.push(melody);
        group.forEach(n => {
            if (n.id !== melody.id) harmonyNotes.push(n);
        });
        i = j;
    }
    duration = midi.duration * TEMPO_MULTIPLIER;
    document.querySelector('.total-time').textContent = formatTime(duration);
}

async function initCameraAndHands() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    liveVideo.srcObject = stream;
    await liveVideo.play();

    hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.8
    });
    hands.onResults(onHandsResults);

    const camera = new Camera(liveVideo, {
        onFrame: async () => { await hands.send({ image: liveVideo }); },
        width: 640,
        height: 480
    });
    camera.start();
}

function mapCoordinates(x, y) {
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

function onHandsResults(results) {
    allFingerPoints = [];
    allHandsLandmarks = [];

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach(landmarks => {
            if (!landmarks || landmarks.length < 21) return;

            allHandsLandmarks.push(landmarks);

            if (currentPlaystyle === 'fingers') {
                const fingertipIndices = [4, 8, 12, 16, 20];
                fingertipIndices.forEach(index => {
                    const tip = landmarks[index];
                    if (tip && tip.x !== undefined && tip.y !== undefined) {
                        const mapped = mapCoordinates(tip.x, tip.y);
                        allFingerPoints.push(mapped);
                    }
                });
            } else if (currentPlaystyle === 'palm') {
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

function createPianoKeyboard() {
    const keysContainer = document.createElement('div');
    keysContainer.className = 'piano-keys-container';

    const midiNotes = notes.map(n => n.midi);
    const minNote = Math.max(21, Math.min(...midiNotes) - 3);
    const maxNote = Math.min(108, Math.max(...midiNotes) + 3);

    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;
        const isWhite = whiteKeyPattern.includes(noteInOctave);

        if (isWhite) {
            const key = document.createElement('div');
            key.className = 'piano-key white';
            key.dataset.midi = midiNote;
            keysContainer.appendChild(key);
            pianoKeys.push({ element: key, midi: midiNote, isWhite: true });
        }
    }

    let whiteIndex = 0;
    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;
        const isWhite = whiteKeyPattern.includes(noteInOctave);

        if (isWhite) {
            whiteIndex++;
        } else {
            const key = document.createElement('div');
            key.className = 'piano-key black';
            key.dataset.midi = midiNote;
            const position = (whiteIndex - 1) * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH * 0.75;
            key.style.left = position + 'px';
            keysContainer.appendChild(key);
            pianoKeys.push({ element: key, midi: midiNote, isWhite: false });
        }
    }

    pianoContainer.appendChild(keysContainer);
}

function setupControls() {
    const playBtn = document.getElementById('playBtn');
    const progressBar = document.getElementById('progressBar');
    const songSelect = document.getElementById('songSelect');
    const speedSelect = document.getElementById('speedSelect');
    const playstyleSelect = document.getElementById('playstyleSelect');

    playBtn.addEventListener('click', togglePlayback);

    progressBar.addEventListener('input', (e) => {
        const seekTime = (e.target.value / 100) * duration;
        seekTo(seekTime);
    });

    songSelect.addEventListener('change', async (e) => {
        currentSong = e.target.value;

        try {
            const songName = formatSongTitle(currentSong);
            document.getElementById('songTitle').textContent = `🎹 ${songName}`;

            if (isPlaying) pausePlayback();

            pianoKeys = [];
            pianoContainer.innerHTML = '';

            await loadMIDI(currentSong);
            createPianoKeyboard();

            currentTime = 0;
            playedMelodyIds.clear();
            touchedMelodyCount = 0;
            updateProgress();
        } catch (error) {
            console.error('Error loading song:', error);
        }
    });

    speedSelect.addEventListener('change', async (e) => {
        currentSpeed = parseFloat(e.target.value);

        try {
            await loadMIDI(currentSong);

            currentTime = 0;
            playedMelodyIds.clear();
            touchedMelodyCount = 0;

            if (isPlaying) {
                pausePlayback();
                await startPlayback();
            }

            updateProgress();
        } catch (error) {
            console.error('Error changing speed:', error);
        }
    });

    playstyleSelect.addEventListener('change', (e) => {
        currentPlaystyle = e.target.value;
    });

    const instrumentSelect = document.getElementById('instrumentSelect');
    instrumentSelect.addEventListener('change', (e) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) pausePlayback();

        setInstrument(e.target.value);

        // Optional: Resume playback if it was playing, or let user resume manually
        // if (wasPlaying) startPlayback(); 
    });
}

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
            Tone.Transport.schedule((time) => {
                synth.triggerAttackRelease(
                    Tone.Frequency(note.midi, 'midi'),
                    note.duration,
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
    synth.triggerAttackRelease(Tone.Frequency(note.midi, 'midi'), note.duration, undefined, note.velocity);
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
    try { Tone.Transport.cancel(); } catch {}
    if (synth && !synth.disposed) {
        try { synth.dispose(); } catch {}
    }
    if (master && !master.disposed) { try { master.dispose(); } catch {} }
    if (compressor && !compressor.disposed) { try { compressor.dispose(); } catch {} }
    if (limiter && !limiter.disposed) { try { limiter.dispose(); } catch {} }

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
