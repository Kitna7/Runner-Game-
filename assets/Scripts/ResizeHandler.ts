import { _decorator, Component, view, ResolutionPolicy } from 'cc';
const { ccclass } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT;

@ccclass('ResizeHandler')
export class ResizeHandler extends Component {
    private lastFrameWidth = 0;
    private lastFrameHeight = 0;

    onLoad() {
        view.resizeWithBrowserSize(true);
        this.applyPolicy();
    }

    // Polled instead of hooked to a resize event: ad-network iframes don't
    // always fire a resize event when they change the slot's dimensions.
    update() {
        const frame = view.getFrameSize();
        if (frame.width !== this.lastFrameWidth || frame.height !== this.lastFrameHeight) {
            this.applyPolicy();
        }
    }

    private applyPolicy() {
        const frame = view.getFrameSize();
        this.lastFrameWidth = frame.width;
        this.lastFrameHeight = frame.height;
        if (frame.width === 0 || frame.height === 0) return;

        const screenAspect = frame.width / frame.height;

        // Screen wider than our portrait design (desktop, landscape ad slots):
        // fill the full height instead of letterboxing left/right — the tiled
        // background covers the extra width that becomes visible.
        // Screen narrower/taller (tall phones): keep showing the whole design.
        const policy = screenAspect > DESIGN_ASPECT
            ? ResolutionPolicy.FIXED_HEIGHT
            : ResolutionPolicy.SHOW_ALL;

        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, policy);
    }
}
