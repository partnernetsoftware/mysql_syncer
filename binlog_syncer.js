//NOTES: run at tgt server should have better performance ?

//const argv2o = a => (a || require('process').argv || []).reduce((r, e) => ((m = e.match(/^(\/|--?)([\w-]*)="?(.*)"?$/)) && (r[m[2]] = s2o(m[3])||m[3]), r), {});
const argv2o = a => (a || require('process').argv || []).reduce((r, e) => ((m = e.match(/^(\/|--?)([\w-]*)="?(.*)"?$/)) && (r[m[2]] = m[3]), r), {});
var argo = argv2o();
const p4web = require('p4web')({cookie_pack:'default'});
const {o2s,s2o,o2o,load,save,P}=p4web;

const crypto = require('crypto')
let md5 = s=>crypto.createHash('md5').update(s).digest("hex");
const ZongJi = require('zongji');//@ref https://github.com/nevill/zongji

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

var md5_argo = md5(o2s({src_config,tgt_config}));

console.log('DEBUG 101',{md5_argo,o2s_argo:o2s({src_config,tgt_config})});

var {filename,position} = load(md5_argo+'.tmp') || argo;

var {includeSchema,excludeSchema} = argo;

includeSchema = s2o(includeSchema);
excludeSchema = s2o(excludeSchema);

console.log('DEBUG 102',{filename,position,includeSchema,excludeSchema,argo});//process.exit();

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
		tgt.on('error',err=>{
			console.log('tgt.error',err);
			if(zongji){
				zongji.removeListener('binlog', onBinlog);
				zongji.stop();
			}
			setTimeout(process.exit,1111);
		});
		tgt.connect();
		if(!! argo.skip_tgt_binlog) // default no skip
			await exec_sql(tgt,'SET @@session.sql_log_bin=0');//skip binlog when sync

		var zongji = new ZongJi(src_config);

		var work_q = [];

		var onBinlog = (evt)=>work_q.push(evt);
		zongji.on('error',(rsn)=>{
			console.log('!!!!! error',rsn);
			if(zongji){
				zongji.removeListener('binlog', onBinlog);
				zongji.stop();
			}
			setTimeout(process.exit,1111);
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
					var {nextPosition,position,binlogName,tableId,tableMap={},rows} = evt;

					if('writerows'==eventName){
						if (nextPosition){
							if(latest_filename && nextPosition){
								save(md5_argo+'.tmp',{filename:latest_filename,position:nextPosition})
							}else{
								console.log('??????????',{latest_filename,position});
							}
						}
						var tableInfo = tableMap[tableId]||{};
						var {parentSchema,tableName} = tableInfo;
						var basesql='INSERT INTO '+parentSchema+'.'+tableName;//+' SET ? ON DUPLICATE KEY UPDATE ?';
						var sql2 = mysql.format('?',rows);
						var insert_sql = basesql + ' SET '+sql2+' ON DUPLICATE KEY UPDATE '+sql2;
						console.log(insert_sql);
						await exec_sql(tgt,insert_sql);
						return;
					}else if('updaterows'==eventName){
						if (nextPosition){
							if(latest_filename && nextPosition){
								save(md5_argo+'.tmp',{filename:latest_filename,position:nextPosition})
							}else{
								console.log('??????????',{latest_filename,position});
							}
						}
						var tableInfo = tableMap[tableId]||{};
						var {parentSchema,tableName} = tableInfo;
						for(var k in rows){
							var row = rows[k];
							var sql2 = mysql.format('?',row.after);

							if (!! argo.use_upsert){//use upsert algo
								var basesql='INSERT INTO '+parentSchema+'.'+tableName;
								var update_sql = basesql + ' SET '+sql2+' ON DUPLICATE KEY UPDATE '+sql2;
							}else{//default using update
								var basesql='UPDATE '+parentSchema+'.'+tableName+' SET ? ';
								var update_sql = mysql.format(basesql, [row.after]) + ' WHERE '+calcWhere(row.before,row.after);
							}
							console.log({update_sql});
							await exec_sql(tgt,update_sql);
						}
					}else{
						if('rotate'==eventName){
							console.log(`node binlog_syncer /filename=${binlogName} /position=${position}`);
							latest_filename = binlogName;
							if(flg_init_with_info){
								if(latest_filename && position){
									save(md5_argo+'.tmp',{filename:latest_filename,position});
									console.log('save',{binlogName,latest_filename,position});
								}else{
									console.log('??????????',{binlogName,latest_filename,position});
								}
							}else{
								if(!! argo.from_now){
									//from now
									save(md5_argo+'.tmp',{filename:latest_filename,position});
									console.log('save',{binlogName,latest_filename,position});
								}else throw new Error('need manually')//default throw err
							}
						}
						//evt.dump();
						for(var k in evt){
							var v = evt[k];
							if(typeof(v)=='function'){ //skip
							}else{
								console.log(k,'=>',o2s(v));
							}
						}
						return;
					}
				}else await P.delay(111);
			})()
		}while(true);
	}catch(ex){
		console.log('STOP FOR',ex);
		if(zongji){
			zongji.removeListener('binlog', onBinlog);
			zongji.stop();
		}
		tgt.end();
	}
})();

