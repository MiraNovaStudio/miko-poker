import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SceneChanger')
export class SceneChanger extends Component {

    @property
    targetScene: string = '';

    onClick() {
        if (this.targetScene) {
            // just needed for web browser because music won't play until
            // there is some type of user interaction
            (globalThis as any).first_started = 1;

            director.loadScene(this.targetScene);
        }
    }
}
