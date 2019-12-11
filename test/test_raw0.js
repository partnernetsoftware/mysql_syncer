var mysql = require('mysql');
var {log} = console;
var {keys} = Object;

log `${keys(mysql)}`

var conn = mysql.createConnection({
	host:'10.147.19.218',
	port:9395,
	user:'altersuper',
	password:'6198D789AF4E3441ADA5D25E707CE7B457D9BAA0',
	database:'uchat',
});
conn.on('error',()=>{
	log('TODO conn.on(error)')
});
conn.on('unhandledError',()=>{
	log('TODO conn.on(unhandledError)')
});
conn.connect()

conn.query("set @master_binlog_checksum='NONE'");

class ComBinlog {
	constructor({ serverId, nonBlock, filename, position }={}){
		this.command = 0x12;
		this.position = position || 4;

		// will send eof package if there is no more binlog event
		// https://dev.mysql.com/doc/internals/en/com-binlog-dump.html#binlog-dump-non-block
		this.flags = nonBlock ? 1 : 0;

		this.serverId = serverId || 44;
		this.filename = filename || '';
		log(this);
	}

	write (writer) {
		writer.writeUnsignedNumber(1, this.command);
		writer.writeUnsignedNumber(4, this.position);
		writer.writeUnsignedNumber(2, this.flags);
		writer.writeUnsignedNumber(4, this.serverId);
		writer.writeNullTerminatedString(this.filename);
		log('TODO write()',typeof(writer),this,new Error().stack)
	}

	parse () {
		log('TODO parse()')
	}
}

const util = require('util');

const { EofPacket, ErrorPacket,/* ComBinlog, initBinlogPacketClass*/ } = require('zongji/lib/packet');

class BinlogPacket {

	*_process(parser) {
		// uint8_t  marker; // always 0 or 0xFF
		// uint32_t timestamp;
		// uint8_t  type_code;
		// uint32_t server_id;
		// uint32_t event_length;
		// uint32_t next_position;
		// uint16_t flags;
		parser.parseUnsignedNumber(1);

		const timestamp = parser.parseUnsignedNumber(4) * 1000;
		const eventType = parser.parseUnsignedNumber(1);
		parser.parseUnsignedNumber(4); // serverId
		const eventLength = parser.parseUnsignedNumber(4);
		const nextPosition = parser.parseUnsignedNumber(4);
		parser.parseUnsignedNumber(2); // flags

		const options = {
			timestamp: timestamp,
			nextPosition: nextPosition,
			size: eventLength - BinlogPacket.Length,
			eventType ,
		};

		//if(eventType==2||eventType==34
		console.log("_process eventType=",eventType);

//		const EventClass = getEventClass(eventType);
//		this.eventName = EventClass.name;

		yield;

//		try {
//			this._event = new EventClass(parser, options, zongji);
//		} catch (err) {
//			// Record error occurence but suppress until handled
//			this._error = err;
//		}
	}

	// interface will be called, see mysql/lib/protocol/Protocol
	parse(parser) {
		this._processor = this._process(parser);
		this._processor.next();
	}

	getEvent() {
		this._processor.next();
		// Ready to handle the error now
		if (this._error) throw this._error;
		return this._event;
	}
}

BinlogPacket.Length = 19;//+4 if checksum

const Sequence = require('mysql/lib/protocol/sequences').Sequence;

class BinlogClass extends Sequence
{
	constructor(cb){
		super(cb);
		//Sequence.call(this,cb);
		log('TODO BinlogClass.constructor(cb)',typeof(cb))
	}
	start (){
		//this.emit('packet', new ComBinlog(options));
		var packet = new ComBinlog(
			{ serverId:44, /*nonBlock,*/ filename:'ip-172-31-4-243-bin.000020', position:428544210 }
		);
		console.log('new ComBinlog=',packet);
		this.emit('packet', packet);
		log('TODO start()')
	}
	determinePacket (firstByte) {
    switch (firstByte) {
    case 0xfe:
      return EofPacket;
    case 0xff:
      return ErrorPacket;
    default:
//				log('TODO determinePacket() BinlogPacket',firstByte)
      return BinlogPacket;
    }
	}
	OkPacket (){
		log('TODO OkPacket()')
	}
	BinlogPacket (packet){
		//log('TODO BinlogPacket()')

		if (this._callback) {

    //  // Check event filtering
    //  if (zongji._skipEvent(packet.eventName.toLowerCase())) {
    //    return this._callback.call(this);
    //  }

			let event, error;
			try {
				event = packet.getEvent();
			} catch (err) {
				error = err;
			}
			this._callback.call(this, error, event);
    }else{
			log('TODO BinlogPacket() no _callback')
		}

	}
	//on(evtName,handler){
	//	log('TODO BinlogClass.on()',evtName,typeof(handler))
	//	//return super.on(evtName,handler)
	//	return this;
	//}
}

//util.inherits(BinlogClass, Sequence);

log `${typeof(conn._protocol._enqueue)}`

setTimeout(()=>{
	var binlog_callback = function(err,evt){
		if(err||evt)
		log('BinlogClass(cb)',{err,evt});
	};
	conn._protocol._enqueue(new BinlogClass(binlog_callback));
},1111);

setInterval(console.log,3333);
