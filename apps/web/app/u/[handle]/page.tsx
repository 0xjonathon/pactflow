import { ProfilePage } from "../../../components/ProductPages";
export default async function Page({params}:{params:Promise<{handle:string}>}) { const value=await params; return <ProfilePage handle={value.handle} />; }
