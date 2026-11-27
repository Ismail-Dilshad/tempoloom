import {runEditorExportWorker} from './shared-exports.js';

const [id,options]=process.argv.slice(2);
if(!id||!options)throw new Error('The editor export worker needs a job and its render settings');
await runEditorExportWorker(id,JSON.parse(options));
