// What paid services cost, kept on this computer: every charge the studio makes is written here
// with what it was for, and every new one is checked against the budgets in Settings (per job, per
// day, and the amount above which the user is asked first).
import fs from 'node:fs';
import path from 'node:path';
import {readSettings,settingsDir} from './settings.js';

export type Charge={at:string;usd:number;what:string;service:string;job?:string};
const file=()=>path.join(settingsDir(),'spend.jsonl');
export function charges():Charge[]{try{return fs.readFileSync(file(),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l) as Charge);}catch{return [];}}
const day=(d=new Date())=>d.toISOString().slice(0,10);
export function spent(o:{job?:string;today?:boolean}={}){
 const all=charges().filter(c=>(!o.job||c.job===o.job)&&(!o.today||c.at.slice(0,10)===day()));
 return +all.reduce((t,c)=>t+c.usd,0).toFixed(4);
}
/** Writes a charge (the amount actually spent, or the estimate when the service does not say). */
export function record(c:Omit<Charge,'at'>){fs.mkdirSync(settingsDir(),{recursive:true});fs.appendFileSync(file(),JSON.stringify({at:new Date().toISOString(),...c,usd:+c.usd.toFixed(4)})+'\n');}
export type Verdict={ok:true}|{ok:false;ask:true;why:string}|{ok:false;ask:false;why:string};
const money=(n:number)=>'$'+(n<1?n.toFixed(2):n.toFixed(2).replace(/\.00$/,''));
/** May this be spent? Over a budget: no. Above the ask-first amount (or together over it): ask. */
export function allow(usd:number,o:{job?:string;approved?:boolean}={}):Verdict{
 const b=readSettings().budget,today=spent({today:true}),job=o.job?spent({job:o.job}):0;
 if(today+usd>b.perDay+1e-9)return {ok:false,ask:false,why:`That would make ${money(today+usd)} today; the budget is ${money(b.perDay)} a day (Settings, Budgets).`};
 if(o.job&&job+usd>b.perJob+1e-9)return {ok:false,ask:false,why:`That would make ${money(job+usd)} for this job; the budget is ${money(b.perJob)} a job (Settings, Budgets).`};
 if(usd>b.askAbove+1e-9&&!o.approved)return {ok:false,ask:true,why:`It costs about ${money(usd)}, more than the ${money(b.askAbove)} you are asked about first.`};
 return {ok:true};
}
export function summary(){const b=readSettings().budget;return {today:spent({today:true}),perDay:b.perDay,perJob:b.perJob,askAbove:b.askAbove,recent:charges().slice(-20).reverse()};}
