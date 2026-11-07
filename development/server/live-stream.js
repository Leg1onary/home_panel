// Common server-side poller: one interval for all SSE clients.
export class LiveFeed{
 constructor({ha}){
  this.ha=ha;this.clients=new Set();this.last=new Map();this.states=[];this.timer=null;this.hb=null
  if(ha.enabled){
   this.poll()
   this.timer=setInterval(()=>this.poll(),5000);this.timer.unref()
   this.hb=setInterval(()=>this.tick(),15000);this.hb.unref()
  }
 }
 send(client,event,data){
  if(client.res.destroyed||client.res.writableEnded)return this.clients.delete(client)
  try{client.res.write(`event: ${event}\ndata: ${data}\n\n`)}catch{this.clients.delete(client)}
 }
 broadcast(event,data){for(const client of [...this.clients])this.send(client,event,data)}
 async poll(){
  if(!this.ha.enabled)return
  let states
  try{states=await this.ha.states()}catch(error){this.broadcast('error',JSON.stringify({message:error.message}));return}
  const next=new Map(states.map(e=>[e.entity_id,JSON.stringify(e)]))
  const changed=states.filter(e=>this.last.get(e.entity_id)!==next.get(e.entity_id))
  this.last=next;this.states=states
  if(changed.length)this.broadcast('patch',JSON.stringify(changed))
 }
 subscribe(res){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'})
  const client={res};this.clients.add(client)
  if(!res.writableEnded)res.write(`event: snapshot\ndata: ${JSON.stringify({states:this.states})}\n\n`)
  res.on('close',()=>this.clients.delete(client))
  return client
 }
 tick(){for(const client of [...this.clients]){try{client.res.write(':hb\n\n')}catch{this.clients.delete(client)}}}
 stop(){clearInterval(this.timer);clearInterval(this.hb);this.timer=this.hb=null;this.clients.clear()}
}
