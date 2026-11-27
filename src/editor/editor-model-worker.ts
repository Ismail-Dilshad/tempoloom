import {runEditorModelWorker} from './editor-model-jobs.js';

const id=process.argv[2];
if(id)await runEditorModelWorker(id);
