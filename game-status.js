// Safe scoreboard matching and status normalization for ESPN scoreboard records.
// ESPN is an unofficial public feed; unknown or ambiguous results never mean final.
function norm(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");}
function aliases(team){
  if(!team)return [];
  return [team.displayName,team.shortDisplayName,team.name,team.abbreviation,team.nickname]
    .map(norm).filter(Boolean);
}
function getCompetition(event){return event?.competitions?.[0]||event;}
function statusOf(event){
  const comp=getCompetition(event),s=comp?.status||event?.status||{},t=s.type||{};
  const state=String(t.state||"").toLowerCase(),name=String(t.name||"").toUpperCase();
  const detail=String(t.detail||t.description||s.detail||"").toLowerCase();
  if(t.completed===true && state==="post" && (name.includes("FINAL")||detail.includes("final")))
    return {status:"final",confirmedFinal:true,sourceStatus:name||detail};
  if(/postpon|suspend|delay|cancel/.test(name+" "+detail))
    return {status:"interrupted",confirmedFinal:false,sourceStatus:name||detail};
  if(state==="in"||/in progress|halftime|overtime|end of/.test(detail)||name.includes("IN_PROGRESS"))
    return {status:"in-progress",confirmedFinal:false,sourceStatus:name||detail};
  if(state==="pre"||name.includes("SCHEDULED")||/scheduled|not started/.test(detail))
    return {status:"scheduled",confirmedFinal:false,sourceStatus:name||detail};
  return {status:"unknown",confirmedFinal:false,sourceStatus:name||detail||"unknown"};
}
function matchGameStatus(events,record){
  const home=norm(record?.event?.homeTeam),away=norm(record?.event?.awayTeam);
  if(!home||!away||home===away||!Array.isArray(events))return {status:"unknown",confirmedFinal:false,reason:"invalid-record-or-scoreboard"};
  const matches=[];
  for(const event of events){
    const comp=getCompetition(event);
    const competitors=comp?.competitors||[];
    const homeTeam=competitors.find(x=>x.homeAway==="home")?.team;
    const awayTeam=competitors.find(x=>x.homeAway==="away")?.team;
    if(!homeTeam||!awayTeam)continue;
    const ha=aliases(homeTeam),aa=aliases(awayTeam);
    if(ha.includes(home)&&aa.includes(away)||ha.includes(away)&&aa.includes(home))
      matches.push(event);
  }
  if(matches.length!==1)return {status:"unknown",confirmedFinal:false,reason:matches.length?"ambiguous-match":"no-match"};
  return {...statusOf(matches[0]),eventId:matches[0].id||null};
}
module.exports={matchGameStatus,statusOf,norm};
