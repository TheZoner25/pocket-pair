/* Pocket Pair engine: pixel rooms, pets, menus and overlays drawn into a 160x128 canvas.
   Ported from the device mock-up. app.js runs tick() every 100 ms. */
const W=160,H=128,FL=52,TOP=32;
let g=null,TICK=0,docked=false,dockT=0,dockCount=0,herName='HAZEL',rockyName='ROCKY',soundOn=true,clockStr='00:00';
const reduce=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();
/* weather snapshot looked up 9 Nov 2026 ~18:45; the real device asks a weather API */
/* app.js refreshes this from Open-Meteo every 15 minutes */
const NOWWX={rocky:{city:'LAPPEENRANTA',t:2,cond:'cloudy'},her:{city:'HELSINKI',t:4,cond:'cloudy'}};
let wxMode='now',lightMode='now';
function wxCond(o){return wxMode==='now'?NOWWX[o].cond:wxMode}
function wxTemp(o){const t=NOWWX[o].t,c=wxCond(o);return c==='snow'?Math.min(t,-3):c==='rain'?Math.max(t,3):t}
function isNight(){if(lightMode!=='now')return lightMode==='night';const d=new Date(),h=d.getHours()+d.getMinutes()/60;return h<8.5||h>=16}

/* ---------- primitives (scene coords are logical; the world is drawn at 2x) ---------- */
function R(x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)}
function P(x,y,c){R(x,y,1,1,c)}
function box(x,y,w,h,f,s){R(x,y,w,h,s);R(x+1,y+1,w-2,h-2,f)}
function spr(rows,x,y,pal,flip,sc){sc=sc||1;x=Math.round(x);y=Math.round(y);for(let j=0;j<rows.length;j++){const r=rows[j],n=r.length;for(let i=0;i<n;i++){const c=pal[r[i]];if(!c)continue;g.fillStyle=c;g.fillRect(x+(flip?n-1-i:i)*sc,y+j*sc,sc,sc)}}}
function line(x0,y0,x1,y1,c,th){th=th||1;x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy;for(let n=0;n<300;n++){R(x0,y0,th,th,c);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
function hr(n){n=Math.sin(n*127.1+11.7)*43758.5453;return n-Math.floor(n)}
function skyCol(o,fn){const n=fn||isNight(),c=wxCond(o);if(n)return c==='clear'?'#141c3a':'#1d2236';return{clear:'#9ec6ea',cloudy:'#b7c1cb',rain:'#949fab',snow:'#c6d0d9'}[c]}
function skyDeco(o,x0,y0,w,h,fn){const c=wxCond(o),n=fn||isNight();
 if(c==='clear'){if(n){for(let i=0;i<Math.round(w*h/40)+2;i++)P(x0+hr(i+3)*w,y0+hr(i+7)*h*0.7,(TICK+i*5)%30<2?'#fff6c8':'#cfd6f0');R(x0+w-8,y0+2,3,3,'#f4efc8')}else R(x0+w-9,y0+2,4,4,'#ffe27a')}
 else{const cc=n?'#2b3150':(c==='rain'?'#7d8894':'#dde2e7');for(let i=0;i<3;i++){const cx=x0+((hr(i)*w+TICK*0.05*(i+1))%(w+10))-6;R(cx,y0+1+i*2,9,2,cc);R(cx+2,y0+i*2,5,1,cc)}}}
function wxFx(o,x0,y0,w,h,fn,den){const c=wxCond(o),n=fn||isNight();den=den||1;
 if(c==='snow')snow(x0,y0,w,h,TICK,Math.round(w*h/60*den)+2,'#ffffff');
 if(c==='rain'){const cnt=Math.round(w*h/45*den)+2;for(let i=0;i<cnt;i++){const x=x0+((hr(i)*w+TICK*0.6)%w),y=y0+((hr(i+40)*h+TICK*2.2)%h);P(x,y,n?'#7f93c4':'#eef3f8');P(x,y-1,n?'#56699a':'#cfdbe7')}}}
function winView(x,y,w,h,o,fn){R(x,y,w,h,skyCol(o,fn));skyDeco(o,x,y,w,h,fn);wxFx(o,x,y,w,h,fn,0.6)}
function snow(x0,y0,w,h,t,n,c){for(let i=0;i<n;i++){const x=x0+(((hr(i)*w+Math.sin((t+i*13)*0.15)*1.5)%w)+w)%w;const y=y0+((hr(i+50)*h+t*(0.25+hr(i+99)*0.35))%h);P(x,y,c)}}

/* ---------- 3x5 pixel font ---------- */
const FONT={A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",Y:"101101010010010",Z:"111001010100111",0:"111101101101111",1:"010110010010111",2:"110001010100111",3:"110001010001110",4:"101101111001001",5:"111100110001110",6:"011100110101010",7:"111001010010010",8:"010101010101010",9:"010101011001110",'!':"010010010000010",':':"000010000010000",'.':"000000000000010",'-':"000000111000000",'/':"001001010100100",'+':"000010111010000",'?':"110001010000010",'*':"101111111010000",'<':"001010100010001",'>':"100010001010100",'°':"010101010000000"};
function text(s,x,y,c){s=String(s).toUpperCase();for(const ch of s){const gl=FONT[ch];if(gl){for(let i=0;i<15;i++)if(gl[i]==='1')R(x+i%3,y+((i/3)|0),1,1,c)}x+=4}}
const tw=s=>String(s).length*4-1;

/* ---------- palettes ---------- */
const PAL={
 rocky:{k:'#1b1626',h:'#1f1c29',H:'#4a4766',s:'#dfa577',S:'#b97c56',g:'#141118',e:'#e9f0f7',m:'#a84a46',b:'#ee9886',c:'#667c9e',C:'#4d6183',x:'#15121b',p:'#26232d',P:'#3a3642',L:'#dfa577',o:'#eef0f2'},
 her:{k:'#1b1626',h:'#16141c',H:'#3d3a56',s:'#ecbe9a',S:'#cf9b76',t:'#5e3219',T:'#b56d33',E:'#1b1626',m:'#cf5a6c',b:'#f4a3ad',c:'#f6f3ee',C:'#d4cec6',x:'#ecbe9a',p:'#3f5686',P:'#2e4069',L:'#3f5686',o:'#e6dccb'}
};
const COAT=Object.assign({},PAL.her,{c:'#ffffff',C:'#c3ccd5',x:'#ffffff'});
const DOGP={k:'#2a1a14',f:'#c78d5a',F:'#9a653d',n:'#7b3b3c',T:'#ec7f90',w:'#ecd5b6',e:'#2a1a14',c:'#2c2a33'};

/* ---------- sprites (12 wide; heads 12-13 rows, body 7 rows, legs 3 rows) ---------- */
const HEAD={
 rocky:["...kkkkkk...","..khhhHhhk..",".khhHHhhhhk.",".khhhhhhhhk.",".khhssshhhk.",".kssssssssk.",".kggggggggk.",".kgegssgegk.",".kgggssgggk.",".kbssmmssbk.","..kssssssk..","...kkkkkk..."],
 her:["...kkkkkk...","..khhhhhhk..",".khhHhhhhhk.","khhhHHhhhhhk","khhhhhhhhhhk","khsssssssshk","khsEssssEshk","khsssssssshk","khbssmmssbhk","khhsssssshhk","khhhkkkkhhhk","kHhk....khHk",".kk......kk."]
};
const HEADB={
 rocky:["...kkkkkk...","..khhhHhhk..",".khhHHhhhhk.",".khhhhhhhhk.",".khhhhhhhhk.",".khhhhhhhhk.",".kghhhhhhgk.","skhhhhhhhhks",".khhhhhhhhk.","..kShhhhSk..","...kssssk...","...kkkkkk..."],
 her:["...kkkkkk...","..khhhhhhk..",".khhHhhhhhk.","khhhHHhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhhhhhk","kHhhhhhhhhHk",".kkkkkkkkkk."]
};
const HEADS={
 rocky:["...kkkkk....","..khhhhhkk..",".khhhHHhhhk.",".khhhhhhhhhk",".khhhhhhsssk",".khhhhssssk.",".khhhgggggk.",".khhsssgegsk",".khhsssgggsk","..khssssmsk.","...kssssssk.","....kkkkkk.."],
 her:["...kkkkk....","..khhhhhkk..",".khhhHHhhhk.","khhhhhhhhhhk","khhhhhhhhhhk","khhhhhhsssk.","khhhhsssEssk","khhhhssssssk","khhhhssssmk.","khhhhsssssk.","khhhhkkkkk..","kHhhk.......",".kkk........"]
};
const BODY=["....kssk....","..kcccccck..",".kCccccccCk.",".kxccccccsk.",".ksccccccsk.","..kppppppk..","..kpPkkPpk.."];
const LEGS=[["..kLLkkLLk..","..kookkook..","...kk..kk..."]];
const BODYS=[".....kssk...","....kcccck..","....kcCcck..","....kcCcck..","....kcxcck..","....kcscck..","....kppppk.."];
const LEGSS=[["....kLLk....","....kLLk....","....kooook.."],["....kLLLk...","...kLk.kLk..","..kook..kook"]];
const DOG=["..........kk....",".........kFkkk..","........kfffffk.","........kfFfeffk","........kffFffnk",".kkkkkkkcfFffFfk","kfffffffffwkTTk.",".kffffffffwwkk..",".kfFk...kfFk....",".kffk...kffk....",".kkkk...kkkk...."];
const DOG_LIE=DOG.slice(0,8).concat([".kkkkkkkkkkkk..."]);
const HEART5=[".k.k.","kpkpk","kpppk",".kpk.","..k.."];
const BIGHEART=[".kk.kk.","kwpkppk","kpppppk",".kpppk.","..kpk..","...k..."];
const ENV=["kkkkkkkkk","kkwwwwwkk","kwkwwwkwk","kwwkpkwwk","kwwwkwwwk","kwwwwwwwk","kkkkkkkkk"];
const HP={k:'#4a1428',p:'#ff6f91',w:'#ffd6e0'};
const BOOK=['#c0504d','#4f81bd','#9bbb59','#e3b33a','#7f6084','#2f6e6a','#d9d2c3','#a14d3a','#3b4a6b','#e8a0a8','#5b8f7d'];

function blink(seed){return ((TICK+seed*17)%53)<2}
let TIRED=false;
function person(who,x,y,o){o=o||{};let pal=o.coat?COAT:PAL[who];if(TIRED&&!o.closed&&!o.headOnly||TIRED&&o.headOnly&&!o.closed){if(TICK%24<14)o=Object.assign({},o,{closed:true});if(TICK%48<8)o=Object.assign({},o,{mouth:true})}
 if(o.pal)pal=o.pal;
 if(o.closed)pal=Object.assign({},pal,{e:pal.S,E:pal.S});
 if(o.mouth)pal=Object.assign({},pal,{m:'#5a1f28'});
 if(o.side){if(!o.headOnly){spr(BODYS,x,y+10,pal,o.flip);if(!o.noLegs)spr(o.legs||LEGSS[0],x,y+17,pal,o.flip)}spr(HEADS[who],x,y+(o.hd||0),pal,o.flip);return}
 if(!o.headOnly){spr(BODY,x,y+10,pal);if(!o.noLegs)spr(LEGS[0],x,y+17,pal)}
 spr(o.back?HEADB[who]:HEAD[who],x,y+(o.hd||0),pal);
 if(o.coat&&!o.headOnly&&!o.back){P(x+7,y+12,'#3c79d6');P(x+7,y+13,'#9bbcf0')}
}
function walker(who,x,y,facing,step,extra){return person(who,x,y,Object.assign({side:true,flip:facing<0,legs:LEGSS[(step>>2)&1]},extra||{}))}
function dog(x,y,o){o=o||{};const pal=o.sleep?Object.assign({},DOGP,{e:DOGP.F,T:DOGP.F}):DOGP;spr(o.lie?DOG_LIE:DOG,x,y,pal,o.flip);
 if(!o.sleep){const tx=o.flip?x+15:x;P(tx,y+(TICK%4<2?4:5),DOGP.k)}}
function bowl(x,y,food){R(x+1,y,6,2,food);box(x,y+1,8,3,'#f2ede4','#6b6474');R(x+2,y+4,4,1,'#6b6474')}
function steam(x,y){for(let i=0;i<3;i++){const k=(TICK+i*3)%9;P(x+i*2+Math.round(Math.sin((TICK+i*5)*0.5)),y-k,'rgba(255,255,255,0.75)')}}
function zzz(x,y){for(let i=0;i<3;i++){const k=(TICK+i*12)%36;text('Z',x+i*2+(k>>3),y-(k>>2),k<30?'#e9e6ff':'#8f8bb8')}}
function night(d){R(d.cam-1,0,82,55,'rgba(14,18,48,0.52)')}
function sortDraw(list){list.sort((a,b)=>a.fy-b.fy).forEach(a=>a.draw())}
function pan(px,py,hx,hand){R(px,py,10,2,'#2b2930');R(px+1,py+2,8,1,'#1b1a20');R(hand>0?px+10:px-5,py,5,1,'#2b2930');
 for(let i=0;i<4;i++)if((TICK+i)%3)P(px+2+i*2,py+4,(TICK+i)%2?'#ff9a3c':'#4aa8ff');
 const ph=TICK%20,ay=ph<8?0:-Math.round(Math.sin(Math.PI*(ph-8)/12)*9);R(px+3,py-1+ay,4,1,'#f6e7b0');P(px+4,py-1+ay,'#ffcf3f');
 if(ph<8)for(let i=0;i<2;i++)P(px+3+i*3,py-2-((TICK+i*2)%4),'rgba(255,255,255,0.7)')}

/* ---------- Rocky's room (side view, 282 wide) ---------- */
function robotArm(x,y,fast){const ph=TICK,s=fast?1.8:1;R(x,y-2,9,2,'#b8342c');R(x+1,y-3,7,1,'#d24a3f');
 const sx=x+4,sy=y-4,a1=-1.9+Math.sin(ph*0.07*s)*0.35,a2=a1+1.1+Math.sin(ph*0.11*s)*0.45;
 const ex=sx+Math.cos(a1)*11,ey=sy+Math.sin(a1)*11,hx=ex+Math.cos(a2)*9,hy=ey+Math.sin(a2)*9;
 line(sx,sy,ex,ey,'#9aa3ae',2);line(ex,ey,hx,hy,'#c9ced6',1);R(ex,ey,2,2,'#d24a3f');
 const op=Math.sin(ph*0.2*s)>0;P(hx+1,hy-(op?1:0),'#f0f0f0');P(hx+1,hy+(op?1:0),'#f0f0f0')}
function monitor(active){const off=active?Math.floor(TICK/3):0,cols=['#5fd3c8','#ff8fa8','#ffd36b','#9fb4ff','#d6e3f0'];
 for(let i=0;i<4;i++){const n=i+off,ind=(hr(n*3)*3|0)*2,w=3+(hr(n)*8|0);R(109+ind,17+i*2,Math.min(w,12-ind),1,cols[(hr(n+7)*5)|0])}}
function printer3d(x,y){const t=TICK;
 box(x+2,y-5,18,5,'#4a4a52','#26262c');R(x+4,y-4,5,3,'#1b1b20');R(x+11,y-4,5,3,'#1b1b20');R(x+5,y-4,3,3,'#e04a4a');R(x+12,y-4,3,3,'#f2f2f2');
 box(x,y,22,17,'#3a3a40','#1d1d22');R(x+2,y+2,15,13,'#26313b');R(x+2,y+2,15,1,'#fff3cc');
 R(x+3,y+14,13,1,'#6b6b74');
 const rows=Math.min(5,Math.floor((t/16)%14/2)+1);
 for(let j=5-rows;j<5;j++)spr([HEART5[j]],x+7,y+9+j,{k:'#c4446a',p:'#ff7aa0'});
 const hy=y+13-rows-3,hx=x+3+Math.round((Math.sin(t*0.5)+1)*5.5);R(x+2,hy-1,15,1,'#55555c');box(hx,hy,3,3,'#e0e0e4','#77777f');P(hx+1,hy+3,'#ffb030');
 line(x+12,y+4,x+15,y+7,'rgba(255,255,255,0.22)');R(x+18,y+3,3,4,'#5fd3c8');R(x+18,y+8,3,1,'#55555c');R(x+16,y+6,1,4,'#9a9aa2')}
function roomRocky(d,o){o=o||{};const nt=o.night;
 R(0,0,282,46,'#e8e3da');R(0,0,282,5,'#d6d0c5');R(0,5,282,1,'#c9c2b6');
 R(0,46,282,9,'#bab4a9');R(0,46,282,1,'#9b958a');for(let i=0;i<50;i++)P((i*37+11)%282,48+((i*13)%7),'#c8c2b7');R(0,44,282,2,'#d9d3c9');
 box(0,8,36,11,'#f7f5f1','#8e8984');R(18,9,1,9,'#d3cec8');P(16,15,'#9a958f');P(20,15,'#9a958f');
 R(0,19,36,15,'#7d7977');R(6,19,3,1,nt?'#7d7977':'#fff1b8');R(26,19,3,1,nt?'#7d7977':'#fff1b8');
 R(0,34,38,2,'#38353d');R(0,36,38,10,'#a6978a');R(0,40,38,1,'#857769');R(27,38,6,1,'#857769');R(27,42,6,1,'#857769');
 box(5,36,15,10,'#f4f3f0','#9b9792');R(7,39,11,5,'#2b2930');R(8,40,9,1,'#4b4854');for(let i=0;i<4;i++)P(7+i*3,37,'#55525c');
 if(!o.cooking){box(6,29,9,5,'#bfc2c8','#5d606a');R(5,29,11,1,'#5d606a');R(9,28,3,1,'#5d606a')}
 box(24,27,8,7,'#2a282f','#141218');P(27,29,'#5fd38a');
 box(38,20,13,26,'#f8f8f6','#8f8f95');R(39,30,11,1,'#a8a8ae');R(48,23,1,5,'#b3b3b9');R(48,32,1,8,'#b3b3b9');
 [[41,22,'#d24b4b'],[44,24,'#3d6fd1'],[41,27,'#e3b33a'],[43,33,'#d24b4b'],[40,36,'#5aa36b'],[44,39,'#3d6fd1']].forEach(a=>R(a[0],a[1],2,1,a[2]));
 box(51,6,10,40,'#b9a58f','#7b6857');R(52,20,8,1,'#8f7c69');R(52,33,8,1,'#8f7c69');R(59,24,1,5,'#6b5948');R(59,37,1,5,'#6b5948');
 box(63,17,13,29,'#f3f2ee','#99968f');for(let y=19;y<44;y+=2)R(65,y,9,1,'#d4d2cc');R(73,31,2,1,'#77746e');
 box(79,11,30,20,'#f3f2ee','#99968f');winView(81,13,26,16,'rocky',nt);
 for(let y=13;y<29;y+=3)R(81,y,26,1,'rgba(240,242,244,0.5)');R(94,11,1,20,'#99968f');
 box(81,33,26,6,'#f3f2ee','#a8a59d');for(let x=83;x<106;x+=2)R(x,34,1,4,'#d4d2cc');
 R(84,36,44,2,'#f2f0eb');R(84,38,44,1,'#a8a59d');R(86,39,2,7,'#2b2930');R(124,39,2,7,'#2b2930');
 box(106,14,18,13,'#1d1b23','#0e0c12');R(108,16,14,9,nt?'#24314f':'#dfe9f2');monitor(o.coding);R(114,27,2,8,'#2b2930');R(111,35,8,1,'#2b2930');
 R(96,35,9,1,'#5a4fd6');box(122,32,5,4,'#3fa79a','#22665e');robotArm(87,36,o.coding);
 [132,147].forEach(x=>R(x,22,1,24,'#1f1d24'));[22,29,36,43].forEach(y=>R(132,y,16,1,'#1f1d24'));
 R(134,25,4,4,'#d24b4b');R(139,26,6,3,'#8a8f99');R(134,32,3,4,'#e8e8e8');R(139,31,5,5,'#3d6fd1');R(134,39,11,4,'#c9b9a0');R(140,18,2,4,'#1f1d24');P(142,17,'#1f1d24');
 R(152,36,26,2,'#3a3640');R(153,38,2,8,'#3a3640');R(175,38,2,8,'#3a3640');R(155,42,20,1,'#3a3640');printer3d(154,19);
 R(182,29,40,7,'#b8906c');R(183,30,38,5,'#cba27c');R(180,32,5,10,'#b8906c');R(219,32,5,10,'#b8906c');R(181,33,3,8,'#cba27c');R(220,33,3,8,'#cba27c');
 R(184,36,36,5,'#dbb68f');R(184,36,36,1,'#e8c8a3');R(202,37,1,4,'#c9a37c');R(180,41,44,2,'#a9825f');R(182,43,2,2,'#c0682e');R(220,43,2,2,'#c0682e');
 R(187,27,8,4,'#2b2b34');R(188,31,6,3,'#2b2b34');R(180,30,4,8,'#8a6a3e');
 if(!o.noGuitar){R(201,6,2,1,'#888888');R(200,7,4,3,'#3b2a1c');R(201,10,2,9,'#6b4a2e');
 R(198,19,8,3,'#b8352e');R(197,22,10,6,'#b8352e');R(198,28,8,2,'#b8352e');R(199,20,6,2,'#dc9d52');R(198,22,8,5,'#dc9d52');R(199,27,6,2,'#dc9d52');R(201,22,2,2,'#3b2a1c');R(200,26,4,1,'#3b2a1c');}
 R(214,0,1,9,'#2b2930');R(212,9,5,2,'#2b2930');R(213,11,3,1,nt?'#6a6650':'#fff3b0');
 R(232,9,5,4,'#a6823e');P(233,10,'#2b2010');P(235,10,'#2b2010');
 R(224,44,48,2,'#f6f6f4');box(228,39,40,7,'#eef0f3','#a6a9b0');R(230,36,10,3,'#dfe4ec');
 if(!o.bedInUse){R(250,35,16,4,'#5d5f68');R(252,36,10,1,'#6f717b')}
 R(240,49,3,1,'#6cc7c9');R(244,50,3,1,'#6cc7c9');
 R(270,27,9,11,'#16141a');for(let x=271;x<279;x+=2)R(x,28,1,9,'#2d2a33');R(269,36,11,2,'#b8c6d3');R(269,38,11,1,'#16141a');R(270,39,1,7,'#16141a');R(278,39,1,7,'#16141a');
}

/* ---------- her room (from her photos, 242 wide) ---------- */
function shelfBooks(x0,x1,yt,seed){let x=x0,i=0;while(x<x1-1){const w=1+(hr(seed+i)*2|0),h=5+(hr(seed+i+9)*3|0);R(x,yt+8-h,Math.min(w,x1-x),h,BOOK[(hr(seed+i+3)*BOOK.length)|0]);x+=w+(hr(seed+i+7)>0.85?1:0);i++}}
const PATCH=['#2c3550','#6f8a7c','#ece3c2','#a8bccb','#e6dc9c','#2e4a44','#c9d3c0'];
function frogPlush(x,y){R(x+1,y,2,2,'#3fc9c2');R(x+7,y,2,2,'#3fc9c2');P(x+1,y,'#ffffff');P(x+8,y,'#ffffff');P(x+2,y+1,'#1b1626');P(x+7,y+1,'#1b1626');
 R(x,y+2,10,7,'#3fc9c2');R(x+1,y+9,8,1,'#36b3ad');R(x+2,y+5,6,4,'#efe6cf');P(x+1,y+4,'#f29ab0');P(x+8,y+4,'#f29ab0');R(x+4,y+3,2,1,'#1b1626')}
function frogPet(f){frogPlush(f.x,FL-10-(f.moving&&((f.step>>1)&3)===1?2:0))}
function duvet(x0,x1,y,rows){for(let r=0;r<rows;r++)for(let x=x0,i=0;x<x1;x+=6,i++)R(x,y+r*2,Math.min(6,x1-x),2,PATCH[(i*3+r*5)%PATCH.length])}
function roomHer(d,o){o=o||{};const nt=o.night;
 // walls, white baseboard, light-grey vinyl floor
 R(0,0,242,46,'#eeece7');R(0,0,242,4,'#e3e0d9');R(0,4,242,1,'#d8d4cb');
 R(0,46,242,9,'#cfc9c1');for(let i=0;i<9;i++)R(i*28+((i*11)%9),47+(i%3)*3,14,1,'#bfb8ae');R(0,44,242,2,'#f6f5f1');R(0,46,242,1,'#b3ada3');
 // room door + black puffer coat on the door hooks
 box(2,9,16,37,'#f4f3ef','#c9c6bf');R(14,28,3,1,'#a9adb3');P(14,30,'#a9adb3');R(3,11,13,1,'#2a2a30');
 R(5,12,9,11,'#1c1b22');R(6,12,7,2,'#2a2931');R(13,14,2,9,'#1c1b22');for(let y=15;y<22;y+=3)P(9,y,'#d6d6d6');
 // three-door white wardrobe with top cabinets and silver handles
 for(let i=0;i<3;i++){const x=20+i*13;box(x,4,13,7,'#f7f7f4','#cfccc4');R(x+4,9,5,1,'#a9adb3');box(x,11,13,35,'#f7f7f4','#cfccc4');R(x+(i===0?9:2),30,3,1,'#a9adb3');P(x+3,12,'#2a2a30');P(x+3,13,'#2a2a30')}
 // window, grey sheer curtain, radiator, plush on the sill
 box(64,7,54,28,'#f1ecdf','#d9d2c2');winView(66,9,50,24,'her',nt);R(90,9,2,24,'#f1ecdf');
 R(62,6,58,1,'#8a8580');g.globalAlpha=0.42;R(64,7,40,24,'#9a9690');R(104,7,14,24,'#8a8680');g.globalAlpha=1;g.globalAlpha=1;g.globalAlpha=1;
 for(let x=64;x<118;x+=3)R(x,31,3,(x/3)%2?2:1,'#8f8b85');for(let x=66;x<116;x+=7)R(x,7,1,24,'#86827c');
 R(66,30,6,3,'#d23f4a');R(68,29,2,1,'#e8616b');R(72,31,3,2,'#7a4a2c');
 box(66,35,50,9,'#f3f3f0','#cfcfc9');for(let x=68;x<115;x+=2)R(x,36,1,7,'#dcdcd6');
 // wall of memories above the desk: photo-booth strips, birthday note, ECG, watercolour, dog poster, heart over the lamp
 [[121,8,'#c0504d'],[125,10,'#4f81bd'],[129,7,'#e3b33a']].forEach(([x,y,c])=>{box(x,y,3,11,'#f4f1ea','#b9b4aa');for(let k=0;k<3;k++)R(x+1,y+1+k*3,1,2,c)});
 box(133,6,12,4,'#62cdbf','#3e9e92');R(135,7,8,1,'#f4fffd');
 box(133,12,12,9,'#f5dada','#d6b0b0');for(let k=0;k<3;k++){R(134,14+k*2,10,1,'#e7a5a8');P(136+k*3,13+k*2,'#c4444f')}
 box(148,5,13,7,'#e8e2c8','#b7ae8e');R(149,8,11,3,'#7fa35a');R(153,6,3,3,'#c99a3c');
 box(148,14,9,10,'#3b2a22','#24180f');R(150,16,5,4,'#c49a6c');R(151,20,4,2,'#a97b52');P(151,17,'#1b1626');R(149,22,7,1,'#e9e2d8');
 spr(HEART5,159,16,{k:'#b8323f',p:'#e8505b'});box(134,23,4,4,'#f4e48a','#d7c45e');
 // paper cart with the blue folder
 box(120,32,12,14,'#ececec','#bcbcbc');R(121,37,10,1,'#bcbcbc');R(121,41,10,1,'#bcbcbc');R(120,30,13,2,'#3f8fe0');R(121,29,11,1,'#f7f5ee');R(122,33,8,3,'#f7f5ee');R(122,38,8,2,'#e2c26a');
 // black desk, laptop, linen lamp with pale-blue base (warm glow)
 R(133,32,33,2,'#22201f');R(134,34,1,12,'#22201f');R(164,34,1,12,'#22201f');line(135,35,163,45,'#3a3836');
 R(140,24,10,7,'#3b3f48');R(141,25,8,5,nt?'#3f5f9a':'#56688c');R(139,31,12,1,'#a2a7ae');
 g.globalAlpha=nt?0.3:0.12;R(156,20,11,11,'#ffd88a');R(158,18,7,15,'#ffd88a');g.globalAlpha=1;
 R(158,23,6,5,'#ead7a6');R(158,23,6,1,'#d9c08a');R(159,28,4,3,'#a9cdc6');R(160,31,2,1,'#8fb3ac');
 // wooden chair with her black bag
 R(140,37,10,1,'#8f8a85');R(140,38,10,2,'#b27a3e');R(141,40,1,6,'#9a6533');R(148,40,1,6,'#9a6533');R(148,26,2,12,'#b27a3e');R(146,28,2,1,'#b27a3e');R(146,32,2,1,'#b27a3e');
 R(149,29,5,10,'#15141a');R(150,27,1,2,'#15141a');R(153,27,1,2,'#15141a');
 // white side table, cream drawer box, plant, mirror
 R(166,34,20,2,'#f6f6f3');R(166,36,20,1,'#d8d8d2');R(167,37,2,9,'#f0f0ec');R(183,37,2,9,'#f0f0ec');
 box(170,25,12,9,'#efe6d2','#c9bfa8');R(171,29,10,1,'#c9bfa8');R(175,27,2,1,'#6b4a2e');R(175,31,2,1,'#6b4a2e');
 R(173,21,6,4,'#7c8a52');R(174,20,4,1,'#8f9c63');[[172,15],[175,13],[178,16],[170,18],[180,19],[176,17]].forEach(([x,y],i)=>{R(x,y,3,2,i%2?'#4f8a4a':'#5c9c55');P(x+1,y+2,'#3f7a3c')});
 R(167,29,2,5,'#9fb4c8');box(183,27,4,7,'#cfe0ea','#c49a62');
 // little white oil heater at the foot of the bed
 R(187,38,7,7,'#f2f2ef');for(let x=187;x<194;x+=2)R(x,38,1,7,'#d6d6d0');R(188,45,1,1,'#b3ada3');R(192,45,1,1,'#b3ada3');
 // floor mattress, patchwork duvet, striped pillow, teal frog plush
 R(196,41,46,5,'#1f2433');R(196,40,46,1,'#2b3145');
 R(226,35,12,5,'#ddd5c9');for(let x=227;x<238;x+=2)R(x,35,1,5,'#bfb3a2');
 if(!o.bedInUse){duvet(197,226,37,2);R(197,41,4,3,PATCH[2]);R(210,41,5,2,PATCH[1])}
 if(!o.noFrog)frogPlush(230,25);
}
function kitchenHer(d){
 R(0,0,100,46,'#f3ead8');R(0,0,100,5,'#e3d6bd');R(0,19,72,15,'#e9dfca');for(let x=0;x<72;x+=6)R(x,19,1,15,'#ddd0b6');for(let y=19;y<34;y+=5)R(0,y,72,1,'#ddd0b6');
 R(0,46,100,9,'#b98e66');R(0,46,100,1,'#8a6444');for(let x=0;x<100;x+=14)R(x+3,47,1,8,'#a67d57');R(0,44,100,2,'#6e4a2e');
 box(2,6,42,12,'#f6f1e7','#b8ab95');R(23,7,1,10,'#d8cdb8');P(21,14,'#9c8e78');P(25,14,'#9c8e78');
 R(0,34,72,2,'#6b5a4a');R(0,36,72,10,'#d9cdb8');R(0,40,72,1,'#c4b79f');
 box(22,36,16,10,'#f4f3f0','#9b9792');R(24,39,12,5,'#2b2930');R(23,33,5,1,'#1e1c22');R(31,33,5,1,'#1e1c22');
 box(48,27,9,7,'#f2f2f2','#8a8a90');R(49,29,7,1,'#c9c9cf');P(55,31,'#e04a4a');box(60,29,6,5,'#d24b4b','#8a2a2a');R(62,28,2,1,'#8a2a2a');
 box(76,10,20,18,'#5b3a26','#3b2416');winView(78,12,16,14,'her',false);R(85,12,2,14,'#5b3a26');
 R(80,26,3,2,'#c2703f');R(81,23,1,3,'#5c9c55');
}

/* ---------- bathroom (shared shape, owner colours, 110 wide) ---------- */
function bathroom(d){const rr=d.owner==='rocky',tile=rr?'#dde6ea':'#f2e5eb',grout=rr?'#ccd7dc':'#e4d2db';
 R(0,0,110,46,tile);for(let x=0;x<110;x+=6)R(x,4,1,42,grout);for(let y=4;y<46;y+=6)R(0,y,110,1,grout);R(0,0,110,4,'#cfd5d9');
 R(0,46,110,9,rr?'#9aa3aa':'#b9a7b0');for(let x=0;x<110;x+=8)R(x,46,1,9,rr?'#8a939a':'#a8959f');R(0,46,110,1,'#7d868d');
 box(12,23,14,11,'#fbfbfb','#9aa1a8');R(14,24,10,1,'#e8ecef');R(17,22,4,1,'#9aa1a8');
 R(9,34,20,1,'#9aa1a8');R(9,35,20,3,'#fbfbfb');R(11,38,16,3,'#f1f3f5');R(13,41,12,4,'#e6e9ec');R(13,45,12,1,'#9aa1a8');
 R(31,29,6,1,'#9aa1a8');R(32,30,4,4,'#ffffff');R(32,33,4,1,'#e3e6e9');
 box(42,8,16,14,'#cfe3ea','#8a9aa0');R(44,10,4,1,'#ffffff');R(45,11,2,1,'#ffffff');
 R(41,28,18,3,'#fbfbfb');R(41,28,18,1,'#9aa1a8');R(48,31,4,15,'#e8ecef');R(49,25,2,3,'#9aa1a8');R(53,26,2,2,rr?'#5f87c4':'#e89aac');
 R(62,16,12,1,'#9aa1a8');R(63,17,10,13,rr?'#5f87c4':'#e89aac');R(63,26,10,1,'rgba(255,255,255,0.4)');
 R(78,6,26,38,rr?'#c9dbe2':'#ead7df');R(96,4,1,6,'#9aa1a8');R(92,10,7,2,'#9aa1a8');
 R(80,20,2,4,'#7fd6c2');R(83,21,2,3,'#ff9fb6');R(79,24,8,1,'#9aa1a8');R(76,44,30,2,'#e8ecef');
 R(70,47,4,3,'#ffd23f');R(72,45,3,2,'#ffd23f');P(75,46,'#ff8a1f');P(73,45,'#1b1626');
}
function glass(){R(76,8,1,36,'#8a9aa0');R(105,8,1,36,'#8a9aa0');R(76,8,30,1,'#8a9aa0');R(77,28,28,16,'rgba(236,246,250,0.6)');R(77,28,28,1,'#ffffff');line(80,42,86,30,'rgba(255,255,255,0.55)')}

/* ---------- outdoor + lab scenes ---------- */
function tree(x,y,sn,n){const lf=n?'#1f3529':'#3f6b4a';R(x+4,y+13,3,8,n?'#3a2a1e':'#6b4b35');R(x,y+4,11,10,lf);R(x+2,y,7,4,lf);if(sn){R(x+2,y,7,1,'#ffffff');R(x,y+4,4,1,'#ffffff');R(x+7,y+4,4,1,'#ffffff');R(x+1,y+9,3,1,'#f2f6f8')}else{R(x+2,y+1,3,1,n?'#2c4a38':'#4f8058');R(x+1,y+6,3,1,n?'#2c4a38':'#4f8058')}}
function campusX(){const p=TICK%290;return p<249?-12+p:237}
function lamp(x,n){R(x,18,1,28,'#3b3f48');R(x-2,16,5,2,'#3b3f48');P(x,18,n?'#ffe08a':'#c9c9b0');if(n){R(x-4,18,9,4,'rgba(255,220,140,0.22)');R(x-6,45,13,2,'rgba(255,220,140,0.18)')}}
function sCampus(d){const who=d.owner,rr=who==='rocky',t=TICK,p=t%290,n=isNight(),c=wxCond(who),sn=c==='snow';
 R(d.cam-1,0,82,55,skyCol(who));skyDeco(who,d.cam,0,80,18);
 for(let i=0;i<24;i++){const x=i*17+Math.floor(d.cam*0.5);R(x,22-((i*7)%5),9,20,n?'#232a40':'#8fa3b2')}
 R(0,38,300,8,sn?'#eef2f6':(n?'#232c26':'#6f7d62'));if(!sn)for(let i=0;i<50;i++)P((i*29)%300,39+(i%6),n?'#1b221d':'#5f6d54');
 R(0,46,300,9,n?'#3a3e46':'#9aa0a8');R(0,46,300,1,n?'#2c3038':'#878d96');for(let x=0;x<300;x+=10)R(x,47,1,8,n?'#30343c':'#8d939b');
 if(c==='rain')for(let i=0;i<8;i++)R(i*37+11,50+(i%3),7,1,n?'#4f5f7a':'#b8c8d8');
 const brick=rr?'#a4563f':'#cfd4d9',trim=rr?'#7d3f2d':'#8e969e',lit=n?'#ffd27a':(rr?'#f3e7c4':'#bcd3e2');
 box(200,6,100,40,brick,trim);R(198,4,104,3,n?'#2d3038':'#5b5f6a');if(sn)R(198,3,104,1,'#ffffff');
 if(!rr)for(let x=203;x<298;x+=12)R(x,7,1,38,'#b9c0c6');
 const sx=rr?234:220,sw=rr?19:46;
 for(let r=0;r<2;r++)for(let cc=0;cc<7;cc++){const wx=204+cc*13,wy=10+r*12;if(cc===3&&r===1)continue;if(wx+8>sx&&wx<sx+sw&&wy+7>22&&wy<31)continue;box(wx,wy,8,7,n&&hr(r*7+cc)>0.7?'#3a3a48':lit,trim)}
 if(rr){box(sx,22,sw,9,'#20304d','#141e33');text('LUT',sx+4,24,'#ffffff')}else{box(sx,22,sw,9,'#ffffff','#1b1626');text('METROPOLIA',sx+3,24,'#1b1626')}
 const inside=p>=262;box(236,32,15,14,inside||n?'#ffe7a0':'#3a3542','#22202a');R(243,32,1,14,'#22202a');
 tree(20,24,sn,n);tree(78,24,sn,n);tree(140,24,sn,n);[50,110,170].forEach(x=>lamp(x,n));
 for(let b=0;b<2;b++){const bx=182+b*10;R(bx,40,7,1,'#3b3f48');box(bx-2,40,4,4,sn?'#eef2f6':'#6f7d62','#2c3038');box(bx+5,40,4,4,sn?'#eef2f6':'#6f7d62','#2c3038')}
 const x=campusX(),y=TOP+(d.hop||0);
 if(p<249){if(rr)box(x+1,y+11,4,6,'#3c4e3e','#1b2a1d');walker(who,x,y,1,p);if(!rr){line(x+6,y+11,x+9,y+15,'#9c8460');box(x+8,y+15,4,5,'#e2cca6','#9c8460')}}
 else if(p<262){person(who,x,y-(p-249>>2),{back:true});if(rr)box(x+3,y+11-(p-249>>2),6,6,'#3c4e3e','#1b2a1d')}
 wxFx(who,d.cam,0,80,55,false,1);
 d.anchor={x,y};
}
function wheel(cx,cy){R(cx-3,cy-5,7,11,'#1c1c22');R(cx-5,cy-3,11,7,'#1c1c22');R(cx-4,cy-4,9,9,'#1c1c22');R(cx-2,cy-2,5,5,'#8d939c');const a=TICK*0.6;P(cx+Math.round(Math.cos(a)*2),cy+Math.round(Math.sin(a)*2),'#3b3f47');P(cx,cy,'#3b3f47')}
function sBus(d){const t=TICK,who=d.owner,rr=who==='rocky',n=isNight(),c=wxCond(who),sn=c==='snow';
 R(0,0,80,55,skyCol(who));skyDeco(who,0,0,80,14);
 const s1=t*0.25,b1=Math.floor(s1/22);for(let i=-1;i<6;i++){const idx=b1+i,x=i*22-(s1%22),h=10+hr(idx)*16;R(x,40-h,18,h+6,n?'#252b42':'#a3b6c8');for(let wy=42-h;wy<40;wy+=4)for(let wx=2;wx<16;wx+=4)R(x+wx,wy,2,2,n?(hr(idx*31+wy*7+wx)>0.55?'#ffd27a':'#2f3550'):'#c3d2df')}
 const s2=t*1,b2=Math.floor(s2/40);for(let i=-1;i<4;i++){const idx=b2+i,x=i*40-(s2%40);if(hr(idx+3)>0.45)tree(x+8,22,sn,n);else lamp(x+20,n)}
 R(0,43,80,3,sn?'#e8edf2':(n?'#2a2f38':'#8a929a'));R(0,46,80,9,n?'#33353d':'#4b4d57');for(let i=0;i<7;i++)R(i*14-(t*2%14),50,7,1,'#e9e4cf');
 const bob=t%6<3?0:1,bx=3,by=15+bob;
 if(rr){box(bx,by,74,26,'#e8559a','#9c2a62');R(bx+2,by-1,70,1,'#d94a8c');R(bx+1,by+19,72,2,'#ffd3e6');R(bx+1,by+22,72,3,'#b83a78')}
 else{box(bx,by,74,26,'#f4f6f8','#7d8a96');R(bx+50,by+1,23,24,'#007ac9');R(bx+2,by-1,70,1,'#dfe4e8');R(bx+1,by+22,72,3,'#c3ccd4');R(bx+50,by+22,23,3,'#005e9c')}
 const glassC=n?'#3b4a66':'#2b3b52';
 for(let i=0;i<3;i++){const wx=bx+3+i*17;box(wx,by+3,15,15,glassC,'#16202e');P(wx+2,by+5,'#6f87a3');P(wx+3,by+6,'#6f87a3')}
 box(bx+57,by+7,15,12,glassC,'#16202e');R(bx+57,by+1,15,5,'#14141a');
 g.save();g.beginPath();g.rect(bx+57,by+1,15,5);g.clip();const msg=rr?'LUT UNIVERSITY':'METROPOLIA',L=tw(msg)+18;text(msg,bx+72-(Math.floor(t*0.6)%L),by+1,'#ffb030');g.restore();
 R(bx+72,by+19,2,2,'#ffe08a');if(n)R(bx+74,by+18,6,3,'rgba(255,230,150,0.35)');
 [0,2].forEach(i=>{const wx=bx+3+i*17;R(wx+5,by+7,5,5,'#4d5d73');R(wx+3,by+12,9,5,'#4d5d73')});
 const cx=bx+3+17+1;person(who,cx,by+4+(d.hop||0),{headOnly:true,closed:blink(5)});
 wheel(bx+14,by+27);wheel(bx+58,by+27);
 wxFx(who,0,0,80,55,false,1.2);
 d.anchor={x:cx,y:by+4};
}
function wallClock(cx,cy){R(cx-3,cy-5,7,11,'#2c3a40');R(cx-5,cy-3,11,7,'#2c3a40');R(cx-4,cy-4,9,9,'#2c3a40');R(cx-2,cy-4,5,9,'#fbfbf8');R(cx-4,cy-2,9,5,'#fbfbf8');R(cx-3,cy-3,7,7,'#fbfbf8');
 const dt=new Date(),ha=((dt.getHours()%12)+dt.getMinutes()/60)/12*Math.PI*2-Math.PI/2,ma=dt.getMinutes()/60*Math.PI*2-Math.PI/2;
 line(cx,cy,cx+Math.cos(ha)*2,cy+Math.sin(ha)*2,'#1b1626');line(cx,cy,cx+Math.cos(ma)*3,cy+Math.sin(ma)*3,'#c23b33')}
function labX(){const p=TICK%130;return p<50?92:p<62?92-(p-50)*4:p<110?44:44+Math.round((p-110)*2.4)}
function hLab(d){const t=TICK,p=t%130;
 R(0,0,172,55,'#e2eeea');for(let x=0;x<172;x+=10)R(x,0,1,38,'#d0e1dc');for(let y=4;y<38;y+=10)R(0,y,172,1,'#d0e1dc');
 R(4,15,60,2,'#8f9ea0');['#b8742c','#3c79d6','#dfe9ef','#5aa36b','#b8742c','#9b6ad0','#dfe9ef'].forEach((c,i)=>{R(7+i*8,7,5,8,c);R(8+i*8,5,3,2,'#46505a')});
 box(8,20,24,9,'#ffffff','#2a7f6a');text('LAB',16,22,'#2a7f6a');R(10,24,3,1,'#e04a4a');P(11,23,'#e04a4a');P(11,25,'#e04a4a');
 box(124,4,40,30,'#d7e3e6','#8a9aa0');R(126,6,36,22,'#bcd6de');R(126,20,36,1,'#8a9aa0');R(132,24,14,3,'#e7eaee');for(let i=0;i<3;i++)R(134+i*4,21,2,3,['#e04a4a','#3c79d6','#e6b737'][i]);
 wallClock(106,12);
 const x=labX(),y=22+(d.hop||0),atScope=p>=62&&p<110,atRack=p<50,moving=!atScope&&!atRack;
 if(moving)walker('her',x,y,p<62?-1:1,p,{coat:true,noLegs:true,pal:COAT});
 else person('her',x,y,{coat:true,noLegs:true,hd:atScope?2:0,closed:atScope||blink(2)});
 if(atRack){line(x+9,y+12,x+10,y+7,'#ffffff');P(x+10,y+6,PAL.her.s);R(x+10,y-4,1,10,'#e8eef2');R(x+9,y-6,3,2,'#6aa8d8');const k=t%8;if(k<5)P(x+10,y+7+k,'#a8323c')}
 R(0,38,172,3,'#353b45');R(0,41,172,14,'#c6d0d6');[0,43,86,129].forEach(cx=>{R(cx,41,1,14,'#a9b4bb');R(cx+19,47,5,1,'#8a959c')});
 R(47,35,12,3,'#2f3440');R(55,22,3,13,'#e4e8ec');R(54,22,1,13,'#9aa3ad');R(48,30,10,2,'#2f3440');R(51,26,3,4,'#9aa3ad');R(51,27,3,5,'#2f3440');P(50,29,'#ffe08a');
 box(92,34,22,4,'#e7eaee','#7b8792');
 const caps=['#d23b3b','#8b5cc7',null,'#8a8f99','#e6b737'];
 for(let i=0;i<5;i++){const tx=94+i*4;R(tx,28,2,7,'#f2f5f8');R(tx,32,2,3,i===2?'#d88a96':'#a8323c');if(caps[i])R(tx,26,2,2,caps[i])}
 R(125,24,3,4,'#dfe9ef');R(124,28,5,3,'#dfe9ef');R(122,31,9,4,'#7fd6c2');R(122,35,9,1,'#5fb9a5');
 for(let i=0;i<3;i++)P(125+((t+i)%3),31-((t*0.5+i*4)%9),'#bff3e6');
 d.anchor={x,y:22};
}

/* ---------- activity scenes ---------- */
const IDLE_LONG=200; /* 20 s in this mock-up; 5 min (3000 ticks) on the real device */
const CHORES={rocky:[
 {k:'pet',label:'PETTING BRUNO',x:d=>Math.min(262,d.dog.x+16),dur:80},
 {k:'fetch',label:'PLAYING FETCH',x:()=>40,dur:110},
 {k:'guitar',label:'PLAYING GUITAR',x:()=>194,dur:90},
 {k:'printer',label:'CHECKING THE PRINTER',x:()=>159,dur:70},
 {k:'window',label:'LOOKING OUTSIDE',x:()=>88,dur:60}],
 her:[
 {k:'frog',label:'HUGGING FROGGY',x:d=>d.me.x,dur:90},
 {k:'plant',label:'WATERING THE PLANT',x:()=>162,dur:70},
 {k:'mirror',label:'CHECKING THE MIRROR',x:()=>168,dur:60},
 {k:'window',label:'LOOKING OUTSIDE',x:()=>85,dur:60}]};
function choreTick(d){const m=d.me;
 if(TICK-d.statusAt<IDLE_LONG){d.chore=null;return false}
 if(!d.chore){if(m.wait>0){m.wait--;return true}const L=CHORES[d.owner].filter(c=>c.k!==d.lastChore);const c=L[(Math.random()*L.length)|0];d.chore={c,phase:'walk',tx:Math.round(c.x(d)),t0:TICK};d.lastChore=c.k}
 const ch=d.chore;
 if(ch.phase==='walk'){const dx=Math.sign(ch.tx-m.x);if(dx){m.x+=dx;m.face=dx;m.step++}else{ch.phase='do';ch.t0=TICK;d.toast={s:ch.c.label,t0:TICK}}return true}
 if(TICK-ch.t0>=ch.c.dur){d.chore=null;m.wait=40;m.tx=m.x}
 return true}
function fetchDog(d){const ch=d.chore,m=d.me,dg=d.dog,k=TICK-ch.t0;ch.land=ch.land||Math.min(262,m.x+60);dg.moving=false;if(k<20)return;
 const tx=ch.got?m.x+14:ch.land-8,dx=tx-dg.x;if(Math.abs(dx)>1){dg.x+=Math.sign(dx)*2;dg.flip=dx<0;dg.moving=true;dg.step++}else if(!ch.got)ch.got=true;else dg.flip=true}
function choreDraw(d,L,y){const ch=d.chore,c=ch.c,x=d.me.x,k=TICK-ch.t0,who=d.owner,dg=d.dog;
 const hearts=(hx,hy)=>{for(let i=0;i<3;i++){const kk=(k+i*10)%30;spr(HEART5,hx+i*4-4,Math.round(hy-kk/2),HP)}};
 const dogNormal=()=>L.push({fy:FL+1,draw:()=>dog(dg.x,FL-10-(dg.moving&&(dg.step>>1)&1?1:0),{flip:dg.flip})});
 if(who==='rocky'){
  if(c.k==='pet'){L.push({fy:FL,draw:()=>{walker(who,x,y,-1,0,{legs:LEGSS[0]});line(x+1,y+13,dg.x+11,FL-9+((k>>2)&1),PAL.rocky.s)}});
   L.push({fy:FL+1,draw:()=>{dog(dg.x,FL-10,{sleep:true});P(dg.x,FL-10+(k%4<2?4:5),DOGP.k);P(dg.x-1,FL-10+(k%4<2?3:6),DOGP.k);hearts(dg.x+10,FL-16)}})}
  else if(c.k==='fetch'){const land=ch.land||Math.min(262,x+60),t=Math.min(1,k/18),bx=Math.round(x+12+(land-x-12)*t),by=Math.round(y+12-Math.sin(t*Math.PI)*16+t*8);
   L.push({fy:FL,draw:()=>{walker(who,x,y,1,0,{legs:LEGSS[0]});if(k<6)line(x+8,y+12,x+11,y+7,PAL.rocky.s)}});
   L.push({fy:FL+1,draw:()=>{dog(dg.x,FL-10-(dg.moving&&(dg.step>>1)&1?1:0),{flip:dg.flip});const ball=(px,py)=>{R(px,py,2,2,'#d9e84a');P(px,py,'#f4ff9a')};
    if(!ch.got)ball(k<18?bx:land,k<18?by:FL-2);else ball(dg.flip?dg.x-1:dg.x+14,FL-5);
    if(ch.got&&Math.abs(dg.x-(x+14))<3)hearts(x+8,y-4)}})}
  else if(c.k==='guitar'){L.push({fy:FL,draw:()=>{person(who,x,y,{closed:(k%30)<10});R(x+1,y+12,6,5,'#dc9d52');R(x+2,y+13,3,3,'#b8352e');P(x+3,y+14,'#3b2a1c');R(x+7,y+12,6,1,'#6b4a2e');R(x+12,y+11,2,2,'#3b2a1c');P(x+4,y+15+((k>>1)&1),PAL.rocky.s);
    for(let i=0;i<3;i++){const kk=(k+i*11)%33,nx=x+10+i*5+Math.round(Math.sin((k+i*7)*0.3)*2),ny=Math.round(y-2-kk/2);R(nx,ny,1,4,'#1b1626');R(nx-2,ny+3,2,2,'#1b1626')}}});dogNormal()}
  else if(c.k==='printer'){L.push({fy:FL,draw:()=>{person(who,x,y,{back:true});if(k%40<22){box(x+11,y-9,9,7,'#ffffff','#1b1626');text(k<40?'!':'*',x+14,y-8,'#3c79d6')}}});dogNormal()}
  else{L.push({fy:FL,draw:()=>person(who,x,y,{back:true})});dogNormal()}
 }else{
  if(c.k==='frog'){const b=k%20<10?0:-1;L.push({fy:FL,draw:()=>{person(who,x,y+b,{closed:true});frogPlush(x+1,y+9+b);hearts(x+6,y-3)}})}
  else if(c.k==='plant'){L.push({fy:FL,draw:()=>{person(who,x,y,{back:true});line(x+10,y+12,x+11,y-6,PAL.her.s);R(x+10,y-8,4,3,'#3c79d6');line(x+14,y-8,x+15,y-10,'#3c79d6');for(let i=0;i<3;i++)P(x+15,y-9+((k+i*3)%5),'#8fd3ff');if(k>40&&k%6<3)P(173+((k>>2)%6),14+((k>>3)%4),'#fff6c8')}})}
  else if(c.k==='mirror'){L.push({fy:FL,draw:()=>{walker(who,x,y,1,0,{legs:LEGSS[0]});const bb=(k>>2)&1;R(x+10,y+5+bb,1,4,'#c49a62');R(x+10,y+4+bb,2,2,'#1b1626');if(k%16<8){P(185,26,'#ffffff');P(184,27,'#ffffff');P(186,27,'#ffffff');P(185,28,'#ffffff')}}})}
  else L.push({fy:FL,draw:()=>person(who,x,y,{back:true})});
  if(c.k!=='frog')L.push({fy:FL+1,draw:()=>frogPet(dg)});
 }}
function sIdle(d){const m=d.me,who=d.owner,rr=who==='rocky',ch=d.chore,doing=ch&&ch.phase==='do';
 rr?roomRocky(d,{noGuitar:doing&&ch.c.k==='guitar'}):roomHer(d,{noFrog:true});
 if(doing){const L=[];choreDraw(d,L,TOP+(d.hop||0));sortDraw(L);d.anchor={x:m.x,y:TOP};return}
 const walking=m.wait<=0&&m.tx!==m.x,L=[],y=TOP+(d.hop||0);
 L.push({fy:FL,draw:()=>walking?walker(who,m.x,y,m.face,m.step):person(who,m.x,y,{closed:blink(rr?1:4)})});
 const dg=d.dog;L.push({fy:FL+1,draw:()=>rr?dog(dg.x,FL-10-(dg.moving&&(dg.step>>1)&1?1:0),{flip:dg.flip}):frogPet(dg)});
 sortDraw(L);d.anchor={x:m.x,y:TOP};
}
const HOSTX={rocky:66,her:96},AWAYX={rocky:69,her:99};
function visitor(){return dockCount%2===1?'rocky':'her'}
function sVisit(d,v){const who=d.owner,k=TICK-dockT,rr=who==='rocky';rr?roomRocky(d):roomHer(d,{noFrog:true});
 const hx=HOSTX[who],fromLeft=v==='rocky',hop=d.hop||0,L=[];
 const vx=fromLeft?Math.min(hx-16,hx-80+k):Math.max(hx+16,hx+80-k),moving=fromLeft?vx<hx-16:vx>hx+16;
 const rx=v==='rocky'?vx:hx,hz=v==='rocky'?hx:vx;
 L.push({fy:FL,draw:()=>person(who,hx,TOP+hop,{closed:blink(1)})});
 L.push({fy:FL+0.5,draw:()=>moving?walker(v,vx,TOP,fromLeft?1:-1,k):person(v,vx,TOP+hop,{closed:blink(6)})});
 if(moving){
  if(fromLeft){L.push({fy:FL+1,draw:()=>dog(vx-16,FL-10-((k>>1)&1),{})});L.push({fy:FL+1.2,draw:()=>frogPlush(hx+14,FL-10)})}
  else{L.push({fy:FL+1,draw:()=>dog(hx-17,FL-10,{})});L.push({fy:FL+1.2,draw:()=>frogPlush(vx+14,FL-10-(((k>>1)&3)===1?2:0))})}
 }else{
  // playtime: Bruno and the frog sit beside their humans, then every few seconds run to meet in front of you
  const pk=TICK-dockT,t=pk%100,L0=rx-17,R0=hz+14,meet=Math.round((rx+hz)/2)+1,s=t<60?0:Math.sin((t-60)/40*Math.PI);
  const dxB=Math.round(L0+s*(meet-10-L0)),dxF=Math.round(R0-s*(R0-meet-2)),fwd=Math.round(s*2);
  L.push({fy:FL+1,draw:()=>dog(dxB,FL-10+fwd-(s>0.05?(pk>>1)&1:0),{})});
  L.push({fy:FL+1.2,draw:()=>frogPlush(dxF,FL-10+fwd-(((pk>>1)&3)===1?2:0))});
  if(s>0.85)spr(HEART5,meet-3,FL-15+fwd-((pk>>2)&1),HP);
 }
 sortDraw(L);
 const mx=Math.min(hx,vx);
 if(!moving){spr(BIGHEART,mx+13,TOP-9+Math.round(Math.sin(TICK*0.25)),HP);for(let i=0;i<3;i++){const kk=(TICK+i*12)%36;spr(HEART5,mx+8+i*6,TOP-5-kk,HP)}}
 d.anchor={x:hx,y:TOP};
}
function sAway(d){d.owner==='rocky'?roomRocky(d):roomHer(d);d.anchor=null}
function rCodingOld(d){roomRocky(d,{coding:true});dog(192,27,{lie:true,sleep:true});
 const x=108,y=27,typ=(TICK>>1)&1;person('rocky',x,y+(typ?0:1),{back:true,noLegs:true});
 box(107,40,14,7,'#2b2930','#16141a');R(113,47,2,3,'#16141a');R(109,50,10,1,'#16141a');P(109,51,'#16141a');P(118,51,'#16141a');
 if(TICK%40<14){box(93,4,13,7,'#ffffff','#1b1626');text('</>',94,5,'#3c79d6')}
 d.anchor={x,y};
}
function rStudy(d){roomRocky(d);dog(166,43,{lie:true,sleep:(TICK%120)>60});
 const x=196,y=22;person('rocky',x,y,{closed:false});
 R(x+2,y+12,8,5,'#2f5f9e');R(x+3,y+12,3,4,'#f8f3e3');R(x+6,y+12,3,4,'#f3ecd8');R(x+4,y+13,2,1,'#b9b2a0');R(x+7,y+14,2,1,'#b9b2a0');
 if(TICK%40<4)R(x+5,y+10,2,6,'#ffffff');P(x+2,y+14,PAL.rocky.s);P(x+9,y+14,PAL.rocky.s);
 d.anchor={x,y};
}
function projX(){const p=TICK%256;return p<60?72:p<128?72+(p-60):p<188?140:140-(p-188)}
function sparkle(x,y){const k=TICK%6;if(k<4){P(x,y-1,'#fff6c8');P(x,y+1,'#fff6c8');P(x-1,y,'#fff6c8');P(x+1,y,'#fff6c8')}if(k<2)P(x,y,'#ffffff')}
function rProjects(d){roomRocky(d,{coding:true});dog(192,27,{lie:true,sleep:true});
 const p=TICK%256,x=projX(),y=TOP+(d.hop||0),sk=PAL.rocky.s;
 if(p<60){walker('rocky',x,y,1,0,{legs:LEGSS[0]});line(x+8,y+15,x+12,y+13,sk);line(x+12,y+13,x+16,y+8,'#e6b737');sparkle(91,24+(p%20<10?0:4));
  if(p%30<12){box(x-2,y-10,13,7,'#ffffff','#1b1626');text('</>',x-1,y-9,'#3c79d6')}}
 else if(p<128)walker('rocky',x,y,1,p);
 else if(p<188){walker('rocky',x,y,1,0,{legs:LEGSS[0]});const q=p-128;line(x+8,y+14,x+14,y+5+(q<30?0:3),sk);if(q<30)sparkle(166,27);else spr(HEART5,x+12,y-1,{k:'#c4446a',p:'#ff7aa0'})}
 else walker('rocky',x,y,-1,p);
 d.anchor={x,y};
}
function cart(x,y,n){const f='#7d8792',it=[['#d23b3b',3,3],['#f2d06b',4,2],['#3c79d6',2,5],['#5aa36b',3,3],['#ffffff',2,5],['#c2703f',3,3]];
 let ix=x+1;for(let i=0;i<n&&ix<x+12;i++){const [c,w,h]=it[i%6];R(ix,y+3-h,Math.min(w,x+13-ix),h+3,c);ix+=w+1}
 R(x,y,14,1,f);R(x,y+6,14,1,f);for(let i=0;i<15;i+=3)R(x+i,y,1,7,f);R(x,y+3,14,1,'rgba(125,135,146,0.6)');
 R(x-3,y-1,4,1,'#c23b33');R(x+1,y+7,1,5,f);R(x+12,y+7,1,5,f);R(x+1,y+9,12,1,f);R(x,y+12,3,2,'#2b2930');R(x+11,y+12,3,2,'#2b2930')}
function shopX(p){return p<40?-10+p:p<60?30:p<170?30+(p-60):p<190?140:p<220?140+(p-190):170}
function sShop(d){const who=d.owner,p=TICK%270,n=isNight();
 R(0,0,222,46,'#eef0ea');R(0,0,222,4,'#d7dbd3');for(let x=10;x<222;x+=34)R(x,4,14,1,'#ffffff');
 R(0,46,222,9,'#d9dcd6');for(let x=0;x<222;x+=6)for(let y=46;y<55;y+=3)if(((x/6)+(y-46)/3)%2<1)R(x,y,6,3,'#cdd1ca');R(0,46,222,1,'#a9ada6');
 box(0,10,20,36,'#3a3f48','#262a30');R(2,12,8,34,skyCol(who));R(11,12,7,34,skyCol(who));R(10,12,1,34,'#262a30');line(4,40,8,16,'rgba(255,255,255,0.35)');
 const crates=[['#d23b3b',24],['#f2d06b',36],['#5aa36b',48],['#ff8a1f',60]];
 crates.forEach(([c,x])=>{R(x-1,38,11,8,'#a87b4f');R(x-1,38,11,1,'#8a5f38');for(let i=0;i<4;i++)for(let j=0;j<2;j++)R(x+i*2+(j%2),35+j*2,2,2,c)});
 R(70,10,46,36,'#c9ccc4');for(const y of [17,25,33,41])R(70,y,46,1,'#8e938b');
 for(let r=0;r<4;r++)for(let i=0;i<9;i++){const h=3+(hr(r*9+i)*4|0);R(71+i*5,10+r*8+7-h,4,h,BOOK[(hr(r*13+i)*BOOK.length)|0])}
 box(122,8,40,38,'#dfeaf0','#6f7d86');for(let i=0;i<3;i++){const fx=124+i*13;R(fx,10,12,34,'#eaf6fb');R(fx+12,10,1,34,'#6f7d86');for(let r=0;r<3;r++)for(let k=0;k<3;k++)R(fx+1+k*4,14+r*10,3,6,r===1?'#3c79d6':'#ffffff')}
 R(122,8,40,1,'#ffffff');
 R(176,34,40,3,'#3a3640');R(176,37,40,9,'#5b5f6a');R(178,35,26,1,'#2b2930');for(let i=0;i<4;i++)R(180+((TICK+i*6)%24),33,4,2,BOOK[i]);
 box(206,24,12,9,'#2b2930','#16141a');R(208,26,8,4,'#5fd3c8');R(212,33,2,2,'#2b2930');
 const items=(p>=50)+(p>=80)+(p>=110)+(p>=140)+(p>=185);
 if(p>=220){text((items*2.9).toFixed(2),186,17,'#1b1626');if(p%10<5)R(208,27,8,2,'#ffffff')}
 [['FRUIT',28],['FOOD',84],['MILK',134],['PAY',190]].forEach(([t,x])=>{R(x+tw(t)/2,0,1,4,'#9aa0a8');box(x-2,4,tw(t)+4,7,'#1f6f4a','#134a31');text(t,x,5,'#ffffff')});
 const x=shopX(p),y=TOP+(d.hop||0),stop=(p>=40&&p<60)||(p>=170&&p<190)||p>=220;
 if(stop){person(who,x,y,{closed:blink(2)});cart(x+13,y+9,items)}else{walker(who,x,y,1,p);cart(x+11,y+9,items)}
 if(p>=40&&p<60&&p%10<5)sparkle(x+14,y+2);
 d.anchor={x,y};
}
const GEN=[Object.assign({},PAL.rocky,{h:'#6b4a2e',H:'#8a6440',g:'#f0c9a6',e:'#1b1626',s:'#f0c9a6',S:'#d2a682',b:'#f0c9a6',c:'#5aa36b',C:'#447f52'}),
 Object.assign({},PAL.her,{h:'#c9a24a',H:'#e2c06a',s:'#f3d2b5',S:'#d9b394',b:'#f3d2b5',c:'#c0504d',C:'#9a3d3b'})];
function sStudyUni(d){const who=d.owner,rr=who==='rocky',t=TICK;
 const wall=rr?'#e9dfd2':'#eef1f3',trim=rr?'#8a5a3a':'#8e979f';
 R(0,0,120,46,wall);R(0,0,120,5,rr?'#d8cbb8':'#dde2e6');R(0,46,120,9,rr?'#9a7656':'#c2c7cc');R(0,46,120,1,rr?'#7a5a3e':'#a7adb3');for(let x=0;x<120;x+=10)R(x+4,47,1,8,rr?'#8a6848':'#b3b9be');
 for(let i=0;i<2;i++){const x=4+i*30;box(x,12,24,20,trim,trim);winView(x+2,14,20,16,who);R(x+12,14,1,16,trim);R(x+2,22,20,1,trim)}
 box(66,12,50,32,trim,trim);[20,28,36].forEach(y=>R(67,y,48,1,trim));shelfBooks(67,115,12,7);shelfBooks(67,115,20,37);shelfBooks(67,115,28,67);
 if(rr){box(34,2,49,8,'#20304d','#141e33');text('LUT LIBRARY',37,4,'#ffffff')}else{box(36,2,45,8,'#ffffff','#1b1626');text('METROPOLIA',39,4,'#1b1626')}
 person('rocky',14,22,{pal:GEN[0],noLegs:true,closed:(t%60)<20});
 person('her',92,22,{pal:GEN[1],noLegs:true,closed:blink(9)});
 const x=52,y=22;person(who,x,y,{noLegs:true,closed:blink(rr?2:5)});
 R(0,38,120,2,rr?'#7a5233':'#e3e6e9');R(0,40,120,1,rr?'#5a3a22':'#a7adb3');[4,56,112].forEach(lx=>R(lx,41,2,5,rr?'#5a3a22':'#8e979f'));
 [32,74].forEach(lx=>{R(lx,32,1,6,'#3b3f48');R(lx-2,30,5,2,'#2f7a4a');R(lx-1,32,3,1,'rgba(255,230,150,0.6)')});
 R(16,36,8,2,'#f8f3e3');R(94,36,8,2,'#f3ecd8');R(99,35,1,2,'#3c79d6');
 if(rr){box(x,30,12,8,'#c8ced6','#5d6670');P(x+5,33,'#ff6f91');const tp=(t>>1)&1;P(x+1+tp,y+15,PAL.rocky.s);P(x+10-tp,y+15,PAL.rocky.s)}
 else{R(x+1,36,10,2,'#f8f3e3');R(x+6,36,1,2,'#d9d2c3');const px=x+7+((t>>1)%3);line(px,35,px+2,32,'#3c79d6');P(x+9,y+14,PAL.her.s)}
 if(t%50<16){box(x+12,y-8,9,7,'#ffffff','#1b1626');text(rr?'?':'!',x+15,y-7,'#3c79d6')}
 d.anchor={x,y};
}
function eatAnim(who,x,y,food){const up=(TICK%16)>=10;person(who,x,y,{noLegs:who==='her',mouth:up,closed:blink(2)});bowl(x+2,y+11,food);steam(x+3,y+9);
 if(up){line(x+9,y+13,x+6,y+9,'#b07a4a');P(x+6,y+10,food)}else line(x+9,y+13,x+6,y+11,'#b07a4a')}
function rEat(d){roomRocky(d);const x=196,y=22;dog(174,FL-10,{});eatAnim('rocky',x,y,'#f2d06b');d.anchor={x,y}}
function rCook(d){roomRocky(d,{cooking:true});const x=21,y=TOP+(d.hop||0);pan(6,31,x,1);dog(40,FL-10,{flip:true});
 person('rocky',x,y,{closed:blink(2)});line(x+2,y+14,x-1,y+14,PAL.rocky.s);d.anchor={x,y}}
function rSleep(d){roomRocky(d,{night:true,bedInUse:true});person('rocky',229,26,{headOnly:true,closed:true});
 box(238,33,30,7,'#5c5e66','#3c3e46');R(239,34,28,1,'#73757e');R(246,37,18,1,'#4a4c55');
 dog(244,43,{lie:true,sleep:true,flip:true});night(d);zzz(240,20);d.anchor={x:229,y:26}}
function hStudy(d){roomHer(d,{noFrog:true});frogPlush(152,FL-10);const x=137,y=20,typ=(TICK>>1)&1;
 person('her',x,y+(typ?0:1),{back:true,noLegs:true});R(x+1,y+17,10,1,'#b27a3e');
 if(TICK%50<16){box(x+10,y-9,9,7,'#ffffff','#1b1626');text('!',x+13,y-8,'#3c79d6')}
 d.anchor={x,y}}
function hEat(d){roomHer(d,{noFrog:true});frogPlush(222,30);const x=206,y=24;eatAnim('her',x,y,'#f6f2ea');R(x-1,y+17,14,2,PATCH[1]);d.anchor={x,y}}
function hCook(d){kitchenHer(d);frogPlush(56,FL-10);const x=38,y=TOP+(d.hop||0);pan(24,31,x,1);person('her',x,y,{closed:blink(3)});line(x+2,y+14,x-1,y+14,PAL.her.s);d.anchor={x,y}}
function hSleep(d){roomHer(d,{night:true,bedInUse:true});person('her',217,23,{headOnly:true,closed:true});
 duvet(197,222,34,4);night(d);zzz(222,12);d.anchor={x:217,y:23}}
function sToilet(d){bathroom(d);const who=d.owner,x=13,y=22;person(who,x,y,{closed:false});
 R(x+4,y+12,4,3,'#2a2a33');R(x+5,y+12,2,2,'#9fd0ff');P(x+3,y+13,PAL[who].s);P(x+8,y+13,PAL[who].s);
 for(let i=0;i<2;i++)for(let j=0;j<5;j++){const yy=40-j*2-((TICK>>1)%2),xx=(i?31:6)+Math.round(Math.sin((TICK+j*3+i*5)*0.6));P(xx,yy,'rgba(140,200,80,0.85)')}
 if(TICK%60<20){box(x+12,y-9,13,7,'#ffffff','#1b1626');text('...',x+14,y-8,'#1b1626')}
 d.anchor={x,y}}
function sShower(d){bathroom(d);const who=d.owner,x=85,y=17,pal=Object.assign({},PAL[who],{g:PAL[who].s,t:PAL[who].s,T:PAL[who].s,E:'#1b1626',e:'#1b1626'});
 person(who,x,y,{pal,headOnly:true,closed:TICK%30<12});
 for(let i=0;i<5;i++){const dx=92+i*1.5,yy=12+((TICK*2+i*5)%16);P(dx,yy,'#8fd3ff')}
 for(let i=0;i<4;i++)R(x+2+i*2,y-1+((TICK+i)%3===0?-1:0),2,2,'#ffffff');
 glass();
 const skin=PAL[who].s,sh=PAL[who].S;
 for(let by=0;by<5;by++)for(let bx=0;bx<4;bx++){const c=hr(bx*7+by*13+((TICK>>3)%3))>0.5?skin:sh;g.globalAlpha=0.55;R(x+bx*3,29+by*3,3,3,c);g.globalAlpha=1}
 for(let i=0;i<4;i++){const kk=(TICK+i*9)%30;R(78+((i*7)%24),26-kk,4,2,'rgba(255,255,255,0.35)')}
 d.anchor={x,y}}
function scene(d){if(docked){const v=visitor();return d.owner===v?sAway(d):sVisit(d,v)}
 const a=d.act;
 if(a==='idle')return sIdle(d);if(a==='school'||a==='uni')return sCampus(d);if(a==='transport')return sBus(d);
 if(a==='toilet')return sToilet(d);if(a==='shower')return sShower(d);
 if(a==='groceries')return sShop(d);if(a==='studyuni')return sStudyUni(d);
 if(d.owner==='rocky')({projects:rProjects,studying:rStudy,eating:rEat,cooking:rCook,sleeping:rSleep}[a]||sIdle)(d);
 else({lab:hLab,studying:hStudy,eating:hEat,cooking:hCook,sleeping:hSleep}[a]||sIdle)(d)}
function worldFor(d){const a=d.act,rr=d.owner==='rocky',room=rr?282:242;if(docked)return room;
 if(a==='school'||a==='uni')return 300;if(a==='transport')return 80;if(a==='toilet'||a==='shower')return 110;if(a==='lab')return 172;if(a==='groceries')return 222;if(a==='studyuni')return 120;if(a==='cooking'&&!rr)return 100;return room}
function focusFor(d){const a=d.act,rr=d.owner==='rocky';
 if(docked){const v=visitor();return d.owner===v?AWAYX[d.owner]:HOSTX[d.owner]+(v==='rocky'?-2:14)}
 if(a==='idle'){const ch=d.chore;return ch&&ch.c.k==='fetch'&&ch.phase==='do'?Math.round((d.me.x+d.dog.x)/2)+8:d.me.x+6}if(a==='school'||a==='uni')return campusX()+6;if(a==='transport')return 40;if(a==='toilet')return 30;if(a==='shower')return 80;if(a==='lab')return labX()+6;if(a==='groceries')return shopX(TICK%270)+14;if(a==='projects'&&rr)return projX()+10;if(a==='studyuni')return 58;
 if(rr)return {studying:196,eating:192,cooking:22,sleeping:246}[a]||d.me.x;
 return {studying:150,eating:210,cooking:40,sleeping:222}[a]||d.me.x}

/* ---------- overlays, HUD ---------- */
const nameOf=o=>o==='rocky'?rockyName:herName;
function toS(d,x,y){return{x:(x-d.cam)*2,y:y*2+9}}
function panel(){R(3,96,154,21,'#3a2f48');R(4,97,152,19,'#1d1726')}
function envIcon(x,y,on){const c=on?'#9fd0ff':'#8a83a0';R(x,y,7,5,c);P(x+1,y+1,'#1d1726');P(x+2,y+2,'#1d1726');P(x+3,y+3,'#1d1726');P(x+4,y+2,'#1d1726');P(x+5,y+1,'#1d1726')}
function inboxView(d){R(2,48,156,70,'#3a2f48');R(3,49,154,68,'#1d1726');
 const n=d.notes.length;text('INBOX',8,52,'#ffd6dc');text(n+'/5',150-tw(n+'/5'),52,'#8a7f98');R(8,58,144,1,'#3a2f48');
 if(!n)text('NOTHING HERE YET',8,64,'#8a7f98');
 d.notes.forEach((nt,i)=>{const y=62+i*9;if(i===d.sel){R(5,y-1,150,8,'#3a2f48');text('>',7,y+1,'#ffd36b')}
  if(!nt.heard)R(13,y+2,3,3,'#5aa8ff');text(nameOf(nt.from),19,y+1,'#f4eefa');text(nt.kind==='art'?'PIXEL ART':'0:'+String(Math.min(nt.secs||0,99)).padStart(2,'0'),70,y+1,nt.kind==='art'?'#ffd36b':'#cfc6da');text(nt.at,152-tw(nt.at),y+1,'#8a7f98')});
 R(3,108,154,9,'#2a2236');text('SW1 NEXT SW2 PLAY SW3 BACK',6,110,'#a99cb8')}
function menuItems(o){return [['back','< BACK']].concat(ACTS[o])}
function menuView(d){const it=menuItems(d.owner),VIS=9,top=Math.max(0,Math.min(it.length-VIS,d.msel-4));
 R(2,11,156,107,'#3a2f48');R(3,12,154,105,'#1d1726');text('WHAT ARE YOU DOING?',8,15,'#ffd6dc');R(8,21,144,1,'#3a2f48');
 for(let r=0;r<VIS&&top+r<it.length;r++){const i=top+r,y=24+r*9,[a,l]=it[i];
  if(i===d.msel){R(5,y-1,150,8,'#3a2f48');text('>',7,y+1,'#ffd36b')}
  if(a===d.act&&a!=='back')R(13,y+2,3,3,ACTCOL[a]||'#ffd9a8');text(l,19,y+1,a==='back'?'#8a7f98':'#f4eefa')}
 if(top>0)text('-',150,24,'#8a7f98');if(top+VIS<it.length)text('+',150,96,'#8a7f98');
 R(3,107,154,10,'#2a2236');text('SW2 UP  SW3 DOWN  SW1 OK',8,110,'#a99cb8')}
function drawOv(d){const o=d.ov;if(!o)return;const k=TICK-o.t0,a=d.anchor?toS(d,d.anchor.x,d.anchor.y):{x:68,y:50},ax=Math.max(2,Math.min(132,a.x));
 if(o.type==='rec'){panel();if(k%10<6){R(8,100,3,3,'#ff4d63');P(7,101,'#ff4d63');P(11,101,'#ff4d63')}
  text('REC 0:'+String(Math.min((k/10)|0,10)).padStart(2,'0'),15,99,'#ffd6dc');for(let i=0;i<30;i++){const h=1+(hr(k*7+i)*7|0);R(58+i*3,103-(h>>1),2,h,'#ff8fa8')}
  text('LET GO OF SW3 TO SEND',8,109,'#a99cb8');
  if(k%8<5){const bx=Math.min(140,ax+24),by=Math.max(11,a.y-6);box(bx,by,15,9,'#ffffff','#1b1626');R(bx+3,by+4,2,2,'#1b1626');R(bx+7,by+4,2,2,'#1b1626');R(bx+11,by+4,2,2,'#1b1626')}}
 if(o.type==='send'){panel();const f=Math.min(k/20,1),sx=ax+6,sy=Math.max(12,a.y-14),ex=sx+(166-sx)*f,ey=sy+(6-sy)*f-Math.sin(f*Math.PI)*16;
  if(k<22){spr(ENV,ex,ey,{k:'#3b2a40',w:'#fff8ec',p:'#ff6f91'},false,2);text('SENDING TO '+nameOf(d.partner)+'...',8,99,'#f4eefa')}
  else text('SAVED IN '+nameOf(d.partner)+' INBOX *',8,99,'#ff9fb6');text('VOICE NOTE '+o.secs+' SEC',8,109,'#a99cb8')}
 if(o.type==='noteIn'&&k<20){const f=k/20;spr(ENV,80+(62-80)*f,40-34*f,{k:'#3b2a40',w:'#fff8ec',p:'#5aa8ff'},false,f<0.5?2:1)}
 if(o.type==='play'&&o.note.kind==='art'){artView(o.note,k);return}
 if(o.type==='play'){panel();const play=k>=6,nt=o.note;o.from=nt.from;o.secs=nt.secs;o.at=nt.at;
  text('PLAYING '+nameOf(o.from)+' '+o.at,8,99,'#f4eefa');
  R(8,108,1,5,'#9fd0ff');R(9,109,1,3,'#9fd0ff');R(10,110,1,1,'#9fd0ff');
  R(14,110,112,2,'#3a3048');if(play)R(14,110,Math.min(112,((k-6)/(o.secs*10+10))*112|0),2,'#9fd0ff');text('0:0'+Math.min(o.secs,9),132,108,'#a99cb8');
  if(play){const bx=Math.max(2,Math.min(112,ax-10)),by=Math.max(11,a.y-20);box(bx,by,46,16,'#ffffff','#1b1626');R(bx+8,by+16,3,2,'#1b1626');R(bx+9,by+15,1,2,'#ffffff');
   for(let i=0;i<13;i++){const h=2+(hr(k*3+i)*9|0);R(bx+4+i*3,by+8-(h>>1),2,h,'#3c79d6')}}}
 if(o.type==='loveOut')spr(BIGHEART,ax+5,a.y-14-k*3,HP,false,2);
 if(o.type==='loveIn'&&k<30){for(let i=0;i<6;i++){const hx=ax+8+Math.round((hr(i+o.t0)-0.5)*60),hy=10+((k*3+i*13)%Math.max(16,a.y));spr(HEART5,hx,hy,HP,false,2)}}
}
function artView(nt,k){const a=nt.art;if(!a||!a.d)return;R(0,9,160,110,'#1d1726');
 const s=Math.max(1,Math.min(Math.floor(96/a.h),Math.floor(150/a.w))),w=a.w*s,h=a.h*s,x0=(160-w)>>1,y0=12+((96-h)>>1);R(x0-2,y0-2,w+4,h+4,'#3a2f48');R(x0,y0,w,h,'#0f0b14');
 const rev=Math.min(a.h,Math.ceil(k*a.h/12));for(let y=0;y<rev;y++)for(let x=0;x<a.w;x++){const ch=a.d[y*a.w+x];if(ch&&ch!=='.'){const c=a.p[parseInt(ch,36)];if(c)R(x0+x*s,y0+y*s,s,s,c)}}
 R(0,108,160,11,'#2a2236');text('ART FROM '+nameOf(nt.from)+' '+nt.at,6,111,'#ffd6dc')}
function battIcon(x,y,lvl,chg){const low=lvl<20&&!chg,fr=low&&TICK%10<5?'#ff5d5d':'#cfc6da';R(x,y,8,5,fr);R(x+8,y+1,1,3,fr);R(x+1,y+1,6,3,'#1d1726');const w=Math.max(1,Math.round(lvl/100*6));R(x+1,y+1,w,3,lvl<20?'#ff5d5d':lvl<50?'#ffd36b':'#5fd38a');if(chg){P(x+4,y,'#ffe08a');P(x+3,y+1,'#ffe08a');R(x+3,y+2,3,1,'#ffe08a');P(x+4,y+3,'#ffe08a');P(x+4,y+4,'#ffe08a')}}
function wifiIcon(x,y,on){const c=on?'#8fe0a8':'#8a7f98';R(x+1,y,5,1,c);P(x,y+1,c);P(x+6,y+1,c);R(x+2,y+2,3,1,c);P(x+3,y+4,c);if(!on&&TICK%10<6){P(x+6,y+3,'#ff5d5d');P(x+6,y+4,'#ff5d5d')}}
function wxIcon(x,y,o){const c=wxCond(o),n=isNight();
 if(c==='clear'){if(n){R(x+1,y,3,5,'#f4efc8');R(x+2,y,2,4,'#1d1726')}else{R(x+1,y+1,3,3,'#ffd36b');P(x+2,y,'#ffd36b');P(x+2,y+4,'#ffd36b');P(x,y+2,'#ffd36b');P(x+4,y+2,'#ffd36b')}return}
 R(x,y+1,5,3,'#c9d0da');R(x+1,y,3,1,'#c9d0da');if(c==='rain'){P(x+1,y+4,'#7fb6ff');P(x+3,y+4,'#7fb6ff')}if(c==='snow'){P(x+1,y+4,'#ffffff');P(x+3,y+4,'#ffffff')}}
function hud(d){R(0,0,160,9,'#1d1726');R(0,8,160,1,'#3a2f48');
 const nm=nameOf(d.owner);text(nm,3,2,d.owner==='rocky'?'#9fc2ff':'#ffb3c4');const bx=3+tw(nm)+4;wifiIcon(bx,2,d.net!==false);
 if(docked&&TICK%10<7)text('LINK',bx+13,2,'#d8b25c');
 const tx=157-tw(clockStr);text(clockStr,tx,2,'#cfc6da');
 const tp=wxTemp(d.owner)+'°',tpx=tx-5-tw(tp);text(tp,tpx,2,'#cfe0ff');wxIcon(tpx-7,2,d.owner);
 const cnt=String(d.sent),cx=tpx-14-tw(cnt),bump=TICK-d.sentAt<6;
 spr(HEART5,cx-7,2,bump?{k:'#4a1428',p:'#ffe08a'}:HP);text(cnt,cx,2,bump?'#ffe08a':'#ffb3c4');
 const un=d.notes.filter(n=>!n.heard).length,us=String(un),ex=cx-7-6-tw(us)-9,lit=un>0&&(TICK%16<11||d.view==='inbox');envIcon(ex,2,lit);text(us,ex+9,2,un?'#9fd0ff':'#8a83a0')}
function ago(p){const s=((TICK-p.offAt)/10)|0;return s<60?'LAST '+s+'S':'LAST '+((s/60)|0)+'M'}
function ticker(d){R(0,119,160,9,'#1d1726');R(0,119,160,1,'#3a2f48');spr(HEART5,3,121,HP);
 const p=DEV[d.partner],fl=TICK-p.flash<20&&TICK%4<2;let s;
 if(docked){const v=visitor();s=v===d.owner?'VISITING '+nameOf(d.partner):nameOf(v)+' IS VISITING'}else s=nameOf(p.owner)+': '+(p.act==='idle'&&p.chore&&p.chore.phase==='do'?p.chore.c.label:label(p.owner,p.act));
 text(s,11,121,fl?'#ffe08a':'#cfc6da');
 if(p.off){const a=ago(p);text(a,157-tw(a),121,'#8a7f98')}else R(154,122,3,3,'#5fd38a')}
function toast(d){const t=d.toast;if(!t||TICK<t.t0||TICK-t.t0>20)return;const w=tw(t.s)+8,x=(160-w)>>1;box(x,11,w,9,'#fff6e6','#1b1626');text(t.s,x+4,13,'#3a2440')}
function awayCard(d){const host=d.partner,l1='VISITING '+nameOf(host),l2='BACK SOON *',w=Math.max(tw(l1),tw(l2))+12,x=(160-w)>>1;
 box(x,46,w,22,'#fff6e6','#1b1626');text(l1,x+6,50,'#3a2440');text(l2,x+6,59,'#c4446a')}
function bigBatt(x,y,c){R(x,y,24,12,c);R(x+24,y+3,3,6,c);R(x+2,y+2,20,8,'#000');R(x+3,y+3,3,6,'#ff5d5d')}
function tiredFx(d){g.fillStyle='rgba(8,6,16,0.28)';g.fillRect(0,9,W,110);
 const a=d.anchor?toS(d,d.anchor.x,d.anchor.y):{x:68,y:60},ax=Math.max(4,Math.min(124,a.x));
 if(TICK%30<20){const bx=Math.min(124,ax+22),by=Math.max(12,a.y-14);box(bx,by,24,15,'#ffffff','#1b1626');R(bx+5,by+15,2,2,'#ffffff');P(bx+4,by+16,'#1b1626');
  R(bx+4,by+4,14,7,'#1b1626');R(bx+18,by+6,2,3,'#1b1626');R(bx+5,by+5,12,5,'#ffffff');if(TICK%10<6)R(bx+6,by+6,3,3,'#ff5d5d')}
 const sy=a.y+6+((TICK>>1)%6);R(ax+2,sy,2,3,'#8fd3ff');P(ax+2,sy-1,'#8fd3ff');
 if(TICK%48<8)text('YAWN',ax+26,a.y+10,'#cfc6da')}
function cheerFx(d){const a=d.anchor?toS(d,d.anchor.x,d.anchor.y):{x:68,y:60},ax=Math.max(4,Math.min(124,a.x)),k=TICK-d.chgAt;
 for(let i=0;i<4;i++){const hy=a.y-6-((k*2+i*7)%24);spr(HEART5,ax+2+i*6,hy,HP)}}
function draw(d){g=d.ctx;if(d.off){if(!d.offAnim){g.fillStyle='#000';g.fillRect(0,0,W,H);if(TICK-(d.emptyAt||-99)<14&&TICK%6<4)bigBatt(66,58,'#ff5d5d')}return}
 g.fillStyle='#000';g.fillRect(0,0,W,H);
 d.hop=0;const o=d.ov;if(o&&o.type==='loveIn'){const k=TICK-o.t0;d.hop=(k%8<3&&k<28)?-2:0}
 g.save();g.beginPath();g.rect(0,9,W,110);g.clip();g.translate(0,9);g.scale(2,2);g.translate(-d.cam,0);
 TIRED=d.batt<=10&&!d.chg;scene(d);TIRED=false;g.restore();
 g.save();g.beginPath();g.rect(0,9,W,110);g.clip();if(docked&&visitor()===d.owner)awayCard(d);if(d.view==='inbox'&&!(d.ov&&d.ov.type==='play'))inboxView(d);if(d.batt<=10&&!d.chg)tiredFx(d);if(TICK-d.chgAt<24)cheerFx(d);if(d.view==='menu')menuView(d);drawOv(d);g.restore();
 hud(d);ticker(d);toast(d);if(d.onAnim)applyOn(d)}

/* ---------- state ---------- */
const ACTS={rocky:[['idle','HOME'],['projects','ON A PROJECT'],['studying','STUDYING AT HOME'],['studyuni','STUDYING AT UNI'],['cooking','COOKING'],['eating','EATING'],['groceries','GROCERIES'],['sleeping','SLEEPING'],['toilet','ON THE TOILET'],['shower','SHOWERING'],['school','AT LUT'],['transport','ON THE BUS']],
 her:[['idle','HOME'],['lab','IN THE LAB'],['studying','STUDYING AT HOME'],['studyuni','STUDYING AT UNI'],['cooking','COOKING'],['eating','EATING'],['groceries','GROCERIES'],['sleeping','SLEEPING'],['toilet','ON THE TOILET'],['shower','SHOWERING'],['uni','AT METROPOLIA'],['transport','ON THE BUS']]};
const CHIP={studying:'Study home',studyuni:'Study uni',projects:'Project',groceries:'Groceries',toilet:'Toilet',shower:'Shower',transport:'Bus',school:'LUT',uni:'Metropolia',lab:'Lab'};
const ACTCOL={idle:'#ffd9a8',projects:'#4fe0d2',groceries:'#b98cff',studying:'#ffc44d',studyuni:'#ffc44d',cooking:'#ff7a3c',eating:'#ff9a4d',sleeping:'#262a4e',toilet:'#b6e36a',shower:'#7fd0ff',school:'#7ed67a',uni:'#7ed67a',lab:'#9ff0d8',transport:'#ffe066'};
const label=(o,a)=>(ACTS[o].find(x=>x[0]===a)||['','HOME'])[1];
function mk(owner,act,mx){return{owner,partner:owner==='rocky'?'her':'rocky',act,sent:owner==='rocky'?12:15,batt:owner==='rocky'?82:64,chg:false,chgAt:-99,lowStage:0,emptyAt:-99,sentAt:-99,notes:[],view:'home',sel:0,msel:1,menuT:0,ov:null,queue:[],inbox:[],off:false,offAt:0,toast:null,flash:-99,hop:0,anchor:null,cam:0,snap:true,
 statusAt:0,chore:null,lastChore:null,me:{x:mx,tx:mx,wait:20,step:0,face:1},dog:{x:mx-16,step:0,flip:false,moving:false},ctx:null,leds:[]}}
const DEV={rocky:mk('rocky','idle',140),her:mk('her','lab',120)};
let DL=[];
const EV=[];function after(n,fn){EV.push({at:TICK+n,fn})}

function pickTarget(d){const m=d.me,w=d.owner==='rocky'?282:242;m.tx=2+(Math.random()*(w-22)|0)}
function moveActor(d){const m=d.me;if(m.wait>0){m.wait--;return}
 const dx=Math.sign(m.tx-m.x);if(!dx){m.wait=15+(Math.random()*40|0);pickTarget(d);return}m.x+=dx;m.face=dx;m.step++}
function moveDog(d){const m=d.me,dg=d.dog,fr=d.owner!=='rocky',tx=m.x+(m.face>0?(fr?-11:-15):(fr?13:11)),dx=tx-dg.x;dg.moving=false;
 if(Math.abs(dx)>2){dg.x+=Math.sign(dx);dg.step++;dg.flip=dx<0;dg.moving=true}else dg.flip=(m.x+6)<(dg.x+8)}
function addNote(d,n){d.notes.unshift({from:n.from,secs:n.secs,at:n.at,heard:false,id:n.id,kind:n.kind||'voice',path:n.path,art:n.art});if(d.notes.length>5)d.notes.length=5;if(d.view==='inbox')d.sel=0}
function startOv(d,ov){ov.t0=TICK;d.ov=ov;
 if(ov.type==='noteIn'){addNote(d,ov);d.toast={s:ov.kind==='art'?'NEW PIXEL ART':'NEW VOICE NOTE',t0:TICK};chime([660,880,990])}
 if(ov.type==='play'){ov.note.heard=true;NET.heard(ov.note);if(ov.note.kind!=='art')AUDIO.play(ov.note)}
 if(ov.type==='loveIn'){d.toast={s:'+1 LOVE FROM '+nameOf(d.partner),t0:TICK};chime([880,1320])}
 if(ov.type==='loveOut')d.toast={s:'LOVE SENT *',t0:TICK}}
function setOv(d,ov){if(d.ov)d.queue.push(ov);else startOv(d,ov)}
function deliver(p,ov){if(p.off)p.inbox.push(ov);else setOv(p,ov)}
function sendVoice(d){const secs=Math.max(1,((TICK-d.ov.t0)/10)|0);if(!REC.stop(secs)){d.ov=null;return}d.ov={type:'send',t0:TICK,secs}}
function setAct(d,a,net){d.act=a;d.snap=true;d.statusAt=TICK;d.chore=null;d.toast={s:'NOW: '+label(d.owner,a),t0:TICK};d.flash=TICK;if(!net&&window.NET)NET.status(a)}
function press(owner,k){const d=typeof owner==='object'?owner:DEV[owner],p=DEV[d.partner];if(d.off)return;
 beep(k==='love'?1100:k.startsWith('rec')?520:760,0.035);const inbox=d.view==='inbox';
 if(d.view==='menu'){const it=menuItems(d.owner);d.menuT=TICK;
  if(k==='mode'){const a=it[d.msel][0];d.view='home';if(a!=='back')setAct(d,a);return}
  if(k==='love'){d.msel=(d.msel-1+it.length)%it.length;return}
  if(k==='recTap'||k==='recUp'){d.msel=(d.msel+1)%it.length;return}
  return}
 if(k==='mode'){if(inbox){if(d.notes.length)d.sel=(d.sel+1)%d.notes.length;return}
  if(d.ov&&d.ov.type==='rec')return;d.view='menu';d.menuT=TICK;d.msel=Math.max(1,menuItems(d.owner).findIndex(a=>a[0]===d.act));return}
 if(k==='love'){if(inbox){const nt=d.notes[d.sel];if(!nt)return;if(d.ov&&d.ov.type==='play'){d.ov=null;AUDIO.stop();return}if(!d.ov||['noteIn','loveIn','loveOut'].includes(d.ov.type))startOv(d,{type:'play',note:nt});return}
  d.sent++;d.sentAt=TICK;setOv(d,{type:'loveOut'});NET.love()}
 if(k==='recTap'){if(d.ov&&d.ov.type==='rec')return;if(inbox){if(d.ov&&d.ov.type==='play'){d.ov=null;AUDIO.stop()}d.view='home'}else{d.view='inbox';d.sel=0}}
 if(k==='recHold'){if(d.ov&&d.ov.type!=='rec'){d.toast={s:'ONE MOMENT...',t0:TICK};return}if(!d.ov){d.view='home';startOv(d,{type:'rec'});REC.start()}}
 if(k==='recUp'){if(d.ov&&d.ov.type==='rec')sendVoice(d)}}
function update(d){if(d.off)return;if(d.view==='menu'&&TICK-d.menuT>150)d.view='home';d.batt=100;
 const st=d.chg?0:d.batt<=10?2:d.batt<20?1:0;if(st>d.lowStage){d.toast={s:st===2?'PLEASE CHARGE ME':'BATTERY LOW',t0:TICK};chime(st===2?[440,330]:[520,440])}
 d.lowStage=st;if(st===2&&TICK%300===150)d.toast={s:'PLEASE CHARGE ME',t0:TICK};
 if(!d.chg&&d.batt<=2&&!d.dying){d.dying=true;d.toast={s:'BATTERY EMPTY',t0:TICK};after(18,()=>{d.dying=false;if(!d.chg&&d.batt<=2)setPower(d,false)})}
 if(!docked&&d.act==='idle'){const busy=choreTick(d);if(!busy){moveActor(d);moveDog(d)}else{const ch=d.chore;if(ch&&ch.c.k==='fetch'&&ch.phase==='do')fetchDog(d);else if(!(ch&&(ch.c.k==='pet'||(ch.c.k==='frog'&&ch.phase==='do'))))moveDog(d)}}
 const o=d.ov;if(o){const k=TICK-o.t0,dur={send:32,loveOut:24,loveIn:34,noteIn:26,play:o.note?(o.note.kind==='art'?70:22+o.note.secs*10):0}[o.type];
  if(o.type==='rec'&&k>=100)sendVoice(d);else if(dur&&k>=dur){d.ov=null;if(d.queue.length)startOv(d,d.queue.shift())}}
 const ww=worldFor(d),tg=Math.max(0,Math.min(ww-80,Math.round(focusFor(d)-40)));
 if(d.snap){d.cam=tg;d.snap=false}else d.cam+=Math.sign(tg-d.cam)*Math.min(3,Math.abs(tg-d.cam))}
function ledColors(d){const k=TICK;if(d.off)return['#2a2433','#2a2433','#2a2433'];if(docked)return[0,1,2].map(i=>`hsl(${(k*14+i*70)%360} 90% 62%)`);
 const o=d.ov;if(o){const kk=TICK-o.t0;
  if(o.type==='rec')return Array(3).fill(kk%10<6?'#ff3b4e':'#3a0d14');
  if(o.type==='noteIn'||o.type==='play'){const v=(Math.sin(kk*0.45)+1)/2;return Array(3).fill(`rgba(110,170,255,${(0.3+v*0.7).toFixed(2)})`)}
  if(o.type==='loveIn'||o.type==='loveOut')return[0,1,2].map(i=>(kk+i*2)%6<3?'#ff6f91':'#5a1f30');
  if(o.type==='send')return[0,1,2].map(i=>((kk>>1)%3)===i?'#7fd0ff':'#1a2a3a')}
 const c=ACTCOL[d.act]||'#ffd9a8',un=d.notes.some(n=>!n.heard),l0=d.chg?`rgba(95,211,138,${(0.35+0.65*(Math.sin(k*0.2)+1)/2).toFixed(2)})`:d.batt<=10&&k%20<10?'#ff9a2a':c;return[l0,c,un&&TICK%20<4?'#5aa8ff':c]}
/* old-TV switch-off: squash to a bright line (0.7 s), shrink to a dot (0.3 s), fade (0.3 s) */
function crtOff(d){const cv=d.ctx&&d.ctx.canvas;if(!cv||reduce||typeof requestAnimationFrame!=='function')return;
 const snap=document.createElement('canvas');snap.width=W;snap.height=H;snap.getContext('2d').drawImage(cv,0,0);
 const c=d.ctx;c.imageSmoothingEnabled=false;d.offAnim=true;const t0=performance.now();
 function f(now){const t=now-t0;c.fillStyle='#000';c.fillRect(0,0,W,H);
  if(t<700){const p=t/700,e=p*p*p,h=Math.max(2,Math.round(H*(1-e))),y=(H-h)>>1;c.drawImage(snap,0,0,W,H,0,y,W,h);c.fillStyle='rgba(255,255,255,'+(p*p*0.9).toFixed(2)+')';c.fillRect(0,y,W,h)}
  else if(t<1000){const p=(t-700)/300,e=p*p,w=Math.max(2,Math.round(W*(1-e)));c.fillStyle='#ffffff';c.fillRect((W-w)>>1,(H>>1)-1,w,2)}
  else if(t<1300){const p=(t-1000)/300;c.fillStyle='rgba(255,255,255,'+(1-p).toFixed(2)+')';c.fillRect((W>>1)-1,(H>>1)-1,2,2)}
  else{d.offAnim=false;return}
  requestAnimationFrame(f)}
 requestAnimationFrame(f)}
/* power-on is the reverse: dot fades in (0.3 s), stretches to a line (0.3 s), opens into the live screen (0.7 s) */
function crtOn(d){if(!d.ctx||!d.ctx.canvas||reduce||typeof requestAnimationFrame!=='function')return;
 d.onAnim={t0:performance.now()};if(!d.tmp){d.tmp=document.createElement('canvas');d.tmp.width=W;d.tmp.height=H}
 const f=()=>{if(!d.onAnim||d.off)return;draw(d);requestAnimationFrame(f)};requestAnimationFrame(f)}
function applyOn(d){const c=d.ctx,t=performance.now()-d.onAnim.t0;
 if(t<300){c.fillStyle='#000';c.fillRect(0,0,W,H);c.fillStyle='rgba(255,255,255,'+(t/300).toFixed(2)+')';c.fillRect((W>>1)-1,(H>>1)-1,2,2)}
 else if(t<600){const p=(t-300)/300,e=1-(1-p)*(1-p),w=Math.max(2,Math.round(W*e));c.fillStyle='#000';c.fillRect(0,0,W,H);c.fillStyle='#ffffff';c.fillRect((W-w)>>1,(H>>1)-1,w,2)}
 else if(t<1300){const p=(t-600)/700,e=1-Math.pow(1-p,3),h=Math.max(2,Math.round(H*e)),y=(H-h)>>1;const tc=d.tmp.getContext('2d');tc.drawImage(c.canvas,0,0);
  c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,W,H);c.drawImage(d.tmp,0,0,W,H,0,y,W,h);c.fillStyle='rgba(255,255,255,'+((1-p)*(1-p)*0.9).toFixed(2)+')';c.fillRect(0,y,W,h)}
 else d.onAnim=null}
function setPower(d,on){if(on===!d.off)return;if(on&&d.batt<=2&&!d.chg){d.emptyAt=TICK;beep(200,0.12);return}if(!on){d.onAnim=null;crtOff(d)}
 if(!on){d.off=true;d.offAt=TICK;d.ov=null;d.queue=[];if(docked)toggleDock(false)}
 else{d.off=false;d.offAnim=false;d.snap=true;d.statusAt=TICK;d.chore=null;crtOn(d);const n=d.inbox.length;if(n){d.toast={s:n+' NEW FROM SERVER',t0:TICK+13};d.inbox.forEach(ov=>{if(ov.type==='noteIn')addNote(d,ov);else d.queue.push(ov)});d.inbox=[];after(18,()=>{if(!d.ov&&d.queue.length)startOv(d,d.queue.shift())})}else d.toast={s:'HELLO AGAIN *',t0:TICK+13}}
 const b=document.getElementById('pw-'+d.owner);if(b){b.setAttribute('aria-pressed',String(on));b.textContent=on?'Device on':'Device off'}}

/* ---------- sound ---------- */
let AC=null;
function tone(f,d,delay,v){if(!soundOn)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),gn=AC.createGain(),n=AC.currentTime+(delay||0);o.type='square';o.frequency.value=f;gn.gain.setValueAtTime(v||0.035,n);gn.gain.exponentialRampToValueAtTime(0.0001,n+d);o.connect(gn);gn.connect(AC.destination);o.start(n);o.stop(n+d+0.03)}catch(e){}}
function beep(f,d){tone(f,d,0,0.03)}
function chime(fs){fs.forEach((f,i)=>tone(f,0.12,i*0.09,0.03))}

/* ---------- DOM ---------- */
function toggleDock(){}
function syncChips(){}
function tick(){TICK++;if(TICK%10===1){const t=new Date();clockStr=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')}
 for(let i=EV.length-1;i>=0;i--)if(EV[i].at<=TICK){const e=EV.splice(i,1)[0];e.fn()}
 for(const d of DL){update(d);draw(d);const c=ledColors(d);d.leds.forEach((el,i)=>{el.style.background=c[i];el.style.boxShadow=d.off?'none':'0 0 10px '+c[i]})}}
