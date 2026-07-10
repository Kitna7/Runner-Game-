import { _decorator, Component, Graphics, UITransform, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RoundedBackground')
export class RoundedBackground extends Component {
    @property
    color: Color = new Color(255, 165, 0, 255);

    @property
    radius: number = 14;

    start() {
        const g = this.getComponent(Graphics);
        const uiTransform = this.getComponent(UITransform);
        if (!g || !uiTransform) return;

        const w = uiTransform.width;
        const h = uiTransform.height;

        g.fillColor = this.color;
        g.roundRect(-w / 2, -h / 2, w, h, this.radius);
        g.fill();
    }
}
