import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';
import emitter from '@ohos.events.emitter';
export default class EntryAbility extends UIAbility {
  onWindowStageCreate(stage: window.WindowStage): void { stage.loadContent('pages/Index'); }
  onBackground(): void { emitter.emit({ eventId: 1001 }); }
}
