//NOTES: run at tgt server should have better performance ?

const argv2o = a => (a || require('process').argv || []).reduce((r, e) => ((m = e.match(/^(\/|--?)([\w-]*)="?(.*)"?$/)) && (r[m[2]] = m[3]), r), {});
var argo = argv2o();
const p4web = require('p4web')({cookie_pack:'default'});
const {o2s,s2o,o2o,load,save,P}=p4web;

const crypto = require('crypto')
let md5 = s=>crypto.createHash('md5').update(s).digest("hex");
const ZongJi = require('zongji');//@ref https://github.com/nevill/zongji

var md5_argo = md5(o2s(argo));

var tgt_config = {
	host     : argo.tgt_host,
	user     : argo.tgt_user,
	password : argo.tgt_pass,
	port     : argo.tgt_port,
};
var src_config = {
	host     : argo.src_host,
	user     : argo.src_user,
	password : argo.src_pass,
	port     : argo.src_port,
};
console.log({md5_argo,o2s_argo:o2s({src_config,tgt_config})});

var {filename,position} = load(md5_argo+'.tmp') || argo;

var {includeSchema,excludeSchema} = argo;

includeSchema = s2o(includeSchema);
excludeSchema = s2o(excludeSchema);

console.log({filename,position,includeSchema,excludeSchema,argo});//process.exit();

var flg_init_with_info = !!(filename && position);

var mysql = require('mysql');

var calcWhere = (before,after) => {
	var where_a = [];
	for(var k in before){
		var v = before[k];
		if(after[k] == v){
			where_a.push(mysql.format(k+'=?',[v]));
		}
	}
	return where_a.join(' AND ');
};

var exec_sql=(c,s)=>P((v,j)=>c.query(s,(e,r,f)=>(e?j(e):v([r,f]))));

(async()=>{

	try{
		var latest_filename = filename;
		var tgt = mysql.createConnection(tgt_config);
		tgt.on('error',console.log);
		tgt.connect();
		if(!! argo.skip_tgt_binlog) // default no skip
			await exec_sql(tgt,'SET @@session.sql_log_bin=0');//skip binlog when sync

		var zongji = new ZongJi(src_config);

		var work_q = [];

		var onBinlog = (evt)=>work_q.push(evt);
		zongji.on('error',function(rsn){
			console.log('!!!! error',rsn);
			zongji.removeListener('binlog', onBinlog);
			zongji.stop();
		});
		process.on('SIGINT', function() {
			console.log('Got SIGINT.');
			zongji.removeListener('binlog', onBinlog);
			zongji.stop();
			process.exit();
		});
		zongji.on('binlog', onBinlog);

		zongji.start({
			includeSchema,excludeSchema,
			includeEvents: ['rotate','tablemap','writerows','updaterows'],
			startAtEnd:!flg_init_with_info,
			debug: argo.debug,
			filename,
			position,
		});

		do{
			await (async()=>{
				var evt = work_q.shift();//Q Head
				if(evt){
					var eventName = evt.getEventName();
					if (eventName == 'tablemap'){ return; }
					var sql='';
					var {nextPosition,position,binlogName,tableId,tableMap={},rows} = evt;

					if('writerows'==eventName){
						if (nextPosition) save(md5_argo+'.tmp',{filename:latest_filename,position:nextPosition})
						var tableInfo = tableMap[tableId]||{};
						var {parentSchema,tableName} = tableInfo;
						//if (excludeSchema){
						//	var excludeSchema_a = excludeSchema[parentSchema];
						//	if (excludeSchema_a && excludeSchema_a.indexOf && excludeSchema_a.indexOf(tableName)>=0){
						//		console.log('SKIP INSERT '+parentSchema+'.'+tableName);
						//		return;
						//	}
						//}
						sql='INSERT INTO '+parentSchema+'.'+tableName;//+' SET ? ON DUPLICATE KEY UPDATE ?';
						var sql2 = mysql.format('?',rows);
						var insert_sql = sql + ' SET '+sql2+' ON DUPLICATE KEY UPDATE '+sql2;
						console.log(insert_sql);
						await exec_sql(tgt,insert_sql);
						return;
					}else if('updaterows'==eventName){
						if (nextPosition) save(md5_argo+'.tmp',{filename:latest_filename,position:nextPosition})
						var tableInfo = tableMap[tableId]||{};
						var {parentSchema,tableName} = tableInfo;
						//if (excludeSchema){
						//	var excludeSchema_a = excludeSchema[parentSchema];
						//	if (excludeSchema_a && excludeSchema_a.indexOf && excludeSchema_a.indexOf(tableName)>=0){
						//		console.log('SKIP UPDATE '+parentSchema+'.'+tableName);
						//		return;
						//	}
						//}
						//sql='UPDATE ';
						//sql+=parentSchema+'.'+tableName+' SET ? ';
						sql='INSERT INTO '+parentSchema+'.'+tableName;
						for(var k in rows){
							var row = rows[k];
							var sql2 = mysql.format('?',row.after);
							var insert_sql = sql + ' SET '+sql2+' ON DUPLICATE KEY UPDATE '+sql2;
							console.log(insert_sql);
							await exec_sql(tgt,insert_sql);
							//var update_sql = mysql.format(sql, [row.after]) + ' WHERE '+calcWhere(row.before,row.after);
							//console.log(update_sql);
							//await exec_sql(tgt,update_sql);
						}
					}else{
						if('rotate'==eventName){
							console.log(`node binlog_syncer /filename=${binlogName} /position=${position}`);
							if(flg_init_with_info){
								latest_filename = binlogName;
								save(md5_argo+'.tmp',{filename:latest_filename,position});
							}else{
								throw new Error('need manually')
							}
						}
						//evt.dump();
						for(var k in evt){
							var v = evt[k];
							if(typeof(v)=='function'){
								//skip
							}else{
								console.log(k,'=>',o2s(v));
							}
						}
						return;
					}
				}else
					await P.delay(111);
			})()
		}while(true);
	}catch(ex){
		console.log('STOP FOR',ex);
		zongji.removeListener('binlog', onBinlog);
		zongji.stop();
		tgt.end();
	}
})();

