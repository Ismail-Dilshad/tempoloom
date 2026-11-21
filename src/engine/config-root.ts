import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
/** Repository root (this file lives in src/engine). Kept in its own module so config and font modules can share it without an import cycle. */
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');

/** The main checkout when ROOT is a git worktree of it (its .git is a file pointing into the main .git). */
export function mainCheckout():string|null{
 try{
  const g=fs.readFileSync(path.join(ROOT,'.git'),'utf8').match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();if(!g)return null;
  const parts=path.resolve(ROOT,g).split(path.sep),i=parts.lastIndexOf('worktrees');
  return i>0?path.dirname(parts.slice(0,i).join(path.sep)):null;
 }catch{return null;}
}
/** The project's Python (the .venv with the media tools). A worktree without its own .venv uses the
 *  main checkout's, so links, audio and media tools work there too. VIDEO_PYTHON overrides both. */
export function projectPython():string{
 if(process.env.VIDEO_PYTHON)return process.env.VIDEO_PYTHON;
 const at=(root:string)=>path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const own=at(ROOT);if(fs.existsSync(own))return own;
 const main=mainCheckout();return main&&fs.existsSync(at(main))?at(main):own;
}
