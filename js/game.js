import { state } from './state.js';
import { scheduleNotes, playMelodyNote, initAudio, setInstrument, stopAllNotes } from './audio.js';
import { loadMIDI } from './midi.js';
import { createPianoKeyboard, setupControls, updateProgress, showEndScreen, formatSongTitle, setTotalTime } from './ui.js';
import { drawFallingNotes, drawHitZone, drawDebugInfo, drawHandSkeleton, resizeCanvas } from './render.js';
import { initCameraAndHands } from './input.js';
import { WHITE_KEY_WIDTH, BLACK_KEY_WIDTH } from './config.js';

const canvas = document.getElementById('notesCanvas');
const ctx = canvas.getContext('2d');

export async function init() {
    console.log('init: Started');
    const loadingText = document.querySelector('#loading p');
    if (loadingText) loadingText.textContent = "Starting...";

    try {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        if (loadingText) loadingText.textContent = "Loading MIDI...";
        console.log('init: Loading MIDI...');
        await loadMIDI(state.currentSong);
        await loadMIDI(state.currentSong);
        console.log('init: MIDI loaded');
        setTotalTime(state.duration);

        // Initialize audio with progress callback
        console.log('init: Loading audio...');
        await initAudio((loaded, total) => {
            const percent = Math.round((loaded / total) * 100);
            if (loadingText) loadingText.textContent = `Loading Piano... ${percent}% (${loaded}/${total})`;
        });
        console.log('init: Audio loaded');

        createPianoKeyboard();

        setupControls({
            togglePlayback,
            seekTo,
            onSongChange: async (song) => {
                if (state.isPlaying) pausePlayback();
                state.pianoKeys = [];
                document.getElementById('pianoKeyboard').innerHTML = '';
                await loadMIDI(song);
                createPianoKeyboard();
                state.currentTime = 0;
                state.playedMelodyIds.clear();
                state.touchedMelodyCount = 0;
                updateProgress();
                setTotalTime(state.duration);
                document.getElementById('songTitle').textContent = `🎹 ${formatSongTitle(song)}`;
            },
            onSpeedChange: async (speed) => {
                await loadMIDI(state.currentSong);
                state.currentTime = 0;
                state.playedMelodyIds.clear();
                state.touchedMelodyCount = 0;
                if (state.isPlaying) {
                    pausePlayback();
                    await startPlayback();
                }
                updateProgress();
                setTotalTime(state.duration);
            },
            onInstrumentChange: async (instrument) => {
                const wasPlaying = state.isPlaying;
                if (wasPlaying) pausePlayback();
                await setInstrument(instrument);
                if (wasPlaying) await startPlayback();
            }
        });

        // Initialize Camera
        loadingText.textContent = "Initializing Camera...";
        console.log('init: Initializing camera...');
        try {
            await initCameraAndHands();
            console.log('init: Camera initialized');
        } catch (cameraError) {
            console.warn("Camera initialization failed:", cameraError);
            alert("Camera failed to initialize. You can still play, but hand tracking won't work.\nError: " + cameraError.message);
        }

        console.log('init: Hiding loading screen');
        const loadingScreen = document.getElementById('loading');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            loadingScreen.style.display = 'none'; // Force hide
        }
        animate();
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('loading').innerHTML = `
            <div class="spinner"></div>
            <p>Error: ${error.message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; border-radius: 5px; border: none; background: #667eea; color: white; cursor: pointer;">Retry</button>
        `;
    }
}

export async function togglePlayback() {
    if (!state.isPlaying && !state.gatedPause) {
        await startPlayback();
    } else {
        pausePlayback();
    }
}

export async function startPlayback() {
    // Resume AudioContext if suspended
    if (state.audioContext && state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
    }

    document.querySelector('.controls').classList.add('hidden');
    const countdownEl = document.getElementById('countdown');
    countdownEl.classList.remove('hidden');

    let countdown = 3;
    countdownEl.textContent = countdown;

    const countdownInterval = setInterval(() => {
        countdown--;

        if (countdown > 0) {
            countdownEl.textContent = countdown;
        } else if (countdown === 0) {
            countdownEl.textContent = "GO!";
        } else {
            clearInterval(countdownInterval);
            countdownEl.classList.add('hidden');

            state.isPlaying = true;
            state.gatedPause = false;

            // Set start time for Web Audio API
            state.startTime = state.audioContext.currentTime - state.currentTime;

            document.querySelector('.play-icon').style.display = 'none';
            document.querySelector('.pause-icon').style.display = 'block';

            scheduleNotes();
        }
    }, 1000);
}

export function pausePlayback() {
    state.isPlaying = false;
    state.pauseTime = state.audioContext ? state.audioContext.currentTime : 0;

    // Stop all scheduled notes
    stopAllNotes();

    document.querySelector('.play-icon').style.display = 'block';
    document.querySelector('.pause-icon').style.display = 'none';
}

export function seekTo(time) {
    state.currentTime = Math.max(0, Math.min(time, state.duration));

    state.playedMelodyIds.clear();
    state.touchedMelodyCount = 0;
    state.melodyNotes.forEach(n => {
        if (n.time < state.currentTime - 0.1) {
            state.playedMelodyIds.add(n.id);
        }
    });

    if (state.isPlaying) {
        pausePlayback();
        setTimeout(() => startPlayback(), 50);
    }
    updateProgress();
}

function getTouchedNote() {
    if (state.allFingerPoints.length === 0 || state.pianoKeys.length === 0) return null;

    const hitZoneY = canvas.height * 0.6;
    const hitZoneTolerance = 50;
    const containerRect = canvas.getBoundingClientRect();

    const lookAhead = 3;
    const lookBehind = 0.5;
    const pixelsPerSecond = (canvas.height - 140) * 0.5;
    const pianoTopY = canvas.height - 140;

    for (let fingerPoint of state.allFingerPoints) {
        const px = fingerPoint.x;
        const py = fingerPoint.y;

        for (let note of state.melodyNotes) {
            if (state.playedMelodyIds.has(note.id)) continue;

            const timeDiff = note.time - state.currentTime;

            if (timeDiff > -lookBehind && timeDiff < lookAhead) {
                const keyData = state.pianoKeys.find(k => k.midi === note.midi);
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
    const simultaneousNotes = state.melodyNotes.filter(note =>
        !state.playedMelodyIds.has(note.id) &&
        Math.abs(note.time - touchedNote.time) <= epsilon
    );

    if (state.gatedPause) {
        simultaneousNotes.forEach(note => playMelodyNote(note));
        startPlayback();
    } else if (state.isPlaying) {
        simultaneousNotes.forEach(note => playMelodyNote(note));
    }
}

export function animate() {
    if (state.isPlaying && state.audioContext) {
        // Calculate current time from AudioContext
        state.currentTime = state.audioContext.currentTime - state.startTime;

        if (state.currentTime >= state.duration) {
            state.currentTime = state.duration;
            pausePlayback();
            showEndScreen();
            return;
        }
        updateProgress();

        state.melodyNotes.forEach(note => {
            if (!state.playedMelodyIds.has(note.id) && note.time < state.currentTime - 0.1) {
                state.playedMelodyIds.add(note.id);
            }
        });
    }

    if (state.isPlaying || state.gatedPause) {
        handleMelodyGate();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFallingNotes(getTouchedNote);
    drawHitZone();
    drawHandSkeleton();
    drawDebugInfo(getTouchedNote);

    state.animationFrameId = requestAnimationFrame(animate);
}
