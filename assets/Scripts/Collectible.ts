import { _decorator, Component, Node, Label, tween, Tween, Vec3, AudioSource, AudioClip } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

const PRAISE_MESSAGES = ['Perfect!', 'Great!', 'Fantastic!', 'Awesome!'];

@ccclass('Collectible')
export class Collectible extends Component {
    @property
    speed: number = 300;

    @property
    value: number = 1;

    @property(Node)
    player: Node = null;

    @property(Node)
    flyTarget: Node = null;

    @property
    pickupDistance: number = 60;

    @property(AudioClip)
    collectSound: AudioClip | null = null;

    private collected: boolean = false;

    update(deltaTime: number) {
        if (!GameManager.started || GameManager.paused || this.collected) return;

        const pos = this.node.position;
        const newX = pos.x - this.speed * deltaTime;
        this.node.setPosition(newX, pos.y, 0);

        if (newX < -700) {
            // Uncollected and off-screen — free it up so a pool/spawner can
            // hand it out again instead of it drifting forever unseen.
            this.node.active = false;
            return;
        }

        if (this.player) {
            const dx = Math.abs(newX - this.player.position.x);
            const dy = Math.abs(pos.y - this.player.position.y);
            if (dx < this.pickupDistance && dy < this.pickupDistance) {
                this.collect();
            }
        }
    }

    // Used by a spawner to hand this (pooled) coin a fresh position and
    // bring it back to life after it was collected or scrolled off-screen.
    spawnAt(x: number, y: number) {
        // If this pooled coin is still mid-flight from a previous pickup,
        // that old tween would otherwise finish later and deactivate the
        // node again right after we've just brought it back to life.
        Tween.stopAllByTarget(this.node);
        this.collected = false;
        this.node.setScale(1, 1, 1);
        this.node.setPosition(x, y, 0);
        this.node.active = true;
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        GameManager.money += this.value;
        GameManager.moneyCollected += 1;

        // Counts how many coins/PayPals landed back-to-back — reset a beat
        // after each pickup, so a lone coin never sees this climb past 1
        // even if she's already collected plenty earlier in the run. A
        // wide window here means more of a spread-out group still counts
        // together instead of the streak resetting partway through it.
        GameManager.streakCount += 1;
        this.scheduleOnce(() => { GameManager.streakCount = 0; }, 2.5);

        if (this.player) {
            // Only once this cluster is more than 2 coins/PayPals deep.
            // moneyCollected/streakCount are shared by every Collectible
            // instance (money AND PayPal both run through this same
            // collect() method), so a PayPal pickup counts the same as a
            // regular coin. No separate component on the text node — driven
            // entirely from here so there's nothing extra to wire up in the
            // editor.
            if (GameManager.streakCount > 2 && !GameManager.praiseOnCooldown) {
                const praiseNode = this.player.getChildByName('PraiseText');
                if (praiseNode) {
                    GameManager.praiseOnCooldown = true;
                    this.scheduleOnce(() => { GameManager.praiseOnCooldown = false; }, 1.2);

                    const label = praiseNode.getComponent(Label);
                    if (label) label.string = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];

                    Tween.stopAllByTarget(praiseNode);
                    praiseNode.active = true;
                    praiseNode.setScale(0.6, 0.6, 1);
                    tween(praiseNode)
                        .to(0.12, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'backOut' })
                        .to(0.1, { scale: new Vec3(1, 1, 1) })
                        .delay(0.5)
                        .call(() => { praiseNode.active = false; })
                        .start();
                }
            }

            if (this.collectSound) {
                const audioSource = this.player.getComponent(AudioSource);
                if (audioSource) audioSource.playOneShot(this.collectSound);
            }
        }

        const targetPos = this.flyTarget ? this.flyTarget.position : this.node.position;

        tween(this.node)
            .to(0.4, {
                position: new Vec3(targetPos.x, targetPos.y, 0),
                scale: new Vec3(0.2, 0.2, 1)
            }, { easing: 'quadIn' })
            .call(() => {
                this.node.active = false;
            })
            .start();
    }
}
