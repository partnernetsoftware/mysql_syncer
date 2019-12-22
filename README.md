# mysq_syncer + zongji

mysql realtime syncer based on zongji (binlog-slave-monitoring)

# todo

https://segmentfault.com/a/1190000008169097

## limitation

* table schema sync is not yet done; following ref can be used as temp solution
```
see
gorunsync.sh
```

# usage

```
export TZ=UTC; while true; do (
		node -p "require('mysql_syncer')" /excludeSchema="{dbxxx:['g_tick2']}" /includeSchema="{dbxxx:true}" \
		/src_host=srchost /src_port=3306 /src_user=srcuser /src_pass=srcpass \
		/tgt_host=tgthost /tgt_port=3306 /tgt_user=tgtuser /tgt_pass=tgtpass /use_upsert=1;
sleep 1; ); done
```

# alter solution (mysqlbinlog v8+ with binlog_handler.js)

```
MASTER_ACCESS="--host --port --user -p" \
BINLOG_FILE="mysql-bin.000238" \
BINLOG_POS=1790960 \
mysqlbinlog $MASTER_ACCESS --read-from-remote-server --stop-never-slave-server-id=$RANDOM \
--stop-never --disable-log-bin --set-charset=utf8mb4 --base64-output=DECODE-ROWS -v -j $BINLOG_POS $BINLOG_FILE \
| node binlog_handler.js

# modify sync() to do what every what.... and will be modulized in future ;)

```

## store proc for upsert at mysql

```
DROP FUNCTION get_upsert_sql;
DELIMITER $$
CREATE FUNCTION get_upsert_sql (DBN VARCHAR(64), TBN VARCHAR(64), VLS TEXT)
RETURNS VARCHAR(4096)
DETERMINISTIC
BEGIN
RETURN (SELECT CONCAT('INSERT INTO ',DBN,'.',TBN, ' SELECT * FROM (SELECT * FROM ',DBN,'.',TBN,' WHERE 0 UNION SELECT ',VLS,' ) TMP',date_format(now(),'%y%m%d%H%i%s'),' ON DUPLICATE KEY UPDATE ',
(SELECT GROUP_CONCAT(CONCAT(COLUMN_NAME,"=VALUES(", COLUMN_NAME ,")") SEPARATOR ", ")
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DBN AND TABLE_NAME = TBN)));
END
$$
DELIMITER ;

DROP PROCEDURE IF EXISTS exec_sql;
DELIMITER $$
CREATE PROCEDURE exec_sql (IN sss TEXT,OUT rtout TEXT)  
BEGIN
DECLARE errcode CHAR(5) DEFAULT '00000';
DECLARE errmsg TEXT;
DECLARE errno INT;
DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
GET STACKED DIAGNOSTICS CONDITION 1 errcode = RETURNED_SQLSTATE, errno = MYSQL_ERRNO, errmsg = MESSAGE_TEXT;
SELECT CONCAT('{errmsg:"', errmsg,'",sql:"',@ssql,'",errno:"', errno, '",errcode:"', errcode, '"}') INTO rtout;
END;
SET @ssql=sss;
PREPARE stmt2 FROM @ssql;
EXECUTE stmt2; 
SELECT CONCAT('{STS:"OK",now:"',NOW(),'",af:"',ROW_COUNT(),'",lastID:"',LAST_INSERT_ID(),'",sql:"',@ssql,'"}') INTO rtout ;
DEALLOCATE PREPARE stmt2;
END
$$
DELIMITER ;
```

