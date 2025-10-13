import { _decorator, Component, AudioSource, sys } from 'cc';
const { ccclass, property } = _decorator;

let first_started = 0; // 0 = first load, 1 = game has been started before

@ccclass('StartupMusic')
export class StartupMusic extends Component {
    @property(AudioSource)
    audioSource: AudioSource | null = null;

    start() {
        if (!this.audioSource) return;

        // Native / mobile always autoplay
        if (sys.isNative || sys.isMobile) {
            this.playMusic();
            return;
        }

        // Browser case
        if (sys.isBrowser) {
            if (first_started === 0) {
                console.log("First load detected — skipping autoplay on web.");
                return; // Don’t play music yet
            } else {
                console.log("Returning to start scene — playing music automatically.");
                this.playMusic();
            }
        }
    }

    playMusic() {
        if (this.audioSource) {
            this.audioSource.loop = true;
            this.audioSource.play();
        }
    }
}

// Export the variable so other scripts can modify it
export { first_started };
