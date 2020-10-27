'use strict';

const mysql = require('mysql');

const configReader = require('../util/configReader')();
let pool = null;

const executeSelect = (sQ, param) => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                reject(err);
                return;
            }
    
            //console.log('connected as id ' + connection.threadId);
    
            connection.query(sQ, param, (err, rows) => {
                connection.release();
    
                if (err) {
                    reject(err);
                    // res.json({"code": 100, "status": "Error in connection database"});
                    return;
                }
    
                resolve(rows); 
            });
        });
    });
}

const executeTransaction = queryFuncs => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                reject(err);
                return;
            }

            connection.beginTransaction(async error => {
                if (error) {
                    connection.rollback(() => {
                        connection.release();
                        reject(error);
                    });
                    return;
                }

                try {
                    for (let i = 0; i < queryFuncs.length; i++) {
                        const results = await queryFuncs[i](connection);
                        // console.log(results);
                    }

                    connection.commit(err => {
                        connection.rollback();
                        reject(err);
                        return;
                    });

                    resolve();
                } catch (error) {
                    console.log('executeTransaction');
                    console.log(error);
                    connection.rollback();
                    reject(error);
                } finally {
                    connection.release();
                }
            });
        });
    });
}

module.exports = () => {
    const connection = configReader.getDBConnectionConfig();
    pool = mysql.createPool(connection);

    return {
        executeSelect: executeSelect,
        executeTransaction: executeTransaction
    };
};
