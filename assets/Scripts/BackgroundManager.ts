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

    private step: number = 0;
    private startX: number = 0;

    start() {
        if (!this.template) return;

        const templateTransform = this.template.getComponent(UITransform);
        const tileWidth = templateTransform.contentSize.width * this.template.scale.x;
        const overlap = 2;
        const step = tileWidth - overlap;

        const startY = this.template.position.y;
        const baseX = this.template.position.x;

        // Lay tiles out symmetrically around the template (not just to its
        // right) so wide screens that reveal extra space on the left don't
        // show a gap past the leftmost tile.
        const half = Math.floor(this.tileCount / 2);
        for (let i = -half; i <= half; i++) {
            if (i === 0) continue;
            const clone = instantiate(this.template);
            clone.setParent(this.node);
            clone.setPosition(baseX + step * i, startY, 0);
        }

        this.step = step;
        this.startX = this.node.position.x;
    }

    update(deltaTime: number) {
        if (!GameManager.started || GameManager.paused || this.step === 0) return;

        let newX = this.node.position.x - this.speed * deltaTime;

        // Wrap by a single tile-width instead of the whole belt length.
        // Every tile is an identical copy spaced `step` apart, so this stays
        // perfectly seamless — and unlike wrapping the whole rigid group
        // only once per full belt cycle, it keeps the belt centered on the
        // viewport forever instead of letting the group drift past its own
        // length partway through a long run (which showed up as the
        // background going solid black once a level ran long enough).
        if (newX <= this.startX - this.step) {
            newX += this.step;
        }

        this.node.setPosition(newX, this.node.position.y, 0);
    }
}
