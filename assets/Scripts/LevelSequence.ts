import { _decorator, Component, Node, warn, AudioSource, AudioClip, tween, Tween, Vec3, Sprite, SpriteFrame, UIOpacity } from 'cc';
import { GameManager } from './GameManager';
import { ObstacleController } from './ObstacleController';
import { Collectible } from './Collectible';
const { ccclass, property } = _decorator;

type SeqItem =
    | { type: 'money'; count: number; pyramid: boolean }
    | { type: 'cone' }
    | { type: 'enemy' };

// money x2, enemy, money x5 (pyramid), money x1, cone, enemy,
// money x6 (pyramid), money x1, cone, enemy, money x1, money x3 (pyramid),
// cone, enemy, money x4, money x1, cone, enemy, money x5 (pyramid), cone.
const SEQUENCE: SeqItem[] = [
    { type: 'money', count: 2, pyramid: false },
    { type: 'enemy' },
    { type: 'money', count: 5, pyramid: true },
    { type: 'money', count: 1, pyramid: false },
    { type: 'cone' },
    { type: 'enemy' },
    { type: 'money', count: 6, pyramid: true },
    { type: 'money', count: 1, pyramid: false },
    { type: 'cone' },
    { type: 'enemy' },
    { type: 'money', count: 1, pyramid: false },
    { type: 'money', count: 3, pyramid: true },
    { type: 'cone' },
    { type: 'enemy' },
    { type: 'money', count: 4, pyramid: false },
    { type: 'money', count: 1, pyramid: false },
    { type: 'cone' },
    { type: 'enemy' },
    { type: 'money', count: 5, pyramid: true },
    { type: 'cone' },
];

@ccclass('LevelSequence')
export class LevelSequence extends Component {
    @property(Node)
    coneTemplate: Node | null = null;

    @property(Node)
    enemyTemplate: Node | null = null;

    @property([Node])
    coinPool: Node[] = [];

    // Occasionally swapped in for a regular coin so each run looks a little
    // different and rewards a lucky pass with something worth more.
    @property([Node])
    paypalPool: Node[] = [];

    // Chance (0-1) that any individual coin slot becomes a PayPal card
    // instead of a normal coin.
    @property
    paypalChance: number = 0.2;

    // Where the enemy appears — needs to stay well off-screen right so it
    // scrolls in instead of popping up mid-background.
    @property
    spawnXObstacle: number = 750;

    // The cone doesn't move at all, so it spawns already sitting at its
    // final on-screen spot instead of off-screen.
    @property
    spawnXCone: number = 260;

    // Money can spawn a bit closer in than a full obstacle since it's not a
    // threat, but still needs to clear the visible edge (~360-400 depending
    // on device aspect ratio) so it scrolls in instead of popping into view.
    @property
    spawnXMoney: number = 600;

    // The finish line spawns closer in than a regular obstacle so it
    // doesn't take as long to scroll in and reach her.
    @property
    spawnXFinish: number = 450;

    @property
    itemGapX: number = 550;

    // Extra distance added on top of itemGapX when a cone/enemy is
    // immediately followed by another cone/enemy with no money group in
    // between — without it the two threats stay only itemGapX apart the
    // whole way in, leaving no time to jump one and then the other.
    @property
    obstacleBufferX: number = 450;

    // Extra distance added on top of itemGapX when a cone/enemy is
    // immediately followed by money. Money spawns much closer in
    // (spawnXMoney) than a cone/enemy does (spawnXObstacle), so itemGapX
    // alone barely covers that head start — the coins end up landing right
    // on top of the obstacle instead of a beat after it.
    @property
    moneyAfterObstacleBufferX: number = 180;

    // Extra distance added on top of itemGapX after the very last item in
    // SEQUENCE (currently the final cone) before the finish line spawns.
    @property
    finishLineDelayX: number = 550;

    // Horizontal gap between coins when there are only 1-2 in the group.
    @property
    coinSpacingXSingle: number = 250;

    // Horizontal gap between coins in a bigger (3+) pyramid/staircase group.
    @property
    coinSpacingXGroup: number = 90;

    @property
    coinStepHeight: number = 55;

    // Base height for a small group (1-2 coins in a flat row).
    @property
    coinBaseYSingle: number = -400;

    // Base height a bigger group (3+ coins) rises from before the
    // pyramid/staircase steps on top of it.
    @property
    coinBaseYGroup: number = -350;

    @property
    worldSpeed: number = 300;

    @property(Node)
    finishLine: Node | null = null;

    // Well ahead of her fixed standing X (-312) — the game freezes early,
    // while the yellow tape is still some distance away from her.
    @property
    finishTriggerX: number = -200;

