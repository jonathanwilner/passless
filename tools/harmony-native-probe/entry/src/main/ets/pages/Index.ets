import { fido2 } from '@kit.OnlineAuthenticationKit';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { fileIo } from '@kit.CoreFileKit';

interface ProbeRequest {
  challenge: string;
  rpId: string;
  userId: string;
  session_id: string;
  operation: string;
}

@Entry
@Component
struct Index {
  @State report: string = 'Native FIDO2 probe ready';
  @State rpId: string = 'tv.thewilners.com';
  @State busy: boolean = false;
  @StorageLink('probeRequest') probeRequest: string = '';
  private credential: Uint8Array = new Uint8Array();
  private decode(value: string): Uint8Array {
    let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4 !== 0) { normalized += '='; }
    return new util.Base64Helper().decodeSync(normalized);
  }
  private context(): common.UIAbilityContext {
    return this.getUIContext().getHostContext() as common.UIAbilityContext;
  }
  private record(operation: string, detail: string): void {
    const line = JSON.stringify({ time: new Date().toISOString(), operation: operation, detail: detail });
    this.report += '\n' + line;
    console.info('PASSLESS_NATIVE ' + line);
    const file = fileIo.openSync(this.context().filesDir + '/native-probe.jsonl',
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.APPEND);
    fileIo.writeSync(file.fd, line + '\n');
    fileIo.closeSync(file);
  }
  private failure(operation: string, error: BusinessError, start: number): void {
    this.record(operation, JSON.stringify({ code: error.code, message: error.message, elapsedMs: Date.now() - start }));
  }
  aboutToAppear(): void { this.probe(); }
  private async probe(): Promise<void> {
    if (this.busy) { return; }
    this.busy = true;
    let start = Date.now();
    try {
      const caps = await fido2.getClientCapabilities(this.context());
      const rows: string[] = [];
      caps.forEach((value: boolean, key: fido2.ClientCapability) => { rows.push(key + '=' + value); });
      this.record('getClientCapabilities', rows.join('\n'));
    } catch (error) { this.failure('getClientCapabilities', error as BusinessError, start); }
    start = Date.now();
    try { this.record('getPlatformAuthenticators', JSON.stringify(await fido2.getPlatformAuthenticators(this.context()))); }
    catch (error) { this.failure('getPlatformAuthenticators', error as BusinessError, start); }
    this.busy = false;
  }
  private async ceremony(register: boolean): Promise<void> {
    if (this.busy) { return; }
    this.busy = true;
    const start = Date.now();
    const operation = register ? 'register' : 'authenticate';
    this.record(operation + '.begin', this.rpId);
    try {
      let challenge = (await cryptoFramework.createRandom().generateRandom(32)).data;
      let userId = new Uint8Array([112,114,111,98,101]);
      if (this.probeRequest.length > 0) {
        const encoded = new util.Base64Helper().decodeSync(this.probeRequest);
        const request = JSON.parse(new util.TextDecoder().decodeToString(encoded)) as ProbeRequest;
        if (request.operation !== operation || request.rpId !== this.rpId) {
          throw new Error('Request operation or RP does not match visible controls');
        }
        challenge = this.decode(request.challenge);
        userId = this.decode(request.userId);
        this.record(operation + '.session', request.session_id);
        this.probeRequest = '';
      }
      if (register) {
        const result = await fido2.register(this.context(), { publicKey: {
          rp: { id: this.rpId, name: 'Passless synthetic diagnostic' },
          user: { id: userId, name: 'native-testuser', displayName: 'Synthetic native test' },
          challenge: challenge,
          pubKeyCredParams: [{ type: fido2.PublicKeyCredentialType.PUBLIC_KEY, alg: fido2.Algorithm.ES256 }],
          timeout: 180000,
          authenticatorSelection: { residentKey: fido2.ResidentKeyRequirement.REQUIRED,
            userVerification: fido2.UserVerificationRequirement.PREFERRED }
        }});
        this.credential = result.rawId;
        this.record(operation + '.response', JSON.stringify(result.registrationResponseJson));
        this.record(operation + '.clientData', new util.TextDecoder().decodeToString(result.response.clientDataJson));
      } else {
        const result = await fido2.authenticate(this.context(), { publicKey: {
          challenge: challenge, rpId: this.rpId, timeout: 180000,
          allowCredentials: this.credential.length > 0 ? [{ type: fido2.PublicKeyCredentialType.PUBLIC_KEY, id: this.credential }] : [],
          userVerification: fido2.UserVerificationRequirement.PREFERRED
        }});
        this.record(operation + '.response', JSON.stringify(result.authenticationResponseJson));
        this.record(operation + '.clientData', new util.TextDecoder().decodeToString(result.response.clientDataJson));
      }
      this.record(operation + '.complete', 'Diagnostic response only; not server verified');
    } catch (error) { this.failure(operation, error as BusinessError, start); }
    this.busy = false;
  }
  build() {
    Column({ space: 12 }) {
      Text('Passless Native Probe').fontSize(25).fontWeight(FontWeight.Bold)
      Text('Synthetic credentials only. Native API diagnostics.').fontSize(16)
      TextInput({ text: this.rpId }).onChange((value: string) => { this.rpId = value; }).enabled(!this.busy)
      Button('Probe capabilities').onClick(() => { this.probe(); }).enabled(!this.busy)
      Row({ space: 12 }) {
        Button('Register test').onClick(() => { this.ceremony(true); }).enabled(!this.busy)
        Button('Authenticate').onClick(() => { this.ceremony(false); }).enabled(!this.busy)
      }
      Scroll() { Text(this.report).fontSize(14).width('100%').copyOption(CopyOptions.LocalDevice) }.layoutWeight(1)
    }.padding(24).width('100%').height('100%')
  }
}
