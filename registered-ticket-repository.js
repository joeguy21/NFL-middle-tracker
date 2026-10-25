"use strict";
const {ticketFingerprint}=require("./ticket-registration");
function createRegisteredTicketRepository(pool){
 if(!pool||typeof pool.connect!=="function")throw new TypeError("PostgreSQL pool required");
 return Object.freeze({async register(principalId,record,originalTicket){
  if(typeof principalId!=="string"||!principalId||!record||!originalTicket)throw new TypeError("Authenticated principal and validated ticket required");
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   await c.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",[principalId,record.id]);
   const prior=await c.query("SELECT ticket_snapshot FROM registered_tickets WHERE principal_id=$1 AND ticket_id=$2 FOR UPDATE",[principalId,record.id]);
   if(prior.rows.length){
    const outcome=ticketFingerprint(prior.rows[0].ticket_snapshot)===ticketFingerprint(originalTicket)
     ?{ok:true,action:"no-op"}:{ok:false,action:"conflict",reason:"accepted-ticket-changed"};
    await c.query("COMMIT");return outcome;
   }
   await c.query(`INSERT INTO registered_tickets
    (principal_id,ticket_id,event_id,market_type,team_code,opponent_code,handicap,accepted_american_odds,stake,book,ticket_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [principalId,record.id,record.gameId,record.marketType,record.team,record.opp,record.spread,record.odds,record.stake,record.book,JSON.stringify(originalTicket)]);
   await c.query("COMMIT");return {ok:true,action:"inserted"};
  }catch(e){try{await c.query("ROLLBACK")}catch{}throw e}finally{c.release()}
 }});
}
module.exports={createRegisteredTicketRepository};
