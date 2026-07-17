import { _decorator, Component, Node, Vec2, Collider2D, RigidBody2D, Sprite, SpriteFrame, view } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

// despawnX was tuned by eye at the 720-wide design resolution. See the same
// note in LevelSequence.ts — wider screens reveal more design-space width,
// so this keeps despawnX's margin past the *actual* left edge instead of
// the fixed 720-wide one.
const DESIGN_HALF_WIDTH = 360;

@ccclass('ObstacleController')
export class ObstacleController extends Component {

    @property
    speed: number = 300;

    @property([SpriteFrame])
    walkFrames: SpriteFrame[] = [];

    @property
    walkFps: number = 15;

    @property
    despawnX: number = -700;

    // Kinematic RigidBody2D is needed for collision (Box2D won't fire
    // contacts for a lone collider), but driving it via velocity makes it
    // read as "actively coming at her" — turn this off for passive props
    // that should just ride along with the background at plain speed.
    @property
    useVelocity: boolean = true;

    private walkIndex: number = 0;
    private walkTimer: number = 0;
    private rigidBody: RigidBody2D | null = null;

    onLoad() {
        this.rigidBody = this.getComponent(RigidBody2D);
    }

    update(deltaTime: number) {
        if (!GameManager.started || GameManager.paused) {
            if (this.rigidBody && this.useVelocity) this.rigidBody.linearVelocity = new Vec2(0, 0);
            return;
        }

        // Step the walk-cycle frames in the same gated update as the
        // movement (instead of a separate cc.Animation component), so it
        // can't end up fighting the RigidBody2D-driven position changes.
        if (this.walkFrames.length > 0) {
            this.walkTimer += deltaTime;
            const frameDuration = 1 / this.walkFps;
            if (this.walkTimer >= frameDuration) {
                this.walkTimer -= frameDuration;
                this.walkIndex = (this.walkIndex + 1) % this.walkFrames.length;
                const sprite = this.getComponent(Sprite);
                if (sprite) sprite.spriteFrame = this.walkFrames[this.walkIndex];
            }
        }

        if (this.rigidBody && this.useVelocity) {
            this.rigidBody.linearVelocity = new Vec2(-this.speed, 0);
        } else {
            const pos = this.node.position;
            this.node.setPosition(pos.x - this.speed * deltaTime, pos.y, 0);
        }

        const despawnX = this.despawnX - (view.getVisibleSize().width / 2 - DESIGN_HALF_WIDTH);
        if (this.node.position.x < despawnX) {
            // A spawner hands this node back out later — just go dormant
            // instead of looping in place.
            this.node.active = false;
            if (this.rigidBody && this.useVelocity) this.rigidBody.linearVelocity = new Vec2(0, 0);
        }
    }

    // Used by a spawner to place this (pooled) obstacle and bring it back
    // to life at the right edge of the screen.
    spawnAt(x: number) {
        this.node.setPosition(x, this.node.position.y, 0);
        this.refreshCollider();
        this.node.active = true;
    }

    // Box2D can keep a stale contact pair around after a node has been
    // toggled inactive/active, so the next pass never fires BEGIN_CONTACT.
    // Toggling the collider forces it to drop and recreate the fixture.
    private refreshCollider() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.enabled = false;
            collider.enabled = true;
        }
    }
}
