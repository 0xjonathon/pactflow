export type BriefFields={title:string;description:string;requirements:string;skills:string;budget:string;deadline:string;verificationMode:string;clientDeposit:string;url:string;performance:string;minScore:string};
export type BriefIssue={field:string;code:string;step:number};
export function validateBrief(f:BriefFields,milestones:Array<{title:string;amount:string;dueAt:string}>,step?:number):BriefIssue[]{
 const issues:BriefIssue[]=[];const add=(field:string,code:string,n:number)=>{if(step===undefined||step===n)issues.push({field,code,step:n});};
 if(f.title.trim().length<5||f.title.trim().length>160)add('title','titleLength',1);
 if(f.description.trim().length<20||f.description.trim().length>12000)add('description','descriptionLength',1);
 if(f.requirements.length>8000)add('requirements','requirementsLength',1);
 const skills=f.skills.split(/[,，]/).map(v=>v.trim()).filter(Boolean);if(skills.length>12||skills.some(v=>v.length>40))add('skills','skillsLength',1);
 const validAmount=(v:string)=>/^\d+(\.\d{1,6})?$/.test(v)&&Number(v)<=1_000_000;
 const units=(v:string)=>{const [a,b='']=v.split('.');return BigInt(a)*1_000_000n+BigInt(b.padEnd(6,'0'));};
 if(!validAmount(f.budget)||Number(f.budget)<=0)add('budget','positiveAmount',2);
 const end=Date.parse(f.deadline);if(!Number.isFinite(end)||end<=Date.now()+3600_000)add('deadline','futureDeadline',2);
 if(milestones.length<1||milestones.length>32)add('milestones','milestoneCount',2);
 milestones.forEach((m,i)=>{if(!m.title.trim()||m.title.length>160)add(`milestones.${i}.title`,'milestoneTitle',2);if(!validAmount(m.amount)||Number(m.amount)<=0)add(`milestones.${i}.amount`,'positiveAmount',2);const due=Date.parse(m.dueAt);if(!Number.isFinite(due)||due<=Date.now()+3600_000)add(`milestones.${i}.dueAt`,'futureDeadline',2);else if(due>end)add(`milestones.${i}.dueAt`,'beforeDeadline',2);else if(i&&due<=Date.parse(milestones[i-1].dueAt))add(`milestones.${i}.dueAt`,'orderedDeadlines',2);});
 if(validAmount(f.budget)&&milestones.every(m=>validAmount(m.amount))&&milestones.reduce((sum,m)=>sum+units(m.amount),0n)!==units(f.budget))add('milestones','milestoneTotal',2);
 if(f.verificationMode!=='ClientOnly'){try{const url=new URL(f.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw 0;}catch{add('url','websiteUrl',3);}if(!f.performance||!Number.isFinite(Number(f.performance))||!Number.isInteger(Number(f.performance))||Number(f.performance)<0||Number(f.performance)>100)add('performance','scoreRange',3);if(!f.minScore||!Number.isInteger(Number(f.minScore))||Number(f.minScore)<0||Number(f.minScore)>100)add('minScore','scoreRange',3);}
 if(!validAmount(f.clientDeposit))add('clientDeposit','nonnegativeAmount',4);
 return issues;
}
