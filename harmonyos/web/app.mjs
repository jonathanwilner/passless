import {unlockKey,decryptFile,encryptPreservingRecipients} from './crypto.mjs';
import {credentialMetadata} from './credential.mjs';
const el=id=>document.getElementById(id);
let armored='', key=null, encrypted=null, timer, epoch=0, policy='', publicKeys='', passwordReady=false;
const status=s=>{el('status').textContent=s;};
function clearDisplay(){epoch++;passwordReady=false;el('secret').value='';el('details').textContent='';}
function lock(){clearDisplay();key=null;armored='';el('passphrase').value='';clearTimeout(timer);status('Locked. Import your OpenPGP secret key to unlock.');}
function touch(){clearTimeout(timer);timer=setTimeout(lock,60000);}
window.passlessReceive=async(kind,base64)=>{
 clearDisplay();
 if(kind==='policy')policy='';if(kind==='public')publicKeys='';
 if(kind==='key')lock();
 else if(kind==='credential'){if(encrypted)encrypted.fill(0);encrypted=null;}
 try{
  const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  if(kind==='key'){armored=new TextDecoder('utf-8',{fatal:true}).decode(data);data.fill(0);status('Key loaded in memory. Enter its passphrase, then unlock.');}
  else if(kind==='policy'||kind==='public'){const text=new TextDecoder('utf-8',{fatal:true}).decode(data);data.fill(0);if(kind==='policy')policy=text;else publicKeys=text;status('Recipient input loaded. Decrypt the password again before editing.');}
  else {encrypted=data;status('Encrypted credential loaded. Unlock then inspect.');}
 }catch{status('Import failed. Choose a supported file under 1 MiB.');}
};
window.passlessNotice=message=>status(message);
const pick=kind=>{clearDisplay();if(kind==='key')lock();if(window.Passless)window.Passless.chooseFile(kind);else status('Open this app in the HarmonyOS shell to select files.');};
el('key').onclick=()=>pick('key');el('file').onclick=()=>pick('credential');
el('policy').onclick=()=>pick('policy');el('public').onclick=()=>pick('public');
el('unlock').onclick=async()=>{const started=epoch;try{const unlocked=await unlockKey(armored,el('passphrase').value);if(started!==epoch)return;key=unlocked;armored='';el('passphrase').value='';touch();status('Unlocked for 60 seconds.');}catch{if(started!==epoch)return;key=null;el('passphrase').value='';status('Key unlock failed. Check the key and passphrase.');}};
el('lock').onclick=lock;
el('inspect').onclick=async()=>{
 clearDisplay();
 if(!key||!encrypted){status('Import and unlock a key, then import an encrypted credential.');return;}
 let plain;const started=epoch;
 try{plain=await decryptFile(encrypted,key);if(started!==epoch)return;touch();
  if(el('kind').value==='passkey'){const metadata=credentialMetadata(plain);el('details').textContent=`Site: ${metadata.rp}\nUser: ${metadata.user}\nCounter: ${metadata.signCount}\nBackup state: ${metadata.backupState}`;}
  else{passwordReady=true;el('secret').value=new TextDecoder('utf-8',{fatal:true}).decode(plain);}
  status('Decrypted in memory. Lock clears displayed data.');
 }catch{if(started!==epoch)return;status('Decryption or credential validation failed. No data was exported.');}
 finally{plain?.fill(0);}
};
function exportBytes(data,name){let raw='';for(const b of data)raw+=String.fromCharCode(b);if(window.Passless)window.Passless.exportFile(name,btoa(raw));else status('Export requires the HarmonyOS shell.');}
el('export').onclick=()=>{if(encrypted)exportBytes(encrypted,'credential.gpg');else status('Import an encrypted file first.');};
el('save').onclick=async()=>{
 if(!passwordReady||!key||!encrypted||!policy||!publicKeys){status('Import the effective .gpg-id policy and public keys, then decrypt a password before editing.');return;}
 const started=epoch;const plain=new TextEncoder().encode(el('secret').value);let result;
 try{result=await encryptPreservingRecipients(plain,encrypted,policy,publicKeys);if(started!==epoch)return;exportBytes(result,'updated-password.gpg');status('Encrypted with every original and policy recipient.');}
 catch{if(started===epoch)status('Export refused. Check full fingerprints, public keys and complete original recipient coverage.');}
 finally{plain.fill(0);result?.fill(0);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)lock();});
window.passlessLock=lock;lock();
