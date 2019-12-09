# mysq_syncer

mysql realtime syncer based on zongji (binlog-slave-monitoring)

# todo

https://segmentfault.com/a/1190000008169097

# limitation

* table schema sync is not yet done;

# usage

```
node -p "require('mysql_syncer')" /excludeSchema="{dbxxx:['g_tick2']}" /includeSchema="{dbxxx:true}" \
	/src_host=srchost /src_port=3306 /src_user=srcuser /src_pass=srcpass \
	/tgt_host=tgthost /tgt_port=3306 /tgt_user=tgtuser /tgt_pass=tgtpass
```
