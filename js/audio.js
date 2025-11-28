import { state } from './state.js';

// Audio buffers cache structure: { instrumentName: { noteName: AudioBuffer } }
const instrumentBuffers = {
    'acoustic_grand_piano': {},
    'violin': {},
    'acoustic_guitar_nylon': {},
    'flute': {},
    'saxophone': {}
};
let currentInstrument = 'acoustic_grand_piano';
let isLoading = false;

export async function initAudio(onProgress) {
    // Create AudioContext
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Load default instrument (piano)
    await loadSamples('acoustic_grand_piano', onProgress);
}

async function loadSamples(instrument, onProgress) {
    if (isLoading) return;

    // Check if already loaded
    if (Object.keys(instrumentBuffers[instrument]).length > 0) {
        currentInstrument = instrument;
        console.log(`Instrument ${instrument} already loaded.`);
        return;
    }

    isLoading = true;
    console.log(`Loading samples for ${instrument}...`);

    // Map instrument names to folder names
    const folderMap = {
        'acoustic_grand_piano': 'piano',
        'violin': 'violin',
        'acoustic_guitar_nylon': 'guitar',
        'flute': 'flute',
        'saxophone': 'saxophone'
    };

    const folderName = folderMap[instrument] || 'piano';

    // Generate all note names from C2 to C7
    const notes = [];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    for (let octave = 2; octave <= 7; octave++) {
        for (let i = 0; i < noteNames.length; i++) {
            const noteName = `${noteNames[i]}${octave}`;
            notes.push(noteName);
            // Stop at C7
            if (noteName === 'C7') break;
        }
    }

    let loadedCount = 0;
    const totalCount = notes.length;

    // Load all WAV files
    const loadPromises = notes.map(async (noteName) => {
        try {
            // Replace # with s for filename (e.g. C#2 -> Cs2)
            const fileName = noteName.replace('#', 's');
            const response = await fetch(`assets/soundfonts/${folderName}/${fileName}.wav`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);

            // Store in cache
            if (!instrumentBuffers[instrument]) instrumentBuffers[instrument] = {};
            instrumentBuffers[instrument][noteName] = audioBuffer;

            loadedCount++;
            if (onProgress) {
                onProgress(loadedCount, totalCount);
            }

            // console.log(`Loaded: ${noteName} from ${fileName}.wav`);
        } catch (error) {
            console.warn(`Failed to load ${noteName} for ${instrument}:`, error);
        }
    });

    await Promise.all(loadPromises);
    console.log(`Loaded ${Object.keys(instrumentBuffers[instrument]).length} samples for ${instrument}`);

    currentInstrument = instrument;
    isLoading = false;
}

export async function setInstrument(instrumentName) {
    if (isLoading) return;

    console.log(`Switching to instrument: ${instrumentName}`);

    // Show loading indicator
    const loadingText = document.querySelector('#loading p');
    const loadingScreen = document.getElementById('loading');

    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        loadingScreen.style.display = 'flex';
        if (loadingText) loadingText.textContent = `Loading ${instrumentName}...`;
    }

    await loadSamples(instrumentName, (loaded, total) => {
        const percent = Math.round((loaded / total) * 100);
        if (loadingText) loadingText.textContent = `Loading ${instrumentName}... ${percent}%`;
    });

    // Hide loading indicator
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        loadingScreen.style.display = 'none';
    }
}

export function playMelodyNote(note) {
    if (!state.audioContext) return;

    const noteName = midiToNoteName(note.midi);
    const audioBuffer = instrumentBuffers[currentInstrument][noteName];

    if (!audioBuffer) {
        // console.warn(`No audio buffer for ${noteName} in ${currentInstrument}`);
        return;
    }

    // Create buffer source
    const source = state.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create gain node for volume control
    const gainNode = state.audioContext.createGain();
    const velocity = note.velocity || 0.5;
    gainNode.gain.value = Math.min(velocity * 3.0, 2.0); // High volume

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(state.audioContext.destination);

    // Play immediately
    source.start(state.audioContext.currentTime);

    // Mark as played
    state.playedMelodyIds.add(note.id);
    state.touchedMelodyCount++;
}

export function scheduleNotes() {
    if (!state.audioContext) return;

    // Clear previously scheduled notes
    stopAllNotes();

    const currentTime = state.audioContext.currentTime;
    state.startTime = currentTime - state.currentTime;

    console.log(`Scheduling ${state.harmonyNotes.length} harmony notes`);

    // Schedule harmony notes
    state.harmonyNotes.forEach(note => {
        const noteTime = state.startTime + note.time;

        if (noteTime > currentTime) {
            const noteName = midiToNoteName(note.midi);
            const audioBuffer = instrumentBuffers[currentInstrument][noteName];

            if (!audioBuffer) return;

            // Create buffer source
            const source = state.audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Create gain node
            const gainNode = state.audioContext.createGain();
            const velocity = note.velocity || 0.4;
            gainNode.gain.value = Math.min(velocity * 2.0, 1.5); // Harmony volume

            // Connect
            source.connect(gainNode);
            gainNode.connect(state.audioContext.destination);

            // Schedule
            source.start(noteTime);

            // Store for cleanup
            state.scheduledNotes.push({ source, gainNode });
        }
    });
}

export function stopAllNotes() {
    // Stop all scheduled notes
    state.scheduledNotes.forEach(({ source, gainNode }) => {
        try {
            if (source) source.stop();
            if (gainNode) gainNode.disconnect();
        } catch (e) {
            // Already stopped
        }
    });
    state.scheduledNotes = [];
}

// Helper function to convert MIDI number to note name
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Clamp to range C2 (36) - C7 (96)
    const clampedMidi = Math.max(36, Math.min(midi, 96));

    const octave = Math.floor(clampedMidi / 12) - 1;
    const noteName = noteNames[clampedMidi % 12];
    return `${noteName}${octave}`;
}
