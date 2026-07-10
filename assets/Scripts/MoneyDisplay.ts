import { _decorator, Component, Label } from 'cc';
import { GameManager } from './GameManager';
const { ccclass } = _decorator;

@ccclass('MoneyDisplay')
export class MoneyDisplay extends Component {
    update() {
        const label = this.getComponent(Label) || this.getComponentInChildren(Label);
        if (label) {
            label.string = '$' + GameManager.money;
        }
    }
}
