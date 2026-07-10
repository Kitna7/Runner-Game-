import { _decorator, Component, Node, UITransform, instantiate } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('BackgroundManager')
export class BackgroundManager extends Component {
    @property(Node)
    template: Node | null = null;

    @property
    speed: number = 300;

    @property
    tileCount: number = 15;

    private totalWidth: number = 0;
    private startX: number = 0;

    start() {
        if (!this.template) return;

        const templateTransform = this.template.getComponent(UITransform);
        const tileWidth = templateTransform.contentSize.width * this.template.scale.x;
        const overlap = 2;
        const step = tileWidth - overlap;

        const startY = this.template.position.y;
        const baseX = this.template.position.x;

        for (let i = 1; i < this.tileCount; i++) {
            const clone = instantiate(this.template);
            clone.setParent(this.node);
            clone.setPosition(baseX + step * i, startY, 0);
        }

        this.totalWidth = step * this.tileCount;
        this.startX = this.node.position.x;
    }

    update(deltaTime: number) {
        if (!GameManager.started || GameManager.paused || this.totalWidth === 0) return;

        let newX = this.node.position.x - this.speed * deltaTime;

        if (newX <= this.startX - this.totalWidth) {
            newX += this.totalWidth;
        }

        this.node.setPosition(newX, this.node.position.y, 0);
    }
}
