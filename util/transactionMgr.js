'use strict';

const mysql = require('mysql');
const fs = require("fs");
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
                        // console.dir(results);
                    }

                    connection.commit(err => {
                        connection.rollback();
                        reject(err);
                        return;
                    });

                    resolve();
                } catch (error) {
                    connection.rollback();
                    reject(err);
                } finally {
                    connection.release();
                }
            });
        });
    });
}

module.exports = () => {
    const configFile = fs.readFileSync('config.json');
    const connection = JSON.parse(configFile).DBConnect;

    pool = mysql.createPool(connection);

    return {
        executeSelect: executeSelect,
        executeTransaction: executeTransaction
    };
};
