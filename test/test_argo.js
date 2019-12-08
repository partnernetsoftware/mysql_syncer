const hasFunction=()=>('function'==typeof Function),
	trycatch=(fn,flagIgnoreErr=false)=>{try{return fn()}catch(ex){return flagIgnoreErr?'':ex}},
	s2o = (s,f)=>trycatch( hasFunction() ? ()=>Function('return '+s)() : ()=>JSON.parse(s) ,undefined==f?true:f)
;

const argv2o = a => (a || require('process').argv || []).reduce((r, e) => ((m = e.match(/^(\/|--?)([\w-]*)="?(.*)"?$/)) && (r[m[2]] = s2o(m[3])||m[3]), r), {});
//const argv2o = a => (a || require('process').argv || []).reduce((r, e) => ((m = e.match(/^(\/|--?)([\w-]*)="?(.*)"?$/)) && (r[m[2]] = m[3]), r), {});

console.log(argv2o());
