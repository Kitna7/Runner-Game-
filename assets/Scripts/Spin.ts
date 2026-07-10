import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Spin')
export class Spin extends Component {
    @property
    degreesPerSecond: number = 30;

    update(dt: number) {
        this.node.angle += this.degreesPerSecond * dt;
    }
}
