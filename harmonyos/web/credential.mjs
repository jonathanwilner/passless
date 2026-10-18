// Strict bounded CBOR reader for APS/soft-fido2 portable credentials.
// Secrets stay in typed arrays; callers must wipe the decoded tree after use.
export function wipe(value) {
  if (value instanceof Uint8Array) value.fill(0);
  else if (Array.isArray(value)) { value.forEach(wipe); value.fill(0); }
  else if (value instanceof Map) { for (const v of value.values()) wipe(v); value.clear(); }
}
export function decodeCbor(input) {
  if (!(input instanceof Uint8Array) || input.length > 1024 * 1024) throw Error('CBOR size limit');
  let offset = 0, nodes = 0;
  const byte = () => { if (offset >= input.length) throw Error('Truncated CBOR'); return input[offset++]; };
  const length = (n) => {
    if (n < 24) return n;
    const count = {24:1,25:2,26:4,27:8}[n];
    if (!count) throw Error('Unsupported CBOR length');
    let value = 0;
    for (let i=0;i<count;i++) { value = value * 256 + byte(); if (!Number.isSafeInteger(value)) throw Error('CBOR integer overflow'); }
    return value;
  };
  function read(depth) {
    if (depth > 16 || ++nodes > 20000) throw Error('CBOR complexity limit');
    const head=byte(), type=head>>5, info=head&31;
    if (type===7) { if(info===20)return false;if(info===21)return true;if(info===22)return null;throw Error('Unsupported CBOR simple value'); }
    const size=length(info);
    if(type===0)return size;if(type===1)return -1-size;
    if(type===2||type===3){if(size>input.length-offset)throw Error('Truncated CBOR string');const data=input.slice(offset,offset+size);offset+=size;if(type===2)return data;return new TextDecoder('utf-8',{fatal:true}).decode(data);}
    if(size>20000)throw Error('CBOR collection limit');
    if(type===4){const out=[];for(let i=0;i<size;i++)out.push(read(depth+1));return out;}
    if(type===5){const out=new Map();for(let i=0;i<size;i++){const key=read(depth+1);if(typeof key!=='string'||out.has(key))throw Error('Invalid or duplicate CBOR map key');out.set(key,read(depth+1));}return out;}
    throw Error('Unsupported CBOR type');
  }
  const result=read(0);if(offset!==input.length){wipe(result);throw Error('Trailing CBOR data');}return result;
}
export function credentialMetadata(input) {
  const map=decodeCbor(input);
  try {
    if(!(map instanceof Map))throw Error('Credential must be a map');
    const bytes=(v,min,max)=>{if(!(v instanceof Uint8Array)&&!Array.isArray(v))throw Error('Invalid byte field');if(v.length<min||v.length>max||!Array.from(v).every(x=>Number.isInteger(x)&&x>=0&&x<=255))throw Error('Invalid byte field');return v;};
    bytes(map.get('id'),1,1024); bytes(map.get('private_key'),1,32);
    if(![-7,-8].includes(map.get('alg')))throw Error('Unsupported credential algorithm');
    const count=map.get('sign_count');if(!Number.isInteger(count)||count<0||count>0xffffffff)throw Error('Invalid signature counter');
    const rp=map.get('rp'), user=map.get('user');
    if(!(rp instanceof Map)||typeof rp.get('id')!=='string'||!rp.get('id')||!(user instanceof Map))throw Error('Invalid relying party or user');
    bytes(user.get('id'),1,64);
    let backup='eligible';const state=map.get('backup_state'), eligible=map.get('backup_eligible');
    if(typeof state==='string'){if(map.has('backup_eligible')||!['notEligible','eligible','backedUp'].includes(state))throw Error('Invalid backup state');backup=state;}
    else if(map.has('backup_state')||map.has('backup_eligible')){if((map.has('backup_state')&&typeof state!=='boolean')||(map.has('backup_eligible')&&typeof eligible!=='boolean')||(eligible===false&&state===true))throw Error('Invalid legacy backup state');backup=eligible===false?'notEligible':state===true?'backedUp':'eligible';}
    return {rp:rp.get('id'),user:typeof user.get('name')==='string'?user.get('name'):'',signCount:count,backupState:backup};
  } finally { wipe(map); }
}
