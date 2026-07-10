import { _decorator, Component, Node, EventTouch, tween, Vec3 } from 'cc';
import { GameManager } from './GameManager';
const { ccclass } = _decorator;

@ccclass('StartHand')
export class StartHand extends Component {

    onLoad() {
        this.node.parent.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    start() {
        tween(this.node)
            .repeatForever(
                tween()
                    .to(0.5, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'sineInOut' })
                    .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            )
            .start();
    }

    onDestroy() {
        this.node.parent.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: EventTouch) {
        if (GameManager.started || GameManager.gameOver) return;
        GameManager.started = true;
        GameManager.paused = false;
        this.node.active = false;
    }
}
