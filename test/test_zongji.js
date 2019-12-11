var zongji = require('zongji')

//mysql -u altersuper --password=6198D789AF4E3441ADA5D25E707CE7B457D9BAA0 -h 10.147.19.218 -P 9395 -D uchat -A
let zj = new zongji({
	host:'10.147.19.218',
	port:9395,
	user:'altersuper',
	password:'6198D789AF4E3441ADA5D25E707CE7B457D9BAA0',
	database:'uchat',
});

// Each change to the replication log results in an event
zj.on('binlog', function(evt) {
  evt.dump();
});

// Binlog must be started, optionally pass in filters
zj.start({
	startAtEnd:true,//
  includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows']
});
