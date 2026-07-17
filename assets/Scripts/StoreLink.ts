import { _decorator, Component, Node, EventTouch, sys } from 'cc';
const { ccclass, property } = _decorator;

// Put on any "Install"/"Download" button — routes the tap to the right
// app-store listing for the device she's actually playing on instead of a
// single hardcoded link.
@ccclass('StoreLink')
export class StoreLink extends Component {
    @property
    androidUrl: string = 'https://play.google.com/store/apps/details?id=ae.goragaming.playoff.blocks.game.make.earn.money.rewarded';

    @property
    iosUrl: string = 'https://apps.apple.com/am/app/earn-real-money-playoff-games/id6444492155';

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this.onTap, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onTap, this);
    }

    private onTap(event: EventTouch) {
        // Anything that isn't iOS (desktop/testing included) falls back to
        // the Android listing — the two URLs are the only ones we have.
        const url = sys.os === sys.OS.IOS ? this.iosUrl : this.androidUrl;
        if (url) sys.openURL(url);
    }
}
