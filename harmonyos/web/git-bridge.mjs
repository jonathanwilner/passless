let sequence=0;
const pending=new Map();
export function clearGit(){
 window.PasslessGit?.clearSession();
 for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('Session locked'));}
 pending.clear();
}
export function gitRequest(method,path,body){
 return new Promise((resolve,reject)=>{
  if(!window.PasslessGit){reject(Error('Native GitHub transport unavailable'));return;}
  const id=++sequence;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Request timed out'));},35000);
  pending.set(id,{resolve,reject,timer});
  window.PasslessGit.request(id,method,path,body?JSON.stringify(body):'');
 });
}
window.passlessGitResponse=(id,status,body)=>{
 const entry=pending.get(id);if(!entry)return;
 clearTimeout(entry.timer);pending.delete(id);
 if(status<200||status>=300){entry.reject(Error('GitHub request refused or failed'));return;}
 try{entry.resolve(JSON.parse(body));}catch{entry.reject(Error('Invalid GitHub response'));}
};
