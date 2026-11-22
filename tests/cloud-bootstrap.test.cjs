"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = function(mod, path) {
  const js = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    fileName:path, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  mod._compile(js,path);
};
const { withCloudGenesisSession } = require("../src/lib/cloudGenesisSession.ts");
const empty = () => ({sessions:[],folders:[],globalWorldInfo:"",bgImage:null});
test("first visit creates a single localized Officina greeting", () => {
  for (const locale of ["zh-CN","zh-TW","en","ja","ko"]) {
    const start = empty();
    const seeded = withCloudGenesisSession(start, locale, 12345);
    assert.equal(seeded.sessions.length,1);
    assert.equal(seeded.sessions[0].id,"12345");
    assert.equal(seeded.sessions[0].memoryMode,"infinite");
    assert.equal(seeded.sessions[0].messages[0].role,"assistant");
    assert.equal(seeded.sessions[0].messages[0].modelName,"System");
    assert.ok(seeded.sessions[0].messages[0].content.length>8);
    assert.equal(start.sessions.length,0);
    assert.equal(withCloudGenesisSession(seeded, "en", 567).sessions[0].id,"12345");
  }
});
test("existing archive data is never edited or discarded", () => {
  const prior={...empty(),folders:[{id:"folder",name:"A"}],globalWorldInfo:"world"};
  const seeded=withCloudGenesisSession(prior,"en",100);
  assert.deepEqual(seeded.folders,prior.folders);
  assert.equal(seeded.globalWorldInfo,"world");
  assert.strictEqual(withCloudGenesisSession(seeded,"ja",200),seeded);
});
test("first-run checkpoint is saved before hydration and therefore not dirty",async()=>{
  const {indexedDB}=require("fake-indexeddb");
  global.indexedDB=indexedDB;
  const {browserRead,browserMutate}=require("../src/lib/browserStore.ts");
  const stamp=789;
  const checkpoint=await browserMutate("sessions", current=>{
    if(current?.data?.sessions?.length)return current;
    return {data:withCloudGenesisSession(current?.data||empty(),"zh-CN",stamp),lastModified:stamp};
  });
  const read=await browserRead("sessions",null);
  assert.deepEqual(read,checkpoint);
  assert.equal(JSON.stringify(read.data),JSON.stringify(checkpoint.data));
  const same=await browserMutate("sessions", current=>current?.data?.sessions?.length?current:null);
  assert.deepEqual(same,checkpoint);
});
