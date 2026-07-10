import { _decorator, Component, Node, UITransform } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('BackgroundScroller')
export class BackgroundScroller extends Component {
    @property
    speed: number = 300;

    @property(Node)
    otherBackground: Node = null; // сюда перетащим вторую половину фона

    private bgWidth: number = 0;

    start() {
        const transform = this.getComponent(UITransform);
        this.bgWidth = transform.width * this.node.scale.x;
    }

    update(deltaTime: number) {
        if (!GameManager.started || GameManager.paused) return;

        const newX = this.node.position.x - this.speed * deltaTime;
        this.node.setPosition(newX, this.node.position.y, 0);

        // как только я полностью ушёл за левый край — переставляю себя
        // ВПРИТЫК К ПРАВОМУ КРАЮ СОСЕДНЕГО фона (а не по заранее посчитанному числу)
        if (this.node.position.x <= -this.bgWidth) {
            const otherX = this.otherBackground.position.x;
            this.node.setPosition(otherX + this.bgWidth - 1, this.node.position.y, 0);
        }
    }
}