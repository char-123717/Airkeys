import { state } from './state.js';
import { WHITE_KEY_WIDTH, BLACK_KEY_WIDTH, WHITE_KEY_PATTERN } from './config.js';

const pianoContainer = document.getElementById('pianoKeyboard');
const canvas = document.getElementById('notesCanvas');
const ctx = canvas.getContext('2d');

export function createPianoKeyboard() {
    pianoContainer.innerHTML = '';
    state.pianoKeys = [];

    const keysContainer = document.createElement('div');
    keysContainer.className = 'piano-keys-container';

    const midiNotes = state.notes.map(n => n.midi);
    const minNote = Math.max(21, Math.min(...midiNotes) - 3);
    const maxNote = Math.min(108, Math.max(...midiNotes) + 3);

    // PASS 1: White keys
    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;
        const isWhite = WHITE_KEY_PATTERN.includes(noteInOctave);

        if (isWhite) {
            const key = document.createElement('div');
            key.className = 'piano-key white';
            key.dataset.midi = midiNote;
            keysContainer.appendChild(key);
            state.pianoKeys.push({ element: key, midi: midiNote, isWhite: true });
        }
    }

    // PASS 2: Black keys
    let whiteIndex = 0;
    for (let midiNote = minNote; midiNote <= maxNote; midiNote++) {
        const noteInOctave = midiNote % 12;
        const isWhite = WHITE_KEY_PATTERN.includes(noteInOctave);

        if (isWhite) {
            whiteIndex++;
        } else {
            const key = document.createElement('div');
            key.className = 'piano-key black';
            key.dataset.midi = midiNote;
            const position = (whiteIndex - 1) * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH * 0.75;
            key.style.left = position + 'px';
            keysContainer.appendChild(key);
            state.pianoKeys.push({ element: key, midi: midiNote, isWhite: false });
        }
    }

    pianoContainer.appendChild(keysContainer);
}

export function setupControls(callbacks) {
    const playBtn = document.getElementById('playBtn');
    const progressBar = document.getElementById('progressBar');
    const songSelect = document.getElementById('songSelect');
    const speedSelect = document.getElementById('speedSelect');
    const playstyleSelect = document.getElementById('playstyleSelect');
    const instrumentSelect = document.getElementById('instrumentSelect');

    playBtn.addEventListener('click', callbacks.togglePlayback);

    progressBar.addEventListener('input', (e) => {
        const seekTime = (e.target.value / 100) * state.duration;
        callbacks.seekTo(seekTime);
    });

    songSelect.addEventListener('change', async (e) => {
        state.currentSong = e.target.value;
        await callbacks.onSongChange(state.currentSong);
    });

    speedSelect.addEventListener('change', async (e) => {
        state.currentSpeed = parseFloat(e.target.value);
        await callbacks.onSpeedChange(state.currentSpeed);
    });

    playstyleSelect.addEventListener('change', (e) => {
        state.currentPlaystyle = e.target.value;
    });

    instrumentSelect.addEventListener('change', (e) => {
        callbacks.onInstrumentChange(e.target.value);
    });
}

export function updateProgress() {
    const progress = (state.currentTime / state.duration) * 100;
    document.getElementById('progressBar').value = progress;
    document.querySelector('.current-time').textContent = formatTime(state.currentTime);
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatSongTitle(filename) {
    return filename.replace('.mid', '')
        .replace('Yiruma - ', '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function showEndScreen() {
    state.finalScore = state.melodyNotes.length > 0 ? (state.touchedMelodyCount / state.melodyNotes.length) * 100 : 0;

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
    ctx.fillStyle = state.finalScore >= 90 ? '#22c55e' : state.finalScore >= 70 ? '#facc15' : state.finalScore >= 50 ? '#f97316' : '#ef4444';
    ctx.shadowBlur = 30;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillText(`${state.finalScore.toFixed(1)}%`, canvas.width / 2, canvas.height / 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Inter';
    ctx.fillText(`${state.touchedMelodyCount} / ${state.melodyNotes.length} notes hit`, canvas.width / 2, canvas.height / 2 + 80);

    let rating = '';
    if (state.finalScore >= 95) rating = 'Perfect! 🌟';
    else if (state.finalScore >= 90) rating = 'Excellent! 🎉';
    else if (state.finalScore >= 80) rating = 'Great! 👏';
    else if (state.finalScore >= 70) rating = 'Good! 👍';
    else if (state.finalScore >= 50) rating = 'Nice Try! 💪';
    else rating = 'Keep Practicing! 🎹';

    ctx.font = '32px Inter';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(rating, canvas.width / 2, canvas.height / 2 + 130);
    ctx.restore();
}
