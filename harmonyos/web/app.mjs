import {unlockKey,decryptFile} from './crypto.mjs';
import {credentialMetadata} from './credential.mjs';
const el=id=>document.getElementById(id);
let armored='', key=null, encrypted=null, timer, epoch=0;
const status=s=>{el('status').textContent=s;};
function clearDisplay(){epoch++;el('secret').value='';el('details').textContent='';}
function lock(){clearDisplay();key=null;armored='';el('passphrase').value='';clearTimeout(timer);status('Locked. Import your OpenPGP secret key to unlock.');}
function touch(){clearTimeout(timer);timer=setTimeout(lock,60000);}
window.passlessReceive=async(kind,base64)=>{
 clearDisplay();
 if(kind==='key')lock();
 else {if(encrypted)encrypted.fill(0);encrypted=null;}
 try{
  const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  if(kind==='key'){armored=new TextDecoder('utf-8',{fatal:true}).decode(data);data.fill(0);status('Key loaded in memory. Enter its passphrase, then unlock.');}
  else {encrypted=data;status('Encrypted credential loaded. Unlock then inspect.');}
 }catch{status('Import failed. Choose a supported file under 1 MiB.');}
};
window.passlessNotice=message=>status(message);
const pick=kind=>{clearDisplay();if(kind==='key')lock();if(window.Passless)window.Passless.chooseFile(kind);else status('Open this app in the HarmonyOS shell to select files.');};
el('key').onclick=()=>pick('key');el('file').onclick=()=>pick('credential');
el('unlock').onclick=async()=>{const started=epoch;try{const unlocked=await unlockKey(armored,el('passphrase').value);if(started!==epoch)return;key=unlocked;armored='';el('passphrase').value='';touch();status('Unlocked for 60 seconds.');}catch{if(started!==epoch)return;key=null;el('passphrase').value='';status('Key unlock failed. Check the key and passphrase.');}};
el('lock').onclick=lock;
el('inspect').onclick=async()=>{
 clearDisplay();
 if(!key||!encrypted){status('Import and unlock a key, then import an encrypted credential.');return;}
 let plain;const started=epoch;
 try{plain=await decryptFile(encrypted,key);if(started!==epoch)return;touch();
  if(el('kind').value==='passkey'){const metadata=credentialMetadata(plain);el('details').textContent=`Site: ${metadata.rp}\nUser: ${metadata.user}\nCounter: ${metadata.signCount}\nBackup state: ${metadata.backupState}`;}
  else{el('secret').value=new TextDecoder('utf-8',{fatal:true}).decode(plain);}
  status('Decrypted in memory. Lock clears displayed data.');
 }catch{if(started!==epoch)return;status('Decryption or credential validation failed. No data was exported.');}
 finally{plain?.fill(0);}
};
function exportBytes(data,name){let raw='';for(const b of data)raw+=String.fromCharCode(b);if(window.Passless)window.Passless.exportFile(name,btoa(raw));else status('Export requires the HarmonyOS shell.');}
el('export').onclick=()=>{if(encrypted)exportBytes(encrypted,'credential.gpg');else status('Import an encrypted file first.');};
document.addEventListener('visibilitychange',()=>{if(document.hidden)lock();});
window.passlessLock=lock;lock();
