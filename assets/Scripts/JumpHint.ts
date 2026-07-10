import { _decorator, Component, Node, EventTouch } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('JumpHint')
export class JumpHint extends Component {
    @property(Node)
    jumpText: Node = null;

    onLoad() {
        this.node.parent.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        this.node.parent.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: EventTouch) {
        if (!GameManager.paused) return;
        GameManager.paused = false;
        this.node.active = false;
        if (this.jumpText) this.jumpText.active = false;
    }
}
