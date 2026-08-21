import { readFileSync } from 'node:fs';

export function readEnvFile(path='.env'){
  const bytes=readFileSync(path);
  const utf16=bytes[0]===0xff&&bytes[1]===0xfe||bytes.subarray(0,Math.min(bytes.length,40)).some((value,index)=>index%2===1&&value===0);
  const text=bytes.toString(utf16?'utf16le':'utf8').replace(/^\uFEFF/,'');
  return Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{
    const index=line.indexOf('=');
    const key=line.slice(0,index).trim();
    const value=line.slice(index+1).trim().replace(/^(['"])(.*)\1$/,'$2');
    return [key,value];
  }));
}
