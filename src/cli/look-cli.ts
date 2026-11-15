// `pnpm tempoloom look`: learn a look from a video you like, then make videos in its spirit.
import {learnLook,listLooks,readLook,looksDir,saveMix} from '../engine/looks.js';

const usage=`Usage: tempoloom look <command>
  learn URL|FILE --name NAME [--confirm] [--section 0-30]
                 Study a video you like (TikTok, Reel, YouTube, any link or a file). A link first shows
                 its title, length and size; --confirm downloads it for study only. Only measurements
                 are kept: brightness, colour temperature, cut rhythm, motion energy and easing.
  list           Your looks
  show NAME      What a look measured and how it steers a video
  channel URL|FOLDER --name NAME [--count 20] [--seconds 45] [--confirm]
                 Learn from a channel: its latest videos (a channel or profile link, or a folder of them)
                 studied as one style - what stays the same in every video and what changes - saved as
                 a look. A link lists the videos first; --confirm downloads the first seconds of each
                 for study only, measures them and deletes them
  mix A B [--weight 0.7] [--name NAME]
                 Style mixer: blends two styles you taught (looks, or taught videos by id), 70% of A and
                 30% of B by default; saved as a look to use with --like

Use one: pnpm tempoloom make script.txt --like NAME (also storyboard --like, or "like" in a request).
A look never copies: your brand colours stay, it only makes some style traits likelier and
suggests the music's mood; every video is still a new design. Looks live in assets/looks.`;

const flag=(a:string[],n:string)=>{const i=a.indexOf(n);return i>=0&&a[i+1]&&!a[i+1]!.startsWith('--')?a[i+1]:undefined;};
async function main(){
 const [cmd,...a]=process.argv.slice(2);const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 switch(cmd){
  case 'learn':{const input=a[0],name=flag(a,'--name');if(!input||input.startsWith('--')||!name)throw new Error('learn URL|FILE --name NAME');
   const r=await learnLook(input,{name,confirm:a.includes('--confirm'),section:flag(a,'--section')});
   if(r.status==='needs-confirmation')return out(r);
   return out({learned:r.look.name,file:r.file,looksLike:r.look.summary,musicMood:r.look.music.mood,use:`pnpm tempoloom make script.txt --like ${r.look.name}`});}
  case 'list':return out((await listLooks()).map(l=>({name:l.name,from:l.source.title??l.source.url??l.source.file,looksLike:l.summary,musicMood:l.music.mood})));
  case 'show':{if(!a[0])throw new Error('show NAME');const l=await readLook(a[0]);return out({...l,folder:looksDir()});}
  case 'channel':{const input=a[0],name=flag(a,'--name');if(!input||input.startsWith('--')||!name)throw new Error('channel URL|FOLDER --name NAME [--count 20] [--confirm]');
   const {learnChannel}=await import('../engine/channel-style.js');const count=flag(a,'--count'),seconds=flag(a,'--seconds');
   return out(await learnChannel(input,{name,confirm:a.includes('--confirm'),...(count?{count:Number(count)}:{}),...(seconds?{seconds:Number(seconds)}:{}),onStep:s=>console.error(s)}));}
  case 'mix':{if(!a[0]||!a[1]||a[0].startsWith('--')||a[1].startsWith('--'))throw new Error('mix A B [--weight 0.7] [--name NAME]');
   const w=flag(a,'--weight')??'0.7',weight=Number(w.endsWith('%')?Number(w.slice(0,-1))/100:w);if(!Number.isFinite(weight)||weight<0||weight>1)throw new Error('--weight is from 0 to 1 (or 0% to 100%): the share of the first style');
   const r=await saveMix(a[0],a[1],weight,flag(a,'--name'));
   return out({mixed:r.look.name,file:r.file,looksLike:r.look.summary,musicMood:r.look.music.mood,use:`pnpm tempoloom make script.txt --like ${r.look.name}`});}
  default:if(cmd&&cmd!=='help'){console.error('Unknown command: '+cmd);process.exitCode=1;}console.log(usage);
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
