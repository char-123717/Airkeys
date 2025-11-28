import { state } from './state.js';

export async function initAudio() {
    const select = document.getElementById('instrumentSelect');
    const initial = select && select.value ? select.value : 'piano';
    setInstrument(initial);
}

export function setInstrument(name) {
    try { Tone.Transport.cancel(); } catch { }
    if (state.synth && !state.synth.disposed) {
        try { state.synth.dispose(); } catch { }
    }
    if (state.master && !state.master.disposed) { try { state.master.dispose(); } catch { } }
    if (state.compressor && !state.compressor.disposed) { try { state.compressor.dispose(); } catch { } }
    if (state.limiter && !state.limiter.disposed) { try { state.limiter.dispose(); } catch { } }

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
        state.synth = new Tone.PolySynth(v.Voice, v.opts);
    } catch (err) {
        state.synth = new Tone.PolySynth(Tone.Synth, voices.piano.opts);
    }

    state.limiter = new Tone.Limiter(-1).toDestination();
    state.compressor = new Tone.Compressor(-12, 3).connect(state.limiter);
    state.master = new Tone.Volume(0).connect(state.compressor);
    state.synth.connect(state.master);

    // Adjust volume based on instrument
    if (name === 'guitar') {
        state.synth.volume.value = 5; // Boost guitar volume significantly
    } else {
        state.synth.volume.value = 1; // Default volume
    }
}

export function scheduleNotes() {
    Tone.Transport.cancel();
    state.harmonyNotes.forEach(note => {
        if (note.time >= state.currentTime) {
            const safeDuration = Math.max(0.1, note.duration);
            Tone.Transport.schedule((time) => {
                state.synth.triggerAttackRelease(
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

export function playMelodyNote(note) {
    const safeDuration = Math.max(0.1, note.duration);
    state.synth.triggerAttackRelease(Tone.Frequency(note.midi, 'midi'), safeDuration, undefined, note.velocity);
    state.playedMelodyIds.add(note.id);
    state.touchedMelodyCount++;
}
