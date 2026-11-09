import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('tip rail follows selected card height and expanded content',()=>{
 let resize, scroll, position=0;
 const sizes=[300,500,400,350];
 const children=sizes.map((_,i)=>({getBoundingClientRect:()=>({left:i*330-position,height:sizes[i]})}));
 const track={children,style:{},getBoundingClientRect:()=>({left:0}),addEventListener:(_,fn)=>{scroll=fn;}};
 runInNewContext(readFileSync('public/site/js/tips-height.js','utf8'),{document:{querySelector:()=>track},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}}});
 assert.equal(track.style.height,'320px');
 position=330;scroll();assert.equal(track.style.height,'520px');
 sizes[1]=720;resize();assert.equal(track.style.height,'740px');
 position=990;scroll();assert.equal(track.style.height,'370px');
});
