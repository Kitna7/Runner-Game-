import { _decorator, Component, Node } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('JumpTutorialTrigger')
export class JumpTutorialTrigger extends Component {
    @property(Node)
    jumpText: Node = null;

    @property(Node)
    jumpHand: Node = null;

    @property
    triggerX: number = 150;

    update() {
        if (!GameManager.started || GameManager.jumpHintShown) return;
        if (!this.node.active || this.node.position.x > this.triggerX) return;

        // She needs to have picked up the opening coins before the enemy
        // is allowed to stop her. Level spacing used to be relied on to
        // keep the coins arriving well ahead of the enemy reaching
        // triggerX, but that's not guaranteed on every screen width — so
        // if she hasn't collected enough yet, hold the enemy right here
        // instead of letting it coast straight through her untouched.
        if (GameManager.moneyCollected < GameManager.moneyToCollectBeforeJumpHint) {
            this.node.setPosition(this.triggerX, this.node.position.y, 0);
            return;
        }

        GameManager.jumpHintShown = true;
        GameManager.paused = true;

        if (this.jumpText) this.jumpText.active = true;
        if (this.jumpHand) this.jumpHand.active = true;
    }
}
