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
        // She needs to have picked up the opening coins before the enemy
        // is allowed to stop her — the level's spacing is what keeps the
        // coins arriving well ahead of the enemy reaching triggerX.
        if (GameManager.moneyCollected < GameManager.moneyToCollectBeforeJumpHint) return;
        if (!this.node.active || this.node.position.x > this.triggerX) return;

        GameManager.jumpHintShown = true;
        GameManager.paused = true;

        if (this.jumpText) this.jumpText.active = true;
        if (this.jumpHand) this.jumpHand.active = true;
    }
}
