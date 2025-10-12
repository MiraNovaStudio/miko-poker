/**
 * AudioManager - Centralized audio handling for the poker game
 * Manages loading and playback of all sound effects
 */

import { _decorator, Component, AudioClip, AudioSource, resources } from 'cc';

const { ccclass } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private checkSoundClip: AudioClip | null = null;
    private betChipsSoundClip: AudioClip | null = null;
    private foldSoundClip: AudioClip | null = null;
    private audioSource: AudioSource | null = null;

    /**
     * Initialize audio system and load all sound effects
     */
    initialize() {
        // Add AudioSource component
        this.audioSource = this.node.addComponent(AudioSource);

        // Load check sound
        resources.load('sounds/check_one_knock', AudioClip, (err, clip) => {
            if (err) {
                console.error('Failed to load check sound:', err);
                return;
            }
            this.checkSoundClip = clip;
            console.log('Check sound loaded successfully');
        });

        // Load bet chips sound
        resources.load('sounds/bet_chips_2', AudioClip, (err, clip) => {
            if (err) {
                console.error('Failed to load bet chips sound:', err);
                return;
            }
            this.betChipsSoundClip = clip;
            console.log('Bet chips sound loaded successfully');
        });

        // Load fold sound
        resources.load('sounds/fold', AudioClip, (err, clip) => {
            if (err) {
                console.error('Failed to load fold sound:', err);
                return;
            }
            this.foldSoundClip = clip;
            console.log('Fold sound loaded successfully');
        });
    }

    /**
     * Ensure AudioContext is resumed (required by browsers after user gesture)
     */
    private ensureAudioContextResumed() {
        if (this.audioSource) {
            // Get the audio context and resume it if suspended
            const audioEngine = (this.audioSource as any)._audioEngine;
            if (audioEngine && audioEngine._audioContext) {
                const context = audioEngine._audioContext;
                if (context.state === 'suspended') {
                    context.resume().then(() => {
                        console.log('AudioContext resumed');
                    }).catch((err: any) => {
                        console.error('Failed to resume AudioContext:', err);
                    });
                }
            }
        }
    }

    /**
     * Play the check sound effect
     */
    playCheckSound() {
        this.ensureAudioContextResumed();
        if (this.audioSource && this.checkSoundClip) {
            this.audioSource.playOneShot(this.checkSoundClip, 1.0);
            console.log('Playing check sound');
        } else {
            console.warn('Check sound not available');
        }
    }

    /**
     * Play the bet chips sound effect
     */
    playBetSound() {
        this.ensureAudioContextResumed();
        if (this.audioSource && this.betChipsSoundClip) {
            this.audioSource.playOneShot(this.betChipsSoundClip, 1.0);
            console.log('Playing bet chips sound');
        } else {
            console.warn('Bet chips sound not available');
        }
    }

    /**
     * Play the fold sound effect
     */
    playFoldSound() {
        this.ensureAudioContextResumed();
        if (this.audioSource && this.foldSoundClip) {
            this.audioSource.playOneShot(this.foldSoundClip, 1.0);
            console.log('Playing fold sound');
        } else {
            console.warn('Fold sound not available');
        }
    }
}