    // The looping background-music AudioSource — stopped the instant she
    // crosses the finish line, then reused to play winSound as a one-shot
    // on top (same node PlayerController already stops on a fatal hit).
    @property(AudioSource)
    bgMusic: AudioSource | null = null;

    @property(AudioClip)
    winSound: AudioClip | null = null;

    // "Congratulations! / Choose your reward!" popup shown once she
    // crosses the finish line — the win-side counterpart of PlayerController's
    // fail popup.
    @property(Node)
    winBanner: Node | null = null;

    // Individual confetti-piece art — a random one is picked for each
    // burst piece so the shower looks varied instead of one shape repeated.
    @property([SpriteFrame])
    confettiFrames: SpriteFrame[] = [];

    // Pre-placed, initially-inactive nodes reused every time she wins
    // instead of instantiating/destroying nodes at runtime.
    @property([Node])
    confettiPool: Node[] = [];

    // True once every item in SEQUENCE has been spawned (the finish line
    // gets sent in right after).
    complete: boolean = false;

    // True once she's actually crossed the finish line.
    finished: boolean = false;

    private index: number = 0;
    private distanceUntilNext: number = 0;
    private coinCursor: number = 0;
    private paypalCursor: number = 0;
    private finishLineSpawned: boolean = false;

    onLoad() {
        if (!this.coneTemplate) warn('[LevelSequence] Cone Template is not set — cone will never appear.');
        if (!this.enemyTemplate) warn('[LevelSequence] Enemy Template is not set — enemy will never appear.');
        if (this.coinPool.length === 0) warn('[LevelSequence] Coin Pool is empty — money will never appear.');
        if (this.finishLine) this.finishLine.active = false;
    }

    update(dt: number) {
        if (!GameManager.started || GameManager.paused || this.finished) return;

        if (this.complete) {
            this.updateFinishLine(dt);
            return;
        }

        this.distanceUntilNext -= this.worldSpeed * dt;
        if (this.distanceUntilNext > 0) return;

        if (this.index >= SEQUENCE.length) {
            this.complete = true;
            console.log('[LevelSequence] sequence complete, finish line incoming. finishLine set? ', !!this.finishLine);
            return;
        }

        const item = SEQUENCE[this.index];
        this.index++;
        console.log('[LevelSequence] spawned item', this.index, '/', SEQUENCE.length, item.type, 'nextGap=', this.itemGapX + this.nextObstacleBuffer());

        if (item.type === 'cone') {
            this.spawnCone();
            this.distanceUntilNext = this.itemGapX + this.nextObstacleBuffer();
        } else if (item.type === 'enemy') {
            this.spawnEnemy();
            this.distanceUntilNext = this.itemGapX + this.nextObstacleBuffer();
        } else {
            const groupWidth = this.spawnMoney(item.count, item.pyramid);
            this.distanceUntilNext = this.itemGapX + groupWidth;
        }
    }

    private updateFinishLine(dt: number) {
        if (!this.finishLine) return;

        if (!this.finishLineSpawned) {
            this.finishLineSpawned = true;
            this.finishLine.setPosition(this.spawnXFinish, this.finishLine.position.y, 0);
            this.finishLine.active = true;
            console.log('[LevelSequence] finish line spawned at x=', this.spawnXFinish, 'active=', this.finishLine.active);
        }

        const pos = this.finishLine.position;
        this.finishLine.setPosition(pos.x - this.worldSpeed * dt, pos.y, 0);

        if (pos.x <= this.finishTriggerX) {
            this.finished = true;
            // She made it — freeze the world the same way a fatal hit does,
            // but pop the win reward screen instead of the fail one.
            GameManager.started = false;
            GameManager.gameOver = true;
            if (this.bgMusic) {
                this.bgMusic.stop();
                if (this.winSound) this.bgMusic.playOneShot(this.winSound);
            }
            if (this.winBanner) {
                this.winBanner.active = true;
                this.winBanner.setScale(0, 0, 1);
                tween(this.winBanner)
                    .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
            }
            this.burstConfetti();
        }
    }

