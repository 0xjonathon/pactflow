import { JobDetailPage } from "../../../components/ProductPages";
export default async function Page({params}:{params:Promise<{id:string}>}) { const value=await params; return <JobDetailPage id={value.id} />; }
