var connection = require('../connection');


function Pin() {
    this.getlistpin = function (req, res) {
        connection.acquire(function (err, con) {
            var md = req.params;
            con.query('SELECT id,latitudine,longitudine,range_wifi,numero_segnalazioni FROM rete_wifi WHERE latitudine >= ?-? && ' +
                'latitudine <= ?+? && longitudine >= ?-? && longitudine <= ?+?',
                [md.latitudine, md.radius_lat, md.latitudine, md.radius_lat, md.longitudine, md.radius_long, md.longitudine, md.radius_long],
                function (err, result) {
                    if (err) {
                        res.send({ status: 1, message: 'ERROR_DB' })
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify(result));
                    }
                    con.release();
                }
            );
        });
    };

    this.getuserpins = function (req, res) {
        connection.acquire(function (err, con) {
            con.query('SELECT id,ssid,latitudine,longitudine,qualità FROM rete_wifi WHERE utente = ?', [req.params.utente],
                function (err, result) {
                    if (err) {
                        res.send({ status: 1, message: 'ERROR_DB' })
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify(result));
                    }
                    con.release();
                }
            );
        });
    };



    this.get = function (rete_wifi) {
        return new Promise((resolve, reject) => {
            connection.acquire(function (err, con) {
                con.query('SELECT ssid, qualità, necessità_login, restrizioni, altre_informazioni, range_wifi, utente FROM rete_wifi WHERE id=?', [rete_wifi], function (err, result) {
                    if (err) {
                        reject('ERROR_DB');
                    } else {
                        resolve(result);
                    }
                    con.release();
                }
                );
            });
        });
    }

    this.insert = function (utente, data) {
        return new Promise((resolve, reject) => {
            if (data.ssid == null || data.ssid.length == 0) {
                reject('ERROR_SSID');
            } else if (data.qualità <= 0 || data.qualità > 5) {
                reject('ERROR_QUALITY');
            } else if (isNaN(data.necessità_login) || data.necessità_login < 0 || data.necessità_login > 1) {
                reject('ERROR_LOGIN_NECESSARY');
            } else if (isNaN(data.range) || data.range <= 0) {
                reject('ERROR_RANGE');
            } else if (isNaN(data.latitudine)) {
                reject('ERROR_LATITUDE');
            } else if (isNaN(data.longitudine)) {
                reject('ERROR_LONGITUDE');
            } else {
                connection.acquire(function (err, con) {
                    con.query('INSERT INTO rete_wifi (ssid, qualità, latitudine, longitudine, necessità_login, restrizioni, altre_informazioni, range_wifi, utente) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [data.ssid, data.qualità, data.latitudine, data.longitudine, data.necessità_login, data.restrizioni,
                        data.altre_informazioni, data.range, utente],
                        function (err, result) {
                            if (err) {
                                reject('ERROR_DB');
                            } else {
                                resolve('INSERT_OK');
                            }
                            con.release();
                        }
                    );
                });
            }
        });
    }

    this.edit = function (utente, data) {
        return new Promise((resolve, reject) => {
            if (isNaN(data.range) || data.range <= 0) {
                reject('ERROR_RANGE');
            } else {
                connection.acquire(function (err, con) {
                    con.query('SELECT utente FROM rete_wifi WHERE id = ?', [data.rete_wifi], function (err, result) {
                        if (err) {
                            reject('ERROR_DB');
                        } else if (result.length > 0) {
                            if (result[0].utente == utente) {
                                var i = 0;
                                var array_params = [];
                                var query_str = "";
                                if (!(data.restrizioni == null || data.restrizioni == '')) {
                                    query_str += ", restrizioni=?";
                                    array_params[i] = data.restrizioni;
                                    i++;
                                }
                                query_str += ", range_wifi=?";
                                array_params[i] = data.range;
                                i++;
                                if (!(data.altre_informazioni == null || data.altre_informazioni == '')) {
                                    query_str += ", altre_informazioni=?";
                                    array_params[i] = data.altre_informazioni;
                                    i++;
                                }
                                query_str = query_str.substring(2);


                                con.query('UPDATE rete_wifi SET ' + query_str + ' WHERE id = ?', array_params.concat(data.rete_wifi),
                                    function (err, result) {
                                        if (err) {
                                            reject('ERROR_DB');
                                        } else {
                                            resolve('EDIT_OK');
                                        }
                                        con.release();
                                    }
                                );
                            } else {
                                reject('ERROR_IS_NOT_OWNER');
                            }
                        } else {
                            reject('ERROR_DB');
                        }
                    });
                });
            }
        });
    }

    this.rank = function (utente, data) {
        return new Promise((resolve, reject) => {
            if (isNaN(data.voto) || data.voto <= 0 || data.voto > 5) {
                reject('ERROR_RANKING');
            } else {
                connection.acquire(function (err, con) {
                    con.query('SELECT utente FROM rete_wifi WHERE id = ?', [data.rete_wifi], function (err, result) {
                        if (err) {
                            reject('ERROR_DB');
                        } else if (result.length > 0) {
                            if (result[0].utente != utente) {
                                con.query('INSERT INTO valuta (utente, rete_wifi, voto) VALUES (?, ?, ?)', [utente, data.rete_wifi, data.voto], function (err, result) {
                                    if (err) {
                                        console.log("result="+JSON.stringify(result));
                                        reject('ERROR_RANKING_ALREADY_DONE');
                                    } else {
                                        /* Details about this query:
                                            (TODO Delete with triggers)
                                           The owner of the network gives his own ranking to the network (qualità=x, numero_recensioni=0);
                                           when user ranks the network, qualità is calculated like that because numero_recensioni+1(owner rank)+1(new rank).
                                        */
                                        con.query('UPDATE rete_wifi SET qualità = (((qualità*(numero_recensioni+1)) + ?) / (numero_recensioni+2)), numero_recensioni = numero_recensioni+1 ' +
                                            'WHERE id = ?', [data.voto, data.rete_wifi], function (err, result) {
                                                if (err) {
                                                    reject('ERROR_DB');
                                                } else {
                                                    resolve('RANKING_OK');
                                                }
                                            });
                                    }
                                    con.release();
                                });
                            } else {
                                reject('ERROR_IS_OWNER');
                            }
                        } else {
                            reject('ERROR_DB');
                        }
                    });
                });
            }
        });
    }

    this.delete = function (utente, data) {
        return new Promise((resolve, reject) => {
            connection.acquire(function (err, con) {
                con.query('SELECT utente FROM rete_wifi WHERE id = ?', [data.rete_wifi], function (err, result) {
                    if (err) {
                        reject('ERROR_DB');
                    } else if (result.length > 0) {
                        if (result[0].utente == utente) {
                            con.query('DELETE FROM segnalazione WHERE rete_wifi = ?', [data.rete_wifi], function (err, result) {
                                if (err) {
                                    reject('ERROR_DB');
                                }
                                else {
                                    con.query('DELETE FROM valuta WHERE rete_wifi = ?', [data.rete_wifi], function (err, result) {
                                        if (err) {
                                            reject('ERROR_DB');
                                        }
                                        else {
                                            con.query('DELETE FROM rete_wifi WHERE id = ?', [data.rete_wifi], function (err, result) {
                                                if (err) {
                                                    reject('ERROR_DB');
                                                }
                                            });
                                        }
                                    });
                                }
                            });


                            resolve('DELETE_OK');
                        } else {
                            reject('ERROR_IS_NOT_OWNER');
                        }
                    } else {
                        reject('ERROR_DB');
                    }
                });
            });
        });
    }
}
module.exports = new Pin();