    // Fires every pooled piece from the bottom-left/bottom-right corners
    // toward the upper middle, then lets it tumble back down and fade —
    // a plain-tween substitute for a particle system since each piece
    // uses one of several distinct source images instead of one texture.
    private burstConfetti() {
        if (this.confettiPool.length === 0 || this.confettiFrames.length === 0) return;

        this.confettiPool.forEach((piece, i) => {
            const fromLeft = i % 2 === 0;
            const originX = fromLeft ? -380 : 380;
            const originY = -560;

            const sprite = piece.getComponent(Sprite);
            if (sprite) sprite.spriteFrame = this.confettiFrames[Math.floor(Math.random() * this.confettiFrames.length)];

            let opacity = piece.getComponent(UIOpacity);
            if (!opacity) opacity = piece.addComponent(UIOpacity);

            Tween.stopAllByTarget(piece);
            Tween.stopAllByTarget(opacity);
            piece.setPosition(originX, originY, 0);
            piece.angle = Math.random() * 360;
            piece.setScale(1, 1, 1);
            piece.active = true;
            opacity.opacity = 255;

            // Random landing spot spread across the upper half of the
            // screen so the two bursts overlap in the middle instead of
            // staying as two separate clumps on either side.
            const peakX = (fromLeft ? -1 : 1) * (40 + Math.random() * 260) + (Math.random() - 0.5) * 200;
            const peakY = 250 + Math.random() * 400;
            const fallX = peakX + (Math.random() - 0.5) * 150;
            const fallY = peakY - (450 + Math.random() * 350);
            const riseDuration = 0.5 + Math.random() * 0.4;
            const fallDuration = 0.9 + Math.random() * 0.6;
            const spinDelta = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720);
            const startDelay = Math.random() * 0.3;

            tween(piece)
                .delay(startDelay)
                .to(riseDuration, {
                    position: new Vec3(peakX, peakY, 0),
                    angle: piece.angle + spinDelta * (riseDuration / (riseDuration + fallDuration))
                }, { easing: 'quadOut' })
                .to(fallDuration, {
                    position: new Vec3(fallX, fallY, 0),
                    angle: piece.angle + spinDelta
                }, { easing: 'quadIn' })
                .call(() => { piece.active = false; })
                .start();

            tween(opacity)
                .delay(startDelay + riseDuration + fallDuration * 0.6)
                .to(fallDuration * 0.4, { opacity: 0 })
                .start();
        });
    }

    // Looks at the item right after the one that was just spawned — a
    // cone/enemy followed by another cone/enemy needs obstacleBufferX so
    // there's time to jump both; followed by money needs
    // moneyAfterObstacleBufferX so the coins don't spawn right on top of
    // the obstacle's own head start; nothing left (the finish line is next)
    // needs finishLineDelayX so she gets a clear run before it shows up.
    private nextObstacleBuffer(): number {
        const next = SEQUENCE[this.index];
        if (next && (next.type === 'cone' || next.type === 'enemy')) {
            return this.obstacleBufferX;
        }
        if (next && next.type === 'money') {
            return this.moneyAfterObstacleBufferX;
        }
        if (!next) {
            return this.finishLineDelayX;
        }
        return 0;
    }

    private spawnCone() {
        if (!this.coneTemplate) return;
        const ctrl = this.coneTemplate.getComponent(ObstacleController);
        if (ctrl) {
            ctrl.spawnAt(this.spawnXObstacle);
        } else {
            this.coneTemplate.setPosition(this.spawnXObstacle, this.coneTemplate.position.y, 0);
            this.coneTemplate.active = true;
        }
    }

    private spawnEnemy() {
        if (!this.enemyTemplate) return;
        this.enemyTemplate.setPosition(this.spawnXObstacle, this.enemyTemplate.position.y, 0);
        this.enemyTemplate.active = true;
    }

    // Returns the horizontal width the group occupies, so the caller can
    // add it on top of the normal item gap and avoid crowding the next one.
    private spawnMoney(count: number, pyramid: boolean): number {
        if (this.coinPool.length === 0) return 0;

        const isSmallGroup = count <= 2;
        const baseY = isSmallGroup ? this.coinBaseYSingle : this.coinBaseYGroup;
        const spacingX = isSmallGroup ? this.coinSpacingXSingle : this.coinSpacingXGroup;

        for (let i = 0; i < count; i++) {
            const usePaypal = this.paypalPool.length > 0 && Math.random() < this.paypalChance;
            let collectible: Collectible | null = null;
            if (usePaypal) {
                const card = this.paypalPool[this.paypalCursor % this.paypalPool.length];
                this.paypalCursor++;
                collectible = card.getComponent(Collectible);
            } else {
                const coin = this.coinPool[this.coinCursor % this.coinPool.length];
                this.coinCursor++;
                collectible = coin.getComponent(Collectible);
            }
            if (!collectible) continue;

            // Staircase up to the middle coin, then back down — e.g. for 5
            // coins: levels 0,1,2,1,0.
            const level = pyramid ? Math.min(i, count - 1 - i) : 0;
            const x = this.spawnXMoney + i * spacingX;
            const y = baseY + level * this.coinStepHeight;
            collectible.spawnAt(x, y);
        }

        return (count - 1) * spacingX;
    }
}
