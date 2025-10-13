import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SceneChanger')
export class SceneChanger extends Component {

    @property
    targetScene: string = '';

    onClick() {
        if (this.targetScene) {
            director.loadScene(this.targetScene);
        }
    }
}
