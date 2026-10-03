import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import Fastify from "fastify";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { PactFlowSdk } from "@pactflow/sdk";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as schema from "@pactflow/db";
import { registerProductRoutes, ProductError } from "./product";
test("authenticated marketplace, filtering and atomic proposal lifecycle",async()=>{
 const storage=new PGlite();await storage.exec(readFileSync(new URL('../../../packages/db/drizzle/0000_yielding_natasha_romanoff.sql',import.meta.url),'utf8'));await storage.exec(readFileSync(new URL('../../../packages/db/drizzle/0001_famous_vapor.sql',import.meta.url),'utf8'));
 const db=drizzle(storage,{schema}) as unknown as PactFlowDatabase;const app=Fastify();await registerProductRoutes(app,db,{} as PactFlowSdk);app.setErrorHandler((e,_r,reply)=>reply.code(e instanceof ProductError?e.statusCode:400).send({code:e instanceof ProductError?e.code:'INVALID_INPUT'}));
 const client=privateKeyToAccount(generatePrivateKey()),worker=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey());
 async function login(account:typeof client){const ch=(await app.inject({method:'POST',url:'/api/v1/auth/challenge',payload:{address:account.address}})).json();const signature=await account.signMessage({message:ch.message});const signed=await app.inject({method:'POST',url:'/api/v1/auth/verify',payload:{id:ch.id,signature}});assert.equal(signed.statusCode,200);assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/verify',payload:{id:ch.id,signature}})).statusCode,401);return signed.json();}
 try {const c=await login(client),w=await login(worker),o=await login(other);const h=(v:typeof c)=>({authorization:`Bearer ${v.token}`});const future=new Date(Date.now()+7*86400_000).toISOString();const payload={title:'Build a real dashboard',description:'Deliver a working analytics dashboard with useful navigation.',requirements:'Three metrics and wallet action',category:'Development',skills:['React'],budget:'10',deadline:future,milestones:[{title:'Delivery',amount:'10',dueAt:future}],verificationMode:'ClientOnly',policy:null,clientDeposit:'0.5',workerDeposit:'0'};
 assert.equal((await app.inject({method:'POST',url:'/api/v1/jobs',payload})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/v1/jobs',headers:h(c),payload:{...payload,milestones:[{title:'Delivery',amount:'9',dueAt:future}]}})).statusCode,400);
 const create=await app.inject({method:'POST',url:'/api/v1/jobs',headers:h(c),payload});assert.equal(create.statusCode,200);const j=create.json();assert.equal(j.fundsLocked,false);assert.equal(j.workerDeposit,'0');
 assert.equal((await app.inject({method:'POST',url:'/api/v1/jobs',headers:h(c),payload:{...payload,workerDeposit:'1'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/publish`,headers:h(w)})).statusCode,409);
 assert.equal((await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/publish`,headers:h(c)})).statusCode,200);
 assert.equal((await app.inject({url:'/api/v1/jobs?search=dashboard&category=Development&minBudget=5&maxBudget=20'})).json().total,1);
 assert.equal((await app.inject({url:'/api/v1/jobs?funding=locked'})).json().total,0);
 assert.equal((await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/invite`,headers:h(w),payload:{handle:o.user.handle}})).statusCode,403);
 for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/invite`,headers:h(c),payload:{handle:w.user.handle}})).statusCode,200);
 assert.equal((await app.inject({url:'/api/v1/notifications',headers:h(w)})).json().length,1);
 const application={message:'I will build the dashboard with reusable components.',estimatedDays:3,acceptBudget:true};
 assert.equal((await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/proposals`,headers:h(c),payload:application})).statusCode,403);
 const wp=(await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/proposals`,headers:h(w),payload:application})).json();const op=(await app.inject({method:'POST',url:`/api/v1/jobs/${j.id}/proposals`,headers:h(o),payload:application})).json();
 const accepted=await Promise.all([app.inject({method:'POST',url:`/api/v1/proposals/${wp.id}/accept`,headers:h(c)}),app.inject({method:'POST',url:`/api/v1/proposals/${op.id}/accept`,headers:h(c)})]);assert.deepEqual(accepted.map(r=>r.statusCode).sort(),[200,409]);
 const list=(await app.inject({url:`/api/v1/jobs/${j.id}/proposals`,headers:h(c)})).json();assert.equal(list.filter((p:{status:string})=>p.status==='ACCEPTED').length,1);assert.equal(list.filter((p:{status:string})=>p.status==='REJECTED').length,1);
 assert.equal((await app.inject({url:`/api/v1/jobs/${j.id}/pact-draft`,headers:h(c)})).json().job.status,'MATCHED');assert.equal((await app.inject({url:`/api/v1/jobs/${j.id}/pact-draft`,headers:h(w)})).statusCode,403);
 assert.equal((await app.inject({url:'/api/v1/notifications',headers:h(c)})).json().length,2);
 // A separate pending proposal may be withdrawn without affecting a match.
 const second=(await app.inject({method:'POST',url:'/api/v1/jobs',headers:h(c),payload:{...payload,title:'Another dashboard project'}})).json();await app.inject({method:'POST',url:`/api/v1/jobs/${second.id}/publish`,headers:h(c)});const pending=(await app.inject({method:'POST',url:`/api/v1/jobs/${second.id}/proposals`,headers:h(w),payload:application})).json();assert.equal((await app.inject({method:'POST',url:`/api/v1/proposals/${pending.id}/withdraw`,headers:h(w)})).json().status,'WITHDRAWN');
 }finally{await app.close();await storage.close();}
});
