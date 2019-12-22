var o2s = JSON.stringify;
var cc=0;
var fsql = false;
var fbinlog = false;
var sbinlog = '';
var fset = true;
var sql_a = [];
var set_a = [];
var output = o => console.log('sync('+ o2s(o) +');');
var al = async(line='')=> {
	if (m=line.match(new RegExp("^### (.*)"))){
		var sql_line = ''+m[1];
		if(fsql==false){
			fsql=true;
			fset=false;
			set_a=[];
		}
		var m2;
		if (m2=sql_line.match(new RegExp("^(DELETE|UPDATE|(INSERT INTO))(.*)"))){
			if(set_a.length>0){
				sql_a.push(set_a);
				set_a=[];
			}
			sql_a.push([m2[1],m2[3]]);//
			fset=false;
		}else if (m2=sql_line.match(new RegExp("^SET"))){
			fset=true;
		}else if(m2=sql_line.match(new RegExp("^.*?=(.*)"))){
			if(fset){
				set_a.push(m2[1]);
			}else{
				//console.log('DEBUG NOSET',sql_line);
			}
		}else{
			//console.log('DEBUG SKIP',sql_line);
		}
	}else{
		if(fsql==true){
			fsql=false;
			if(set_a.length>0) sql_a.push(set_a);
			output({sql_a,cc:++cc,bfs:ga.length});
			sql_a=[];
		}
		if(m=line.match(new RegExp("^BINLOG"))){
			fbinlog=true;
//		}else if (m=line.match(new RegExp("^'/*!*/"))){
//			if(fbinlog==true){
//				fbinlog=false;
//				//console.log('BINLOG',ga.length,sbinlog);//maybe for file logging? whatever
//				sbinlog='';
//			}else console.log('RESET',ga.length,line);
//		}else if(fbinlog){
//			sbinlog +=line;
		}else if(m=line.match(new RegExp("^.*Rotate to (.*)pos:(.*)"))){
			output({rotate:[m[1],m[2]],cc:++cc,bfs:ga.length});
		}else if(m=line.match(new RegExp("^# at (.*)"))){
			output({pos:m[1],cc:++cc,bfs:ga.length});
		}else{
			//console.log('DEBUGTODO',++cc,ga.length,line);
		}
	}
	return;
}
var ga=[];
var fq=false;
var lingering = "";
process.stdin.on('close',()=>(fq=true)).on('data',(chunk)=>{
	lines = (''+chunk).split("\n");
	lines[0] = lingering + lines[0];
	lingering = lines.pop();
	ga=ga.concat(lines);
});
var P=async(f)=>('function'==typeof f)?new Promise(f):f;
P.delay=t=>P(r=>setTimeout(r,t>0?t:1));
(async()=>{
	do{if(ga.length>0){await al(ga.shift())}else if(fq){process.exit()}else{await P.delay(111)}}while(true);
})();

