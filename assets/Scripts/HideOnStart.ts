import { _decorator, Component } from 'cc';
import { GameManager } from './GameManager';
const { ccclass } = _decorator;

@ccclass('HideOnStart')
export class HideOnStart extends Component {
    update() {
        if (GameManager.started) {
            this.node.active = false;
        }
    }
}
