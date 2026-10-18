import webview from '@ohos.web.webview';
import picker from '@ohos.file.picker';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import common from '@ohos.app.ability.common';
import emitter from '@ohos.events.emitter';

const LIMIT: number = 1048576;
class FileBridge {
  controller: webview.WebviewController;
  context: common.UIAbilityContext;
  busy: boolean = false;
  constructor(controller: webview.WebviewController, context: common.UIAbilityContext) {
    this.controller = controller;
    this.context = context;
  }
  notice(message: string): void {
    this.controller.runJavaScript(`window.passlessNotice(${JSON.stringify(message)})`).catch(() => {});
  }
  chooseFile(kind: string): void {
    if (this.busy || (kind !== 'key' && kind !== 'credential')) return;
    this.busy = true;
    this.readSelection(kind).finally(() => { this.busy = false; });
  }
  async readSelection(kind: string): Promise<void> {
    try {
      const selector = new picker.DocumentViewPicker(this.context);
      const options = new picker.DocumentSelectOptions();
      options.maxSelectNumber = 1;
      const paths = await selector.select(options);
      if (paths.length !== 1) return;
      const file = fs.openSync(paths[0], fs.OpenMode.READ_ONLY);
      let bytes = new Uint8Array(0);
      try {
        const size = fs.statSync(file.fd).size;
        if (size < 1 || size > LIMIT) throw new Error('File size limit');
        bytes = new Uint8Array(size);
        let offset = 0;
        while (offset < size) {
          const chunk = new ArrayBuffer(size - offset);
          const count = fs.readSync(file.fd, chunk);
          if (count < 1) throw new Error('Truncated file');
          bytes.set(new Uint8Array(chunk, 0, count), offset);
          new Uint8Array(chunk).fill(0);
          offset += count;
        }
        const encoded = new util.Base64Helper().encodeToStringSync(bytes);
        await this.controller.runJavaScript(`window.passlessReceive(${JSON.stringify(kind)},${JSON.stringify(encoded)})`);
      } finally { bytes.fill(0); fs.closeSync(file); }
    } catch { this.notice('Import failed. Choose a readable file under 1 MiB.'); }
  }
  exportFile(name: string, encoded: string): void {
    if (this.busy || encoded.length > 1400000 || (name !== 'password.gpg' && name !== 'credential.gpg')) return;
    this.busy = true;
    this.saveSelection(name, encoded).finally(() => { this.busy = false; });
  }
  async saveSelection(name: string, encoded: string): Promise<void> {
    let bytes = new Uint8Array(0);
    try {
      bytes = new util.Base64Helper().decodeSync(encoded);
      if (bytes.length < 1 || bytes.length > LIMIT) throw new Error('File size limit');
      const selector = new picker.DocumentViewPicker(this.context);
      const options = new picker.DocumentSaveOptions();
      options.newFileNames = [name];
      const paths = await selector.save(options);
      if (paths.length !== 1) return;
      const file = fs.openSync(paths[0], fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      try {
        let offset = 0;
        while (offset < bytes.length) {
          const chunk = bytes.slice(offset);
          const count = fs.writeSync(file.fd, chunk.buffer);
          chunk.fill(0);
          if (count < 1) throw new Error('Short write');
          offset += count;
        }
        fs.fsyncSync(file.fd);
      } finally { fs.closeSync(file); }
      this.notice('Encrypted file exported.');
    } catch { this.notice('Encrypted export failed.'); }
    finally { bytes.fill(0); }
  }
}
@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  bridge: FileBridge = new FileBridge(this.controller, getContext(this) as common.UIAbilityContext);
  aboutToAppear(): void {
    emitter.on({ eventId: 1001 }, () => {
      this.controller.runJavaScript('window.passlessLock && window.passlessLock()').catch(() => {});
    });
  }
  aboutToDisappear(): void { emitter.off(1001); }
  build() {
    Column() {
      Web({ src: $rawfile('web/index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(false)
        .databaseAccess(false)
        .fileAccess(false)
        .javaScriptProxy({ object: this.bridge, name: 'Passless', methodList: ['chooseFile', 'exportFile'], controller: this.controller })
        .onLoadIntercept((event) => {
          const url = event.data.getRequestUrl();
          return !(url.startsWith('resource://rawfile/') || url.startsWith('file:///data/storage/el1/bundle/entry/resources/rawfile/'));
        })
        .width('100%').height('100%')
    }.width('100%').height('100%')
  }
}
