const MyBinlogEmitter = require('mysql-binlog-emitter');
const Event = MyBinlogEmitter.Events;

var mbe =  new MyBinlogEmitter({
	"mysql": {
		host: '10.147.19.218',
		port: 9395,
		user: "altersuper",
		password: "6198D789AF4E3441ADA5D25E707CE7B457D9BAA0"
	},
	"binlog":{
		slaveId:444,
		hasChecksum:true,
		lastPos:0,
		lastTime:0,
		//'ip-172-31-4-243-bin.000020 428530604',
	}
});

mbe.on(Event.ANY, console.log);

//mbe.on(Event.ANY, function(type, ...data){
//	console.log(Event.eventName(type));
//});

mbe.start();
