import { _decorator, Component, Node, Vec3, Vec2, EventTouch, tween, Collider2D, Contact2DType, IPhysics2DContact, Animation, Sprite, SpriteFrame, Color, UIOpacity, UITransform, Size, RigidBody2D, AudioSource, AudioClip } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property
    jumpHeight: number = 250;

    @property
    jumpDuration: number = 0.5;

    @property(SpriteFrame)
    hitFace: SpriteFrame | null = null;

    @property(SpriteFrame)
    standFace: SpriteFrame | null = null;

    @property(SpriteFrame)
    standFaceBlink: SpriteFrame | null = null;

    @property(SpriteFrame)
    jumpFaceTakeoff: SpriteFrame | null = null;

    @property(SpriteFrame)
    jumpFaceRise: SpriteFrame | null = null;

    // Peak pose — shown right at the top of the arc, between the rise and
    // the fall.
    @property(SpriteFrame)
    jumpFacePeak: SpriteFrame | null = null;

    // Falling pose — shown from the peak of the jump until just before she
    // touches down, separate from the takeoff/rise crouch and the final
    // landing pose.
    @property(SpriteFrame)
    jumpFaceDescent: SpriteFrame | null = null;

    @property(SpriteFrame)
    jumpFaceLand: SpriteFrame | null = null;

    @property
    hitFaceDuration: number = 0.5;

    @property
    blinkInterval: number = 0.15;

    @property([Node])
    hearts: Node[] = [];

    @property
    lostHeartOpacity: number = 60;

    @property(Node)
    failBanner: Node | null = null;

    @property
    failBannerPopDuration: number = 0.3;

    @property(Node)
    failPopupContent: Node | null = null;

    @property
    failPopupDelay: number = 2;

    @property(Node)
    failInstallButton: Node | null = null;

    @property
    failInstallButtonDelay: number = 1.5;

    @property(Node)
    failLight: Node | null = null;

    @property
    failLightDegreesPerSecond: number = 90;

    @property(Node)
    winLight: Node | null = null;

    @property
    winLightDegreesPerSecond: number = 90;

    @property(AudioClip)
    hitSound: AudioClip | null = null;

    @property(AudioClip)
    failSound: AudioClip | null = null;

    // The looping background-music AudioSource (on its own AudioManager
    // node) — stopped the instant the game ends so it doesn't keep playing
    // under the fail sound.
    @property(AudioSource)
    bgMusic: AudioSource | null = null;

    @property(Node)
    bottomBanner: Node | null = null;

    @property(Node)
    bottomBannerIcon: Node | null = null;

    @property(Node)
    enemy: Node | null = null;

    @property
    enemySpeed: number = 300;

    @property([SpriteFrame])
    enemyWalkFrames: SpriteFrame[] = [];

    @property
    enemyWalkFps: number = 15;

    // Multiplier on the run-cycle animation's playback speed — bump this
    // instead of the world scroll speed so her legs look like they're
    // working harder without actually changing gameplay pacing.
    @property
    runAnimSpeed: number = 1.4;

    private isJumping: boolean = false;
    private isReactingToHit: boolean = false;
    private groundY: number = 0;
    private runAnimStarted: boolean = false;
    private wasPaused: boolean = false;
    private normalFrame: SpriteFrame | null = null;
    private normalColor: Color | null = null;
    private normalSize: Size | null = null;
    private blinkEyesOpen: boolean = true;
    private blinkOpenFrame: SpriteFrame | null = null;
    private blinkClosedFrame: SpriteFrame | null = null;
    private enemyWalkIndex: number = 0;
    private enemyWalkTimer: number = 0;
    private enemyRigidBody: RigidBody2D | null = null;
    private fixedX: number = 0;
    private touchingNodes: Set<Node> = new Set();
    private audioSource: AudioSource | null = null;

    onLoad() {
        this.groundY = this.node.position.y;
        this.fixedX = this.node.position.x;
        this.audioSource = this.getComponent(AudioSource);

        if (this.enemy) {
            this.enemyRigidBody = this.enemy.getComponent(RigidBody2D);
        }

        this.node.parent.on(Node.EventType.TOUCH_START, this.onTouchStart, this);

        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }

        const sprite = this.getComponent(Sprite);
        if (sprite) {
            this.normalFrame = sprite.spriteFrame;
            this.normalColor = sprite.color.clone();
            // Lock the display size so swapping to hitFace (a differently
            // sized source image) can't resize the node away from her
            // normal running size.
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            this.normalSize = uiTransform.contentSize.clone();
        }

        if (this.hearts.length > 0) {
            GameManager.lives = this.hearts.length;
            for (const heart of this.hearts) {
                const opacity = heart.getComponent(UIOpacity);
                if (opacity) opacity.opacity = 255;
            }
        }

        if (this.failBanner) this.failBanner.active = false;
        if (this.failPopupContent) this.failPopupContent.active = false;
        if (this.failInstallButton) this.failInstallButton.active = false;

        // She stands blinking on the "Tap to start" screen too, not just
        // when frozen later at the jump hint — same idle pose either way.
        if (sprite) this.startBlinking(sprite, uiTransform, this.standFace, this.standFaceBlink);
    }

    update(dt: number) {
        // Collisions can physically shove her sideways via Box2D even
        // though she's only ever meant to move vertically (jumping) — pin
        // her X back every frame so a hit can't leave her drifted behind
        // the run cycle / off-screen.
        if (this.node.position.x !== this.fixedX) {
            this.node.setPosition(this.fixedX, this.node.position.y, 0);
        }

        if (this.failLight) {
            this.failLight.angle -= this.failLightDegreesPerSecond * dt;
        }

        if (this.winLight) {
            this.winLight.angle -= this.winLightDegreesPerSecond * dt;
        }

        // Drive the enemy from here (the one update loop that's reliably
        // ticking every frame) instead of its own component, since a
        // separate script on that node kept ending up stuck in place.
        if (this.enemy && this.enemy.active && GameManager.started && !GameManager.paused) {
            // A Kinematic RigidBody2D has to be moved via velocity — Box2D
            // re-asserts the body's own transform over any direct
            // node.setPosition() each physics step, which is exactly why
            // it kept snapping back in place.
            if (this.enemyRigidBody) {
                this.enemyRigidBody.linearVelocity = new Vec2(-this.enemySpeed, 0);
            } else {
                const pos = this.enemy.position;
                this.enemy.setPosition(pos.x - this.enemySpeed * dt, pos.y, 0);
            }

            if (this.enemy.position.x < -700) {
                // A spawner hands the enemy back out later — just go
                // dormant instead of looping back to its old start spot.
                this.enemy.active = false;
                if (this.enemyRigidBody) this.enemyRigidBody.linearVelocity = new Vec2(0, 0);
            }

            if (this.enemyWalkFrames.length > 0) {
                this.enemyWalkTimer += dt;
                const frameDuration = 1 / this.enemyWalkFps;
                if (this.enemyWalkTimer >= frameDuration) {
                    this.enemyWalkTimer -= frameDuration;
                    this.enemyWalkIndex = (this.enemyWalkIndex + 1) % this.enemyWalkFrames.length;
                    const enemySprite = this.enemy.getComponent(Sprite);
                    if (enemySprite) enemySprite.spriteFrame = this.enemyWalkFrames[this.enemyWalkIndex];
                }
            }
        } else if (this.enemyRigidBody) {
            this.enemyRigidBody.linearVelocity = new Vec2(0, 0);
        }

        const anim = this.getComponent(Animation);

        if (!this.runAnimStarted && GameManager.started) {
            this.runAnimStarted = true;
            this.stopBlinking();
            const sprite = this.getComponent(Sprite);
            const uiTransform = this.getComponent(UITransform);
            if (sprite) {
                sprite.spriteFrame = this.normalFrame;
                if (this.normalColor) sprite.color = this.normalColor;
            }
            if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);
            if (anim && anim.defaultClip) {
                anim.play(anim.defaultClip.name);
                const state = anim.getState(anim.defaultClip.name);
                if (state) state.speed = this.runAnimSpeed;
            }
        }

        // Treat "game over via the finish line" the same as the tutorial
        // pause for animation purposes — either way she should freeze on a
        // standing pose instead of her legs still cycling through the run
        // animation while the world around her has already stopped.
        const shouldFreezeAnim = GameManager.paused || !GameManager.started;

        if (anim && this.runAnimStarted && !this.isReactingToHit) {
            const sprite = this.getComponent(Sprite);
            const uiTransform = this.getComponent(UITransform);

            if (shouldFreezeAnim && !this.wasPaused) {
                // First time she meets an obstacle: freeze on the standing
                // pose (blinking) instead of a mid-stride running frame
                // while the jump hint waits for the player's first tap.
                anim.pause();
                if (sprite) this.startBlinking(sprite, uiTransform, this.standFace, this.standFaceBlink);
            } else if (!shouldFreezeAnim && this.wasPaused) {
                this.stopBlinking();
                if (sprite) {
                    sprite.spriteFrame = this.normalFrame;
                    if (this.normalColor) sprite.color = this.normalColor;
                }
                if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);
                anim.resume();
            }
        }
        this.wasPaused = shouldFreezeAnim;
    }

    onDestroy() {
        this.node.parent.off(Node.EventType.TOUCH_START, this.onTouchStart, this);

        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }

        this.stopBlinking();
    }

    onTouchStart(event: EventTouch) {
        if (!GameManager.started || GameManager.paused) return;
        this.jump();
    }

    private setFace(sprite: Sprite | null, uiTransform: UITransform | null, frame: SpriteFrame | null) {
        if (!sprite || !frame) return;
        sprite.spriteFrame = frame;
        if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);
    }

    jump() {
        if (this.isJumping) return;
        this.isJumping = true;

        const upY = this.groundY + this.jumpHeight;

        const anim = this.getComponent(Animation);
        const sprite = this.getComponent(Sprite);
        const uiTransform = this.getComponent(UITransform);
        const usingJumpFaces = !!(sprite && (this.jumpFaceTakeoff || this.jumpFaceRise || this.jumpFacePeak || this.jumpFaceDescent || this.jumpFaceLand));

        if (usingJumpFaces) {
            // Disabling (not just pausing) the run-cycle animation stops it
            // from re-asserting its own spriteFrame every frame, which was
            // fighting with (and winning over) the jump-pose frames below.
            if (anim) anim.enabled = false;
            this.setFace(sprite, uiTransform, this.jumpFaceTakeoff);

            // Step through the poses across the jump so she visibly
            // crouches, tucks her legs mid-air, tops out, falls, then
            // stretches out again just before landing, instead of holding
            // one static frame for the whole arc.
            this.scheduleOnce(() => this.setFace(sprite, uiTransform, this.jumpFaceRise), this.jumpDuration * 0.2);
            this.scheduleOnce(() => this.setFace(sprite, uiTransform, this.jumpFacePeak), this.jumpDuration * 0.4);
            this.scheduleOnce(() => this.setFace(sprite, uiTransform, this.jumpFaceDescent), this.jumpDuration * 0.6);
            this.scheduleOnce(() => this.setFace(sprite, uiTransform, this.jumpFaceLand), this.jumpDuration * 0.85);
        }

        tween(this.node)
            .to(this.jumpDuration / 2, { position: new Vec3(this.node.position.x, upY, 0) }, { easing: 'quadOut' })
            .to(this.jumpDuration / 2, { position: new Vec3(this.node.position.x, this.groundY, 0) }, { easing: 'quadIn' })
            .call(() => {
                this.isJumping = false;
                if (usingJumpFaces && sprite) {
                    sprite.spriteFrame = this.normalFrame;
                    if (this.normalColor) sprite.color = this.normalColor;
                    if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);
                    if (anim && !this.isReactingToHit) anim.enabled = true;
                }
            })
            .start();
    }

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (GameManager.lives <= 0 || !GameManager.started) return;

        // Mid-jump, a glancing touch against the enemy (e.g. while clearing
        // a cone that happens to land close to him) shouldn't cost a life —
        // only a contact while she's on the ground actually counts.
        if (this.isJumping && this.enemy && otherCollider.node === this.enemy) return;

        // One touch, one life: as long as this exact obstacle is still
        // overlapping her, it can't cost a second life, no matter how long
        // the contact lasts or how the hit-reaction timing lines up.
        if (this.touchingNodes.has(otherCollider.node)) return;
        this.touchingNodes.add(otherCollider.node);

        if (this.isReactingToHit) return;
        this.isReactingToHit = true;

        if (this.audioSource && this.hitSound) this.audioSource.playOneShot(this.hitSound);

        GameManager.lives = Math.max(0, GameManager.lives - 1);
        if (GameManager.lives <= 0) {
            // Freeze the whole world (obstacles, background) the instant the
            // fatal hit lands, instead of letting it keep scrolling during
            // her hit-reaction while she's already frozen.
            GameManager.started = false;
            GameManager.gameOver = true;
            if (this.bottomBanner) this.bottomBanner.active = false;
            if (this.bottomBannerIcon) this.bottomBannerIcon.active = false;
            if (this.bgMusic) this.bgMusic.stop();
        }
        const lostHeart = this.hearts[GameManager.lives];
        if (lostHeart) {
            const opacity = lostHeart.getComponent(UIOpacity);
            if (opacity) opacity.opacity = this.lostHeartOpacity;
        }

        const anim = this.getComponent(Animation);
        if (anim) anim.pause();

        const sprite = this.getComponent(Sprite);
        const uiTransform = this.getComponent(UITransform);

        if (sprite) {
            if (this.hitFace) sprite.spriteFrame = this.hitFace;
            if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);
            sprite.color = new Color(255, 60, 60, 255);
        }

        this.scheduleOnce(() => {
            if (GameManager.lives <= 0) {
                this.showFailBanner();
                return;
            }

            if (sprite) {
                sprite.spriteFrame = this.normalFrame;
                if (this.normalColor) sprite.color = this.normalColor;
            }
            if (uiTransform && this.normalSize) {
                uiTransform.setContentSize(this.normalSize);
            }
            if (anim) anim.resume();
            this.isReactingToHit = false;
        }, this.hitFaceDuration);
    }

    onEndContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        this.touchingNodes.delete(otherCollider.node);
    }

    private startBlinking(sprite: Sprite, uiTransform: UITransform | null, openFrame: SpriteFrame | null, closedFrame: SpriteFrame | null) {
        // Fall back to her normal frame instead of ever assigning a null
        // spriteFrame, which would make her disappear entirely.
        this.blinkOpenFrame = openFrame || this.normalFrame;
        this.blinkClosedFrame = closedFrame;
        this.blinkEyesOpen = true;
        sprite.spriteFrame = this.blinkOpenFrame;
        if (uiTransform && this.normalSize) uiTransform.setContentSize(this.normalSize);

        this.unschedule(this.toggleBlink);
        if (this.blinkClosedFrame) {
            this.schedule(this.toggleBlink, this.blinkInterval);
        }
    }

    private toggleBlink() {
        const sprite = this.getComponent(Sprite);
        if (!sprite) return;
        this.blinkEyesOpen = !this.blinkEyesOpen;
        const frame = this.blinkEyesOpen ? this.blinkOpenFrame : this.blinkClosedFrame;
        if (frame) sprite.spriteFrame = frame;
    }

    private stopBlinking() {
        this.unschedule(this.toggleBlink);
    }

    private showFailBanner() {
        if (!this.failBanner) return;

        if (this.audioSource && this.failSound) this.audioSource.playOneShot(this.failSound);

        this.failBanner.active = true;
        this.failBanner.setScale(0, 0, 1);
        tween(this.failBanner)
            .to(this.failBannerPopDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        // Show the red FAIL badge first, then swap to the PayPal payout
        // popup — and reveal the install button in that exact same beat,
        // nested in this one callback instead of a second independent
        // scheduleOnce, so there's no chance of the two drifting apart.
        this.scheduleOnce(() => {
            const sprite = this.failBanner.getComponent(Sprite);
            if (sprite) sprite.enabled = false;
            if (this.failPopupContent) {
                this.failPopupContent.active = true;
                this.failPopupContent.setScale(0, 0, 1);
                tween(this.failPopupContent)
                    .to(this.failBannerPopDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
            }
            if (this.failInstallButton) {
                this.failInstallButton.active = true;
                this.failInstallButton.setScale(0, 0, 1);
                tween(this.failInstallButton)
                    .to(this.failBannerPopDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
            }
        }, this.failPopupDelay);
    }

}