import { state } from './state.js';

export async function loadMIDI(filename) {
    // Fetch MIDI file from assets/midi/
    const response = await fetch(`assets/midi/${filename}`);
    const arrayBuffer = await response.arrayBuffer();
    state.midi = new Midi(arrayBuffer);

    // Adjust tempo based on speed setting
    const TEMPO_MULTIPLIER = 1 / state.currentSpeed;

    // Special transpose for specific songs
    const isJumpingMachine = filename.toLowerCase().includes('jumping machine');

    // Extract all notes from all MIDI tracks
    state.notes = [];
    state.midi.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, idx) => {
            state.notes.push({
                id: `${trackIndex}:${idx}`,
                midi: note.midi + (isJumpingMachine ? -6 : 0),
                time: note.time * TEMPO_MULTIPLIER,
                duration: note.duration * TEMPO_MULTIPLIER,
                velocity: note.velocity,
                name: note.name,
                trackIndex: trackIndex
            });
        });
    });

    // Sort chronologically
    state.notes.sort((a, b) => a.time - b.time);

    // ===== MELODY/HARMONY SEPARATION =====
    const epsilon = 0.05;
    state.melodyNotes = [];
    state.harmonyNotes = [];

    let i = 0;
    while (i < state.notes.length) {
        const groupStart = state.notes[i].time;
        const group = [];
        let j = i;

        while (j < state.notes.length && Math.abs(state.notes[j].time - groupStart) <= epsilon) {
            group.push(state.notes[j]);
            j++;
        }

        const melody = group.reduce((acc, n) => (n.midi > acc.midi ? n : acc), group[0]);
        state.melodyNotes.push(melody);

        group.forEach(n => {
            if (n.id !== melody.id) state.harmonyNotes.push(n);
        });

        i = j;
    }

    if (isJumpingMachine) {
        console.log("Filtering harmony for Jumping Machine");
        state.harmonyNotes = [];
        state.notes = [...state.melodyNotes];
        state.notes.sort((a, b) => a.time - b.time);
    }

    state.duration = state.midi.duration * TEMPO_MULTIPLIER;
    document.querySelector('.total-time').textContent = formatTime(state.duration);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
