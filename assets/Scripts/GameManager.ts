export class GameManager {
    static started: boolean = false;
    static gameOver: boolean = false;
    static paused: boolean = false;
    static jumpHintShown: boolean = false;
    // True while the enemy has reached the jump-tutorial trigger point but
    // is waiting on her to collect enough coins first — PlayerController
    // checks this to hold it in place instead of letting it walk on.
    static enemyHeld: boolean = false;
    static money: number = 0;
    static moneyCollected: number = 0;
    static moneyToCollectBeforeJumpHint: number = 2;
    static lives: number = 3;
    static praiseOnCooldown: boolean = false;
    // How many coins/PayPals she's picked up back-to-back with no gap —
    // reset to 0 a short beat after the last pickup (see Collectible.ts),
    // so a single isolated coin doesn't count the same as a real cluster.
    static streakCount: number = 0;
}
