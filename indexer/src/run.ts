import { config } from "dotenv";
import { resolve } from "node:path";
import { connectDatabase } from "@pactflow/db/client";
import { ProtocolIndexer } from "./index";
config({path:[resolve(process.cwd(),".env.local"),resolve(process.cwd(),"../.env.local")],quiet:true});
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");
const {db,close}=connectDatabase(process.env.DATABASE_URL);
try {const indexer=new ProtocolIndexer(db,process.env.MONAD_TESTNET_RPC_URL);console.log(await indexer.sync(process.argv.includes("--reindex")));}finally{await close();}
