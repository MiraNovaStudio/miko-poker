import { _decorator, Component, sys, game } from 'cc';
const { ccclass } = _decorator;

@ccclass('QuitGame')
export class QuitGame extends Component {
    onClick() {
        // For desktop builds
        if (sys.isNative && (sys.platform === sys.Platform.WIN32 || sys.platform === sys.Platform.MACOS)) {
            game.end(); // gracefully closes the app
        }
        // For web builds (redirect or close tab)
        else if (sys.isBrowser) {
            window.close();
            // Fallback for browsers that block window.close()
            window.location.href = 'about:blank';
        }
        // For mobile builds (Android/iOS)
        else if (sys.isNative) {
            game.end();
        } else {
            console.warn("Quit not supported on this platform");
        }
    }
}

