import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createRequire} from 'node:module';
import {TOOLS,callTool} from '../engine/agent-tools.js';
import {editorTaskMeta,EditorTaskTransport,registerEditorTasks,toolResult} from './editor-mcp-tasks.js';

if(process.argv[2]==='help'||process.argv[2]==='--help'){
 console.log(`Usage: tempoloom mcp

Serves Tempoloom's tools over MCP stdio.
  claude mcp add tempoloom -- node bin/tempoloom.mjs mcp
Tools: ${TOOLS.map(t=>t.name).join(', ')}`);
}else{
 // Stdout is reserved for protocol messages.
 console.log=(...args:unknown[])=>console.error(...args);
 const {version}=createRequire(import.meta.url)('../../package.json') as {version:string};
 serveStdio(()=>{
  const server=new McpServer({name:'tempoloom',title:'Tempoloom Studio',version},{
   instructions:'Use studio tools for Studio jobs and editor tools for shared timeline projects. Only the user approves Studio gates.',
  });
  for(const tool of TOOLS){
   server.registerTool(tool.name,{description:tool.description,inputSchema:tool.input},async (args,ctx)=>{
    try{
     const result=await callTool(tool.name,args);
     return {...toolResult(result),...editorTaskMeta(tool.name,result,ctx)};
    }catch(error){
     return toolResult((error as Error).message,true);
    }
   });
  }
  registerEditorTasks(server.server);
  return server;
 },{transport:new EditorTaskTransport()});
}
