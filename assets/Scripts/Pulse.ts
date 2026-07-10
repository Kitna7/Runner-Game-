import { _decorator, Component, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Pulse')
export class Pulse extends Component {
    @property
    scaleAmount: number = 1.15;

    @property
    duration: number = 0.5;

    start() {
        tween(this.node)
            .repeatForever(
                tween()
                    .to(this.duration, { scale: new Vec3(this.scaleAmount, this.scaleAmount, 1) }, { easing: 'sineInOut' })
                    .to(this.duration, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            )
            .start();
    }
}
