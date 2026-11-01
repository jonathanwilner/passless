import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
export default class EntryAbility extends UIAbility {
  onCreate(want: Want): void { this.request(want); }
  onNewWant(want: Want): void { this.request(want); }
  private request(want: Want): void {
    if (want.parameters && typeof want.parameters['probeRequest'] === 'string') {
      AppStorage.setOrCreate('probeRequest', want.parameters['probeRequest'] as string);
    }
  }
  onWindowStageCreate(stage: window.WindowStage): void { stage.loadContent('pages/Index'); }
}
