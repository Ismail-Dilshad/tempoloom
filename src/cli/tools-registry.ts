// Tool registry schema and reader (agent/tools/registry.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from '../engine/config.js';
export const toolSchema=z.object({id:z.string(),category:z.string(),description:z.string(),command:z.string(),inputs:z.array(z.string()),status:z.enum(['ready','planned']),whenToUse:z.string(),
 /** How the Studio page shows the tool: its name, icon, group, one line, and the page that runs it (none: the agent runs it). */
 page:z.object({name:z.string(),icon:z.string(),group:z.string(),about:z.string(),open:z.string().optional()}).strict().optional()}).strict();
export const registrySchema=z.object({version:z.literal(1),description:z.string(),tools:z.array(toolSchema)}).strict();
export async function readRegistry(){return registrySchema.parse(JSON.parse(await fs.readFile(path.join(ROOT,'agent/tools/registry.json'),'utf8')));}
